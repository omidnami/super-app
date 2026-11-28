// @vitest-environment node
import { createHash, randomBytes } from 'node:crypto'
import { gcm } from '@noble/ciphers/aes'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, clean, utf8ToBytes } from '@noble/hashes/utils.js'
import { describe, expect, it } from 'vitest'
import {
  createCrmLock,
  decryptCrmBackup,
  encryptCrmBackup,
} from '../../../../packages/crm/src/security'
import type {
  CrmBackupEnvelope,
  CrmDataset,
  CrmKeyValueStore,
  CrmLockRecord,
} from '../../../../packages/crm/src/types'

const OWNER_ID = 'owner_alpha'
const OTHER_OWNER_ID = 'owner_beta'
const PIN = '48291357'
const WRONG_PIN = '91382746'
const TEST_ITERATIONS = 1_000
const NOW = '2026-11-28T10:00:00.000Z'
const BACKUP_FORMAT = 'superapp.crm.backup'
const ENCRYPTED_BACKUP_FORMAT = 'superapp.crm.backup.encrypted'
const BACKUP_OPTIONS = { iterations: TEST_ITERATIONS, randomBytes }

class MemoryKeyValueStore implements CrmKeyValueStore {
  readonly values = new Map<string, string>()

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value)
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key)
  }
}

function expectedLockKey(ownerId: string): string {
  const ownerHash = createHash('sha256').update(ownerId, 'utf8').digest('hex')
  return `crm-pin-lock-v1-${ownerHash}`
}

function createDataset(overrides: Partial<CrmDataset> = {}): CrmDataset {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exported_at: NOW,
    owner_id: OWNER_ID,
    contacts: [
      {
        local_id: 'contact_1',
        owner_id: OWNER_ID,
        display_name: 'Private Customer Name 9471',
        phone: '+1555019471',
        email: 'private-9471@example.test',
        tag_ids: ['tag_1', 'tag_2'],
        created_at: '2026-11-20T09:00:00.000Z',
        updated_at: NOW,
        deleted_at: null,
      },
    ],
    tags: [
      {
        local_id: 'tag_1',
        owner_id: OWNER_ID,
        title: 'Private Priority Tag',
        color: '#123456',
        created_at: '2026-11-20T09:00:00.000Z',
        updated_at: NOW,
      },
      {
        local_id: 'tag_2',
        owner_id: OWNER_ID,
        title: 'Follow Up',
        color: '#abcdef',
        created_at: '2026-11-20T09:00:00.000Z',
        updated_at: NOW,
      },
    ],
    notes: [
      {
        local_id: 'note_1',
        owner_id: OWNER_ID,
        contact_id: 'contact_1',
        body: 'Private note body 9471',
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      },
    ],
    tasks: [
      {
        local_id: 'task_1',
        owner_id: OWNER_ID,
        contact_id: 'contact_1',
        title: 'Private follow-up task',
        due_at: '2026-11-29T12:00:00.000Z',
        completed: false,
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      },
      {
        local_id: 'task_2',
        owner_id: OWNER_ID,
        contact_id: null,
        title: 'General task',
        due_at: null,
        completed: true,
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      },
    ],
    interactions: (['call', 'message', 'meeting', 'email', 'other'] as const).map(
      (kind, index) => ({
        local_id: `interaction_${index + 1}`,
        owner_id: OWNER_ID,
        contact_id: 'contact_1',
        kind,
        summary: `Private ${kind} summary`,
        occurred_at: NOW,
        created_at: NOW,
        updated_at: NOW,
        deleted_at: null,
      }),
    ),
    ...overrides,
  }
}

function datasetForOwner(ownerId: string): CrmDataset {
  const dataset = createDataset()
  return {
    ...dataset,
    owner_id: ownerId,
    contacts: dataset.contacts.map((contact) => ({ ...contact, owner_id: ownerId })),
    tags: dataset.tags.map((tag) => ({ ...tag, owner_id: ownerId })),
    notes: dataset.notes.map((note) => ({ ...note, owner_id: ownerId })),
    tasks: dataset.tasks.map((task) => ({ ...task, owner_id: ownerId })),
    interactions: dataset.interactions.map((interaction) => ({
      ...interaction,
      owner_id: ownerId,
    })),
  }
}

function additionalData(ownerId: string): Uint8Array {
  return utf8ToBytes(
    JSON.stringify({
      format: ENCRYPTED_BACKUP_FORMAT,
      version: 1,
      owner_id: ownerId,
    }),
  )
}

function encryptPlaintext(plaintext: string, envelopeOwnerId = OWNER_ID): string {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const plaintextBytes = utf8ToBytes(plaintext)
  const key = pbkdf2(sha256, utf8ToBytes(PIN), salt, {
    c: TEST_ITERATIONS,
    dkLen: 32,
  })
  try {
    const ciphertext = gcm(key, iv, additionalData(envelopeOwnerId)).encrypt(plaintextBytes)
    const envelope: CrmBackupEnvelope = {
      format: ENCRYPTED_BACKUP_FORMAT,
      version: 1,
      owner_id: envelopeOwnerId,
      kdf: 'PBKDF2-SHA256',
      iterations: TEST_ITERATIONS,
      salt: bytesToHex(salt),
      iv: bytesToHex(iv),
      ciphertext: bytesToHex(ciphertext),
    }
    return JSON.stringify(envelope)
  } finally {
    clean(key, salt, iv, plaintextBytes)
  }
}

function encryptDatasetValue(value: unknown, envelopeOwnerId = OWNER_ID): string {
  const json = JSON.stringify(value)
  if (json === undefined) throw new Error('Test dataset must be JSON serializable.')
  return encryptPlaintext(json, envelopeOwnerId)
}

function parseEnvelope(payload: string): CrmBackupEnvelope {
  return JSON.parse(payload) as CrmBackupEnvelope
}

function tamperHex(value: string): string {
  return `${value[0] === '0' ? '1' : '0'}${value.slice(1)}`
}

describe('CRM PIN lock', () => {
  it('sets and verifies a PIN without persisting the PIN or an unsafe owner key', async () => {
    const store = new MemoryKeyValueStore()
    const lock = createCrmLock(store, OWNER_ID, BACKUP_OPTIONS)

    expect(await lock.hasPin()).toBe(false)
    expect(await lock.verifyPin(PIN)).toBe(false)

    await lock.setPin(PIN)

    expect(await lock.hasPin()).toBe(true)
    expect(await lock.verifyPin(PIN)).toBe(true)
    expect(await lock.verifyPin(WRONG_PIN)).toBe(false)
    expect(store.values.size).toBe(1)

    const [key, stored] = [...store.values.entries()][0]!
    expect(key).toBe(expectedLockKey(OWNER_ID))
    expect(key).toMatch(/^crm-pin-lock-v1-[0-9a-f]{64}$/)
    const record = JSON.parse(stored) as CrmLockRecord
    expect(record.version).toBe(1)
    expect(record.iterations).toBe(TEST_ITERATIONS)
    expect(record.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(Object.keys(record).sort()).toEqual(['hash', 'iterations', 'salt', 'version'])
    expect(record).not.toHaveProperty('pin')
  })

  it('rejects PINs that are not 4 to 8 digits', async () => {
    const store = new MemoryKeyValueStore()
    const lock = createCrmLock(store, OWNER_ID, BACKUP_OPTIONS)

    for (const pin of ['', '123', '123456789', '12a4', ' 1234', '1234 ']) {
      await expect(lock.setPin(pin)).rejects.toThrow('CRM PIN must contain 4 to 8 digits.')
      await expect(lock.verifyPin(pin)).rejects.toThrow('CRM PIN must contain 4 to 8 digits.')
    }
    expect(await lock.hasPin()).toBe(false)
  })

  it('fails closed on malformed stored lock records and can clear them', async () => {
    const store = new MemoryKeyValueStore()
    const lock = createCrmLock(store, OWNER_ID, BACKUP_OPTIONS)
    await lock.setPin(PIN)
    const key = expectedLockKey(OWNER_ID)
    const validRecord = JSON.parse(store.values.get(key)!) as Record<string, unknown>
    const malformedRecords = [
      '{',
      JSON.stringify({ ...validRecord, version: 2 }),
      JSON.stringify({ ...validRecord, salt: 'not-hex' }),
      JSON.stringify({ ...validRecord, salt: '00' }),
      JSON.stringify({ ...validRecord, hash: '00' }),
      JSON.stringify({ ...validRecord, iterations: 0 }),
      JSON.stringify({ ...validRecord, iterations: TEST_ITERATIONS + 0.5 }),
      JSON.stringify({ ...validRecord, pin: PIN }),
      JSON.stringify({ version: 1, salt: validRecord.salt, hash: validRecord.hash }),
    ]

    for (const malformed of malformedRecords) {
      await store.setItem(key, malformed)
      await expect(lock.hasPin()).rejects.toThrow('CRM lock record')
      await expect(lock.verifyPin(PIN)).rejects.toThrow('CRM lock record')
    }

    await lock.clearPin()
    expect(await lock.hasPin()).toBe(false)
    expect(store.values.has(key)).toBe(false)
  })

  it('shares a deterministic lock per owner and clears only that owner', async () => {
    const store = new MemoryKeyValueStore()
    const firstOwnerLock = createCrmLock(store, OWNER_ID, BACKUP_OPTIONS)
    const sameOwnerLock = createCrmLock(store, OWNER_ID, BACKUP_OPTIONS)
    const otherOwnerLock = createCrmLock(store, OTHER_OWNER_ID, BACKUP_OPTIONS)

    await firstOwnerLock.setPin(PIN)
    await otherOwnerLock.setPin(WRONG_PIN)

    expect(await sameOwnerLock.hasPin()).toBe(true)
    expect(await sameOwnerLock.verifyPin(PIN)).toBe(true)
    expect(await otherOwnerLock.verifyPin(WRONG_PIN)).toBe(true)
    expect(store.values.size).toBe(2)

    await firstOwnerLock.clearPin()

    expect(await sameOwnerLock.hasPin()).toBe(false)
    expect(await otherOwnerLock.hasPin()).toBe(true)
    expect(await otherOwnerLock.verifyPin(WRONG_PIN)).toBe(true)
    expect(store.values.has(expectedLockKey(OWNER_ID))).toBe(false)
    expect(store.values.has(expectedLockKey(OTHER_OWNER_ID))).toBe(true)
  })

  it('rejects invalid test work factors and malformed random output', async () => {
    const store = new MemoryKeyValueStore()
    expect(() => createCrmLock(store, OWNER_ID, { iterations: 0 })).toThrow(
      'iterations must be an integer',
    )
    const lock = createCrmLock(store, OWNER_ID, {
      iterations: TEST_ITERATIONS,
      randomBytes: () => new Uint8Array(15),
    })
    await expect(lock.setPin(PIN)).rejects.toThrow('returned an invalid byte array')
  })
})

describe('encrypted CRM backups', () => {
  it('round-trips a complete dataset with fresh salt and IV and no plaintext leakage', () => {
    const dataset = createDataset()
    const payload = encryptCrmBackup(dataset, PIN, BACKUP_OPTIONS)
    const envelope = parseEnvelope(payload)

    expect(envelope).toMatchObject({
      format: ENCRYPTED_BACKUP_FORMAT,
      version: 1,
      owner_id: OWNER_ID,
      kdf: 'PBKDF2-SHA256',
      iterations: TEST_ITERATIONS,
    })
    expect(envelope.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(envelope.iv).toMatch(/^[0-9a-f]{24}$/)
    expect(envelope.ciphertext).toMatch(/^[0-9a-f]+$/)
    expect(envelope.ciphertext.length).toBeGreaterThanOrEqual(32)
    expect(payload).not.toContain(dataset.contacts[0]!.display_name)
    expect(payload).not.toContain(dataset.contacts[0]!.email)
    expect(payload).not.toContain(dataset.notes[0]!.body)
    expect(decryptCrmBackup(payload, PIN)).toEqual(dataset)
    expect(decryptCrmBackup(payload, PIN, { iterations: TEST_ITERATIONS })).toEqual(dataset)

    const secondPayload = encryptCrmBackup(dataset, PIN, BACKUP_OPTIONS)
    const secondEnvelope = parseEnvelope(secondPayload)
    expect(secondEnvelope.salt).not.toBe(envelope.salt)
    expect(secondEnvelope.iv).not.toBe(envelope.iv)
    expect(secondEnvelope.ciphertext).not.toBe(envelope.ciphertext)
  })

  it('rejects a wrong PIN and malformed PINs', () => {
    const payload = encryptCrmBackup(createDataset(), PIN, BACKUP_OPTIONS)

    expect(() => decryptCrmBackup(payload, WRONG_PIN)).toThrow(
      'CRM backup authentication failed; the PIN is wrong or the backup was tampered with.',
    )
    for (const pin of ['', '123', '123456789', '12a4']) {
      expect(() => decryptCrmBackup(payload, pin)).toThrow('CRM PIN must contain 4 to 8 digits.')
    }
  })

  it('rejects tampered ciphertext, IV, salt, iterations, and AAD owner binding', () => {
    const payload = encryptCrmBackup(createDataset(), PIN, BACKUP_OPTIONS)
    const envelope = parseEnvelope(payload)
    const tamperedPayloads = [
      { ...envelope, ciphertext: tamperHex(envelope.ciphertext) },
      { ...envelope, iv: tamperHex(envelope.iv) },
      { ...envelope, salt: tamperHex(envelope.salt) },
      { ...envelope, iterations: TEST_ITERATIONS + 1 },
      { ...envelope, owner_id: OTHER_OWNER_ID },
    ]

    for (const tampered of tamperedPayloads) {
      expect(() => decryptCrmBackup(JSON.stringify(tampered), PIN)).toThrow(
        'CRM backup authentication failed',
      )
    }
  })

  it('strictly rejects malformed envelope fields and hex lengths', () => {
    const payload = encryptCrmBackup(createDataset(), PIN, BACKUP_OPTIONS)
    expect(() => decryptCrmBackup('{', PIN)).toThrow('CRM backup envelope is not valid JSON.')
    expect(() => decryptCrmBackup('[]', PIN)).toThrow('CRM backup envelope is malformed.')

    const cases: Array<[string, (envelope: Record<string, unknown>) => void, RegExp]> = [
      ['missing owner', (envelope) => delete envelope.owner_id, /envelope is malformed/],
      [
        'extra field',
        (envelope) => {
          envelope.extra = true
        },
        /envelope is malformed/,
      ],
      [
        'format',
        (envelope) => {
          envelope.format = 'wrong'
        },
        /format is unsupported/,
      ],
      [
        'version',
        (envelope) => {
          envelope.version = 2
        },
        /version is unsupported/,
      ],
      [
        'owner',
        (envelope) => {
          envelope.owner_id = ''
        },
        /owner ID is invalid/,
      ],
      [
        'KDF',
        (envelope) => {
          envelope.kdf = 'scrypt'
        },
        /KDF is unsupported/,
      ],
      [
        'zero iterations',
        (envelope) => {
          envelope.iterations = 0
        },
        /iterations must be an integer/,
      ],
      [
        'fractional iterations',
        (envelope) => {
          envelope.iterations = 1.5
        },
        /iterations must be an integer/,
      ],
      [
        'excessive iterations',
        (envelope) => {
          envelope.iterations = 10_000_001
        },
        /iterations must be an integer/,
      ],
      [
        'non-hex salt',
        (envelope) => {
          envelope.salt = 'zz'.repeat(16)
        },
        /salt must contain exactly 16 bytes/,
      ],
      [
        'short salt',
        (envelope) => {
          envelope.salt = '00'.repeat(15)
        },
        /salt must contain exactly 16 bytes/,
      ],
      [
        'short IV',
        (envelope) => {
          envelope.iv = '00'.repeat(11)
        },
        /IV must contain exactly 12 bytes/,
      ],
      [
        'odd ciphertext',
        (envelope) => {
          envelope.ciphertext = (envelope.ciphertext as string).slice(0, -1)
        },
        /ciphertext must contain at least 16 bytes/,
      ],
      [
        'short ciphertext',
        (envelope) => {
          envelope.ciphertext = '00'.repeat(15)
        },
        /ciphertext must contain at least 16 bytes/,
      ],
      [
        'non-hex ciphertext',
        (envelope) => {
          envelope.ciphertext = `zz${(envelope.ciphertext as string).slice(2)}`
        },
        /ciphertext must contain at least 16 bytes/,
      ],
    ]

    for (const [name, mutate, expectedError] of cases) {
      const envelope = JSON.parse(payload) as Record<string, unknown>
      mutate(envelope)
      expect(() => decryptCrmBackup(JSON.stringify(envelope), PIN), name).toThrow(expectedError)
    }
  })

  it('honors and validates an explicitly expected iteration count', () => {
    const payload = encryptCrmBackup(createDataset(), PIN, BACKUP_OPTIONS)

    expect(() => decryptCrmBackup(payload, PIN, { iterations: TEST_ITERATIONS + 1 })).toThrow(
      'iterations do not match the expected value',
    )
    expect(() => decryptCrmBackup(payload, PIN, { iterations: 0 })).toThrow(
      'iterations must be an integer',
    )
  })

  it('authenticates before parsing and rejects malformed plaintext JSON', () => {
    const payload = encryptPlaintext('{not-json')

    expect(() => decryptCrmBackup(payload, PIN)).toThrow('CRM backup plaintext is not valid JSON.')
  })

  it('rejects malformed dataset shapes, versions, dates, IDs, and interaction kinds', () => {
    const dataset = createDataset()
    const contact = dataset.contacts[0]!
    const tag = dataset.tags[0]!
    const note = dataset.notes[0]!
    const task = dataset.tasks[0]!
    const interaction = dataset.interactions[0]!
    const cases: Array<[string, unknown, RegExp]> = [
      ['null dataset', null, /dataset is malformed/],
      ['extra dataset field', { ...dataset, extra: true }, /dataset is malformed/],
      ['wrong format', { ...dataset, format: 'wrong' }, /format is unsupported/],
      ['wrong version', { ...dataset, version: 2 }, /version is unsupported/],
      ['empty owner', { ...dataset, owner_id: '' }, /owner ID is invalid/],
      ['contacts not an array', { ...dataset, contacts: {} }, /contacts must be an array/],
      [
        'missing contact field',
        { ...dataset, contacts: [{ ...contact, email: undefined }] },
        /contacts\[0\] is malformed/,
      ],
      [
        'invalid export date',
        { ...dataset, exported_at: 'not-a-date' },
        /exported_at must be a valid ISO date-time/,
      ],
      [
        'impossible calendar date',
        { ...dataset, exported_at: '2026-02-30T10:00:00.000Z' },
        /exported_at must be a valid ISO date-time/,
      ],
      [
        'invalid deletion date',
        { ...dataset, contacts: [{ ...contact, deleted_at: 'yesterday' }] },
        /deleted_at must be a valid ISO date-time/,
      ],
      [
        'empty local ID',
        { ...dataset, contacts: [{ ...contact, local_id: '' }] },
        /local_id must be a non-empty string/,
      ],
      [
        'duplicate contact ID',
        { ...dataset, contacts: [contact, { ...contact }] },
        /local_id must be unique within contacts/,
      ],
      [
        'duplicate tag ID',
        { ...dataset, tags: [tag, { ...tag }] },
        /local_id must be unique within tags/,
      ],
      [
        'duplicate note ID',
        { ...dataset, notes: [note, { ...note }] },
        /local_id must be unique within notes/,
      ],
      [
        'duplicate task ID',
        { ...dataset, tasks: [task, { ...task }] },
        /local_id must be unique within tasks/,
      ],
      [
        'duplicate interaction ID',
        { ...dataset, interactions: [interaction, { ...interaction }] },
        /local_id must be unique within interactions/,
      ],
      [
        'invalid task boolean',
        { ...dataset, tasks: [{ ...task, completed: 'false' }] },
        /completed must be a boolean/,
      ],
      [
        'invalid interaction kind',
        { ...dataset, interactions: [{ ...interaction, kind: 'sms' }] },
        /kind is unsupported/,
      ],
    ]

    for (const [name, value, expectedError] of cases) {
      const payload = encryptDatasetValue(value)
      expect(() => decryptCrmBackup(payload, PIN), name).toThrow(expectedError)
    }
  })

  it('rejects cross-owner data and envelope/plaintext owner mismatches', () => {
    const dataset = createDataset()
    const otherOwnerDataset = datasetForOwner(OTHER_OWNER_ID)
    const entityOwnerMismatch = {
      ...otherOwnerDataset,
      owner_id: OWNER_ID,
    }
    const envelopeOwnerMismatch = otherOwnerDataset

    expect(() => decryptCrmBackup(encryptDatasetValue(entityOwnerMismatch, OWNER_ID), PIN)).toThrow(
      'does not match the dataset owner',
    )
    expect(() =>
      decryptCrmBackup(encryptDatasetValue(envelopeOwnerMismatch, OWNER_ID), PIN),
    ).toThrow('dataset owner does not match the authenticated envelope')

    const payload = encryptCrmBackup(dataset, PIN, BACKUP_OPTIONS)
    const envelope = parseEnvelope(payload)
    expect(() =>
      decryptCrmBackup(JSON.stringify({ ...envelope, owner_id: OTHER_OWNER_ID }), PIN),
    ).toThrow('CRM backup authentication failed')
  })

  it('rejects unknown tag and contact references', () => {
    const dataset = createDataset()
    const cases: Array<[string, unknown, RegExp]> = [
      [
        'unknown tag',
        {
          ...dataset,
          contacts: [{ ...dataset.contacts[0]!, tag_ids: ['missing_tag'] }],
        },
        /references an unknown tag/,
      ],
      [
        'duplicate tag reference',
        {
          ...dataset,
          contacts: [{ ...dataset.contacts[0]!, tag_ids: ['tag_1', 'tag_1'] }],
        },
        /tag_ids must be unique/,
      ],
      [
        'unknown note contact',
        { ...dataset, notes: [{ ...dataset.notes[0]!, contact_id: 'missing_contact' }] },
        /notes\[0\]\.contact_id references an unknown contact/,
      ],
      [
        'unknown task contact',
        { ...dataset, tasks: [{ ...dataset.tasks[0]!, contact_id: 'missing_contact' }] },
        /tasks\[0\]\.contact_id references an unknown contact/,
      ],
      [
        'unknown interaction contact',
        {
          ...dataset,
          interactions: [{ ...dataset.interactions[0]!, contact_id: 'missing_contact' }],
        },
        /interactions\[0\]\.contact_id references an unknown contact/,
      ],
    ]

    for (const [name, value, expectedError] of cases) {
      expect(() => decryptCrmBackup(encryptDatasetValue(value), PIN), name).toThrow(expectedError)
    }
  })
})
