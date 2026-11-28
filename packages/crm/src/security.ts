import { gcm } from '@noble/ciphers/aes'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import {
  bytesToHex,
  clean,
  hexToBytes,
  randomBytes as defaultRandomBytes,
  utf8ToBytes,
} from '@noble/hashes/utils.js'
import type {
  CrmBackupEnvelope,
  CrmContact,
  CrmDataset,
  CrmInteraction,
  CrmInteractionKind,
  CrmKeyValueStore,
  CrmLockRecord,
  CrmNote,
  CrmOwnerId,
  CrmTag,
  CrmTask,
} from './types'

const BACKUP_FORMAT = 'superapp.crm.backup'
const ENCRYPTED_BACKUP_FORMAT = 'superapp.crm.backup.encrypted'
const BACKUP_VERSION = 1
const BACKUP_KDF = 'PBKDF2-SHA256'
const DEFAULT_ITERATIONS = 240_000
const MIN_ITERATIONS = 1_000
const MAX_ITERATIONS = 10_000_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_BYTES = 32
const GCM_TAG_BYTES = 16
const LOCK_KEY_PREFIX = 'crm-pin-lock-v1-'

const ENVELOPE_KEYS = [
  'format',
  'version',
  'owner_id',
  'kdf',
  'iterations',
  'salt',
  'iv',
  'ciphertext',
] as const
const LOCK_RECORD_KEYS = ['version', 'salt', 'hash', 'iterations'] as const
const DATASET_KEYS = [
  'format',
  'version',
  'exported_at',
  'owner_id',
  'contacts',
  'tags',
  'notes',
  'tasks',
  'interactions',
] as const
const CONTACT_KEYS = [
  'local_id',
  'owner_id',
  'display_name',
  'phone',
  'email',
  'tag_ids',
  'created_at',
  'updated_at',
  'deleted_at',
] as const
const TAG_KEYS = ['local_id', 'owner_id', 'title', 'color', 'created_at', 'updated_at'] as const
const NOTE_KEYS = [
  'local_id',
  'owner_id',
  'contact_id',
  'body',
  'created_at',
  'updated_at',
  'deleted_at',
] as const
const TASK_KEYS = [
  'local_id',
  'owner_id',
  'contact_id',
  'title',
  'due_at',
  'completed',
  'created_at',
  'updated_at',
  'deleted_at',
] as const
const INTERACTION_KEYS = [
  'local_id',
  'owner_id',
  'contact_id',
  'kind',
  'summary',
  'occurred_at',
  'created_at',
  'updated_at',
  'deleted_at',
] as const

const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/

type RandomBytes = (byteCount: number) => Uint8Array

export interface CrmLock {
  hasPin(): Promise<boolean>
  setPin(pin: string): Promise<void>
  verifyPin(pin: string): Promise<boolean>
  clearPin(): Promise<void>
}

export interface CrmLockOptions {
  randomBytes?: RandomBytes
  /** Lower values are supported only as an explicit test work-factor override. */
  iterations?: number
  now?: () => Date
}

export interface CrmBackupOptions {
  randomBytes?: RandomBytes
  /** Lower values are supported only as an explicit test work-factor override. */
  iterations?: number
}

export interface CrmBackupDecryptOptions {
  /** When provided, the authenticated envelope must use this work factor. */
  iterations?: number
}

class CrmSecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CrmSecurityError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value)
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}

function requireOwnerId(value: unknown, label = 'CRM owner ID'): CrmOwnerId {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CrmSecurityError(`${label} is invalid.`)
  }
  return value
}

function requirePin(pin: unknown): asserts pin is string {
  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) {
    throw new CrmSecurityError('CRM PIN must contain 4 to 8 digits.')
  }
}

function requireIterations(value: unknown, label = 'CRM PBKDF2 iterations'): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < MIN_ITERATIONS ||
    value > MAX_ITERATIONS
  ) {
    throw new CrmSecurityError(
      `${label} must be an integer between ${MIN_ITERATIONS} and ${MAX_ITERATIONS}.`,
    )
  }
  return value
}

function randomBytesOfLength(
  randomBytes: RandomBytes,
  byteCount: number,
  label: string,
): Uint8Array {
  const value = randomBytes(byteCount)
  if (!(value instanceof Uint8Array) || value.length !== byteCount) {
    throw new CrmSecurityError(`${label} returned an invalid byte array.`)
  }
  return new Uint8Array(value)
}

function deriveKey(pin: string, salt: Uint8Array, iterations: number): Uint8Array {
  return pbkdf2(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: KEY_BYTES })
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!
  }
  return difference === 0
}

function requireHex(
  value: unknown,
  label: string,
  exactBytes?: number,
  minimumBytes?: number,
): Uint8Array {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-fA-F]+$/.test(value) ||
    value.length % 2 !== 0 ||
    (exactBytes !== undefined && value.length !== exactBytes * 2) ||
    (minimumBytes !== undefined && value.length < minimumBytes * 2)
  ) {
    const expectation =
      exactBytes !== undefined
        ? `exactly ${exactBytes} bytes of hex`
        : `at least ${minimumBytes ?? 0} bytes of hex`
    throw new CrmSecurityError(`${label} must contain ${expectation}.`)
  }
  return hexToBytes(value)
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new CrmSecurityError(`${label} is not valid JSON.`)
  }
}

function lockStorageKey(ownerId: string): string {
  const ownerHash = bytesToHex(sha256(utf8ToBytes(ownerId)))
  return `${LOCK_KEY_PREFIX}${ownerHash}`
}

function parseLockRecord(value: string): CrmLockRecord {
  const parsed = parseJson(value, 'CRM lock record')
  if (!isRecord(parsed) || !hasExactKeys(parsed, LOCK_RECORD_KEYS)) {
    throw new CrmSecurityError('CRM lock record is malformed.')
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new CrmSecurityError('CRM lock record version is unsupported.')
  }
  const salt = requireHex(parsed.salt, 'CRM lock record salt', SALT_BYTES)
  const hash = requireHex(parsed.hash, 'CRM lock record hash', KEY_BYTES)
  const iterations = requireIterations(parsed.iterations, 'CRM lock record iterations')
  return {
    version: BACKUP_VERSION,
    salt: bytesToHex(salt),
    hash: bytesToHex(hash),
    iterations,
  }
}

export function createCrmLock(
  store: CrmKeyValueStore,
  ownerId: string,
  options: CrmLockOptions = {},
): CrmLock {
  const validOwnerId = requireOwnerId(ownerId)
  const storageKey = lockStorageKey(validOwnerId)
  const randomBytes = options.randomBytes ?? defaultRandomBytes
  const iterations = requireIterations(options.iterations ?? DEFAULT_ITERATIONS)

  async function readRecord(): Promise<CrmLockRecord | null> {
    const stored = await store.getItem(storageKey)
    if (stored === null) return null
    if (typeof stored !== 'string') {
      throw new CrmSecurityError('CRM lock record is malformed.')
    }
    return parseLockRecord(stored)
  }

  return {
    async hasPin() {
      return (await readRecord()) !== null
    },

    async setPin(pin) {
      requirePin(pin)
      const salt = randomBytesOfLength(randomBytes, SALT_BYTES, 'CRM lock random byte generator')
      const derived = deriveKey(pin, salt, iterations)
      let record: CrmLockRecord
      try {
        record = {
          version: BACKUP_VERSION,
          salt: bytesToHex(salt),
          hash: bytesToHex(derived),
          iterations,
        }
      } finally {
        clean(derived)
      }
      await store.setItem(storageKey, JSON.stringify(record))
    },

    async verifyPin(pin) {
      requirePin(pin)
      const record = await readRecord()
      if (record === null) return false
      const expected = requireHex(record.hash, 'CRM lock record hash', KEY_BYTES)
      const actual = deriveKey(
        pin,
        requireHex(record.salt, 'CRM lock record salt', SALT_BYTES),
        record.iterations,
      )
      try {
        return constantTimeEqual(expected, actual)
      } finally {
        clean(expected, actual)
      }
    },

    async clearPin() {
      await store.removeItem(storageKey)
    },
  }
}

function backupAdditionalData(
  format: typeof ENCRYPTED_BACKUP_FORMAT,
  version: typeof BACKUP_VERSION,
  ownerId: string,
): Uint8Array {
  return utf8ToBytes(JSON.stringify({ format, version, owner_id: ownerId }))
}

function parseBackupEnvelope(payload: string): CrmBackupEnvelope {
  if (typeof payload !== 'string') {
    throw new CrmSecurityError('CRM backup envelope is malformed.')
  }
  const parsed = parseJson(payload, 'CRM backup envelope')
  if (!isRecord(parsed) || !hasExactKeys(parsed, ENVELOPE_KEYS)) {
    throw new CrmSecurityError('CRM backup envelope is malformed.')
  }
  if (parsed.format !== ENCRYPTED_BACKUP_FORMAT) {
    throw new CrmSecurityError('CRM backup envelope format is unsupported.')
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new CrmSecurityError('CRM backup envelope version is unsupported.')
  }
  const ownerId = requireOwnerId(parsed.owner_id, 'CRM backup envelope owner ID')
  if (parsed.kdf !== BACKUP_KDF) {
    throw new CrmSecurityError('CRM backup envelope KDF is unsupported.')
  }
  const iterations = requireIterations(parsed.iterations, 'CRM backup envelope iterations')
  const salt = requireHex(parsed.salt, 'CRM backup envelope salt', SALT_BYTES)
  const iv = requireHex(parsed.iv, 'CRM backup envelope IV', IV_BYTES)
  const ciphertext = requireHex(
    parsed.ciphertext,
    'CRM backup envelope ciphertext',
    undefined,
    GCM_TAG_BYTES,
  )
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: BACKUP_VERSION,
    owner_id: ownerId,
    kdf: BACKUP_KDF,
    iterations,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(ciphertext),
  }
}

function requireString(value: unknown, path: string, nonEmpty = false): string {
  if (typeof value !== 'string' || (nonEmpty && value.length === 0)) {
    throw new CrmSecurityError(
      `CRM backup dataset ${path} must be a${nonEmpty ? ' non-empty' : ''} string.`,
    )
  }
  return value
}

function requireNullableString(value: unknown, path: string, nonEmpty = false): string | null {
  if (value === null) return null
  return requireString(value, path, nonEmpty)
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new CrmSecurityError(`CRM backup dataset ${path} must be a boolean.`)
  }
  return value
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new CrmSecurityError(`CRM backup dataset ${path} must be an array.`)
  }
  return value
}

function requireDate(value: unknown, path: string): string {
  const date = requireString(value, path, true)
  const match = ISO_DATE_TIME.exec(date)
  if (match === null) {
    throw new CrmSecurityError(`CRM backup dataset ${path} must be a valid ISO date-time.`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = Number(match[7] ?? 0)
  const offsetMinute = Number(match[8] ?? 0)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1]! ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59 ||
    !Number.isFinite(Date.parse(date))
  ) {
    throw new CrmSecurityError(`CRM backup dataset ${path} must be a valid ISO date-time.`)
  }
  return date
}

function requireNullableDate(value: unknown, path: string): string | null {
  return value === null ? null : requireDate(value, path)
}

function requireEntityOwner(value: unknown, ownerId: string, path: string): CrmOwnerId {
  const entityOwnerId = requireString(value, path, true)
  if (entityOwnerId !== ownerId) {
    throw new CrmSecurityError(`CRM backup dataset ${path} does not match the dataset owner.`)
  }
  return entityOwnerId
}

function requireEntity(
  value: unknown,
  keys: readonly string[],
  path: string,
): Record<string, unknown> {
  if (!isRecord(value) || !hasExactKeys(value, keys)) {
    throw new CrmSecurityError(`CRM backup dataset ${path} is malformed.`)
  }
  return value
}

function validateContact(value: unknown, ownerId: string, index: number): CrmContact {
  const path = `contacts[${index}]`
  const contact = requireEntity(value, CONTACT_KEYS, path)
  const tagIds = requireArray(contact.tag_ids, `${path}.tag_ids`).map((tagId, tagIndex) =>
    requireString(tagId, `${path}.tag_ids[${tagIndex}]`, true),
  )
  if (new Set(tagIds).size !== tagIds.length) {
    throw new CrmSecurityError(`CRM backup dataset ${path}.tag_ids must be unique.`)
  }
  return {
    local_id: requireString(contact.local_id, `${path}.local_id`, true),
    owner_id: requireEntityOwner(contact.owner_id, ownerId, `${path}.owner_id`),
    display_name: requireString(contact.display_name, `${path}.display_name`),
    phone: requireNullableString(contact.phone, `${path}.phone`),
    email: requireNullableString(contact.email, `${path}.email`),
    tag_ids: tagIds,
    created_at: requireDate(contact.created_at, `${path}.created_at`),
    updated_at: requireDate(contact.updated_at, `${path}.updated_at`),
    deleted_at: requireNullableDate(contact.deleted_at, `${path}.deleted_at`),
  }
}

function validateTag(value: unknown, ownerId: string, index: number): CrmTag {
  const path = `tags[${index}]`
  const tag = requireEntity(value, TAG_KEYS, path)
  return {
    local_id: requireString(tag.local_id, `${path}.local_id`, true),
    owner_id: requireEntityOwner(tag.owner_id, ownerId, `${path}.owner_id`),
    title: requireString(tag.title, `${path}.title`),
    color: requireString(tag.color, `${path}.color`),
    created_at: requireDate(tag.created_at, `${path}.created_at`),
    updated_at: requireDate(tag.updated_at, `${path}.updated_at`),
  }
}

function validateNote(value: unknown, ownerId: string, index: number): CrmNote {
  const path = `notes[${index}]`
  const note = requireEntity(value, NOTE_KEYS, path)
  return {
    local_id: requireString(note.local_id, `${path}.local_id`, true),
    owner_id: requireEntityOwner(note.owner_id, ownerId, `${path}.owner_id`),
    contact_id: requireString(note.contact_id, `${path}.contact_id`, true),
    body: requireString(note.body, `${path}.body`),
    created_at: requireDate(note.created_at, `${path}.created_at`),
    updated_at: requireDate(note.updated_at, `${path}.updated_at`),
    deleted_at: requireNullableDate(note.deleted_at, `${path}.deleted_at`),
  }
}

function validateTask(value: unknown, ownerId: string, index: number): CrmTask {
  const path = `tasks[${index}]`
  const task = requireEntity(value, TASK_KEYS, path)
  return {
    local_id: requireString(task.local_id, `${path}.local_id`, true),
    owner_id: requireEntityOwner(task.owner_id, ownerId, `${path}.owner_id`),
    contact_id: requireNullableString(task.contact_id, `${path}.contact_id`, true),
    title: requireString(task.title, `${path}.title`),
    due_at: requireNullableDate(task.due_at, `${path}.due_at`),
    completed: requireBoolean(task.completed, `${path}.completed`),
    created_at: requireDate(task.created_at, `${path}.created_at`),
    updated_at: requireDate(task.updated_at, `${path}.updated_at`),
    deleted_at: requireNullableDate(task.deleted_at, `${path}.deleted_at`),
  }
}

function validateInteraction(value: unknown, ownerId: string, index: number): CrmInteraction {
  const path = `interactions[${index}]`
  const interaction = requireEntity(value, INTERACTION_KEYS, path)
  const kind = requireString(interaction.kind, `${path}.kind`, true)
  if (
    kind !== 'call' &&
    kind !== 'message' &&
    kind !== 'meeting' &&
    kind !== 'email' &&
    kind !== 'other'
  ) {
    throw new CrmSecurityError(`CRM backup dataset ${path}.kind is unsupported.`)
  }
  const validKind: CrmInteractionKind = kind
  return {
    local_id: requireString(interaction.local_id, `${path}.local_id`, true),
    owner_id: requireEntityOwner(interaction.owner_id, ownerId, `${path}.owner_id`),
    contact_id: requireString(interaction.contact_id, `${path}.contact_id`, true),
    kind: validKind,
    summary: requireString(interaction.summary, `${path}.summary`),
    occurred_at: requireDate(interaction.occurred_at, `${path}.occurred_at`),
    created_at: requireDate(interaction.created_at, `${path}.created_at`),
    updated_at: requireDate(interaction.updated_at, `${path}.updated_at`),
    deleted_at: requireNullableDate(interaction.deleted_at, `${path}.deleted_at`),
  }
}

function requireUniqueIds(items: readonly { local_id: string }[], collection: string): void {
  const ids = new Set<string>()
  items.forEach((item, index) => {
    if (ids.has(item.local_id)) {
      throw new CrmSecurityError(
        `CRM backup dataset ${collection}[${index}].local_id must be unique within ${collection}.`,
      )
    }
    ids.add(item.local_id)
  })
}

function validateDataset(value: unknown): CrmDataset {
  if (!isRecord(value) || !hasExactKeys(value, DATASET_KEYS)) {
    throw new CrmSecurityError('CRM backup dataset is malformed.')
  }
  if (value.format !== BACKUP_FORMAT) {
    throw new CrmSecurityError('CRM backup dataset format is unsupported.')
  }
  if (value.version !== BACKUP_VERSION) {
    throw new CrmSecurityError('CRM backup dataset version is unsupported.')
  }
  const ownerId = requireOwnerId(value.owner_id, 'CRM backup dataset owner ID')
  const contacts = requireArray(value.contacts, 'contacts').map((contact, index) =>
    validateContact(contact, ownerId, index),
  )
  const tags = requireArray(value.tags, 'tags').map((tag, index) =>
    validateTag(tag, ownerId, index),
  )
  const notes = requireArray(value.notes, 'notes').map((note, index) =>
    validateNote(note, ownerId, index),
  )
  const tasks = requireArray(value.tasks, 'tasks').map((task, index) =>
    validateTask(task, ownerId, index),
  )
  const interactions = requireArray(value.interactions, 'interactions').map((interaction, index) =>
    validateInteraction(interaction, ownerId, index),
  )

  requireUniqueIds(contacts, 'contacts')
  requireUniqueIds(tags, 'tags')
  requireUniqueIds(notes, 'notes')
  requireUniqueIds(tasks, 'tasks')
  requireUniqueIds(interactions, 'interactions')

  const tagIds = new Set(tags.map((tag) => tag.local_id))
  contacts.forEach((contact, index) => {
    contact.tag_ids.forEach((tagId) => {
      if (!tagIds.has(tagId)) {
        throw new CrmSecurityError(
          `CRM backup dataset contacts[${index}].tag_ids references an unknown tag.`,
        )
      }
    })
  })

  const contactIds = new Set(contacts.map((contact) => contact.local_id))
  notes.forEach((note, index) => {
    if (!contactIds.has(note.contact_id)) {
      throw new CrmSecurityError(
        `CRM backup dataset notes[${index}].contact_id references an unknown contact.`,
      )
    }
  })
  tasks.forEach((task, index) => {
    if (task.contact_id !== null && !contactIds.has(task.contact_id)) {
      throw new CrmSecurityError(
        `CRM backup dataset tasks[${index}].contact_id references an unknown contact.`,
      )
    }
  })
  interactions.forEach((interaction, index) => {
    if (!contactIds.has(interaction.contact_id)) {
      throw new CrmSecurityError(
        `CRM backup dataset interactions[${index}].contact_id references an unknown contact.`,
      )
    }
  })

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: requireDate(value.exported_at, 'exported_at'),
    owner_id: ownerId,
    contacts,
    tags,
    notes,
    tasks,
    interactions,
  }
}

export function encryptCrmBackup(
  dataset: CrmDataset,
  pin: string,
  options: CrmBackupOptions = {},
): string {
  requirePin(pin)
  const validDataset = validateDataset(dataset)
  const iterations = requireIterations(options.iterations ?? DEFAULT_ITERATIONS)
  const randomBytes = options.randomBytes ?? defaultRandomBytes
  const salt = randomBytesOfLength(randomBytes, SALT_BYTES, 'CRM backup random byte generator')
  const iv = randomBytesOfLength(randomBytes, IV_BYTES, 'CRM backup random byte generator')
  const plaintext = utf8ToBytes(JSON.stringify(validDataset))
  const key = deriveKey(pin, salt, iterations)
  try {
    const ciphertext = gcm(
      key,
      iv,
      backupAdditionalData(ENCRYPTED_BACKUP_FORMAT, BACKUP_VERSION, validDataset.owner_id),
    ).encrypt(plaintext)
    const envelope: CrmBackupEnvelope = {
      format: ENCRYPTED_BACKUP_FORMAT,
      version: BACKUP_VERSION,
      owner_id: validDataset.owner_id,
      kdf: BACKUP_KDF,
      iterations,
      salt: bytesToHex(salt),
      iv: bytesToHex(iv),
      ciphertext: bytesToHex(ciphertext),
    }
    return JSON.stringify(envelope)
  } finally {
    clean(key, salt, iv, plaintext)
  }
}

export function decryptCrmBackup(
  payload: string,
  pin: string,
  options: CrmBackupDecryptOptions = {},
): CrmDataset {
  requirePin(pin)
  const envelope = parseBackupEnvelope(payload)
  if (
    options.iterations !== undefined &&
    envelope.iterations !== requireIterations(options.iterations)
  ) {
    throw new CrmSecurityError('CRM backup envelope iterations do not match the expected value.')
  }
  const salt = requireHex(envelope.salt, 'CRM backup envelope salt', SALT_BYTES)
  const iv = requireHex(envelope.iv, 'CRM backup envelope IV', IV_BYTES)
  const ciphertext = requireHex(
    envelope.ciphertext,
    'CRM backup envelope ciphertext',
    undefined,
    GCM_TAG_BYTES,
  )
  const key = deriveKey(pin, salt, envelope.iterations)
  let plaintext: Uint8Array | null = null
  try {
    try {
      plaintext = gcm(
        key,
        iv,
        backupAdditionalData(envelope.format, envelope.version, envelope.owner_id),
      ).decrypt(ciphertext)
    } catch {
      throw new CrmSecurityError(
        'CRM backup authentication failed; the PIN is wrong or the backup was tampered with.',
      )
    }

    let plaintextJson: string
    try {
      plaintextJson = new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
    } catch {
      throw new CrmSecurityError('CRM backup plaintext is not valid UTF-8.')
    }

    const parsed = parseJson(plaintextJson, 'CRM backup plaintext')
    const dataset = validateDataset(parsed)
    if (dataset.owner_id !== envelope.owner_id) {
      throw new CrmSecurityError(
        'CRM backup dataset owner does not match the authenticated envelope.',
      )
    }
    return dataset
  } finally {
    clean(key, salt, iv, ciphertext)
    if (plaintext !== null) clean(plaintext)
  }
}
