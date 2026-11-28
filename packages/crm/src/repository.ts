import type { LocalDatabase, SqlValue } from '@superapp/local-db'
import type {
  CrmContact,
  CrmContactInput,
  CrmContactQuery,
  CrmDataset,
  CrmInteraction,
  CrmInteractionInput,
  CrmInteractionKind,
  CrmNote,
  CrmNoteInput,
  CrmOwnerId,
  CrmTag,
  CrmTagInput,
  CrmTask,
  CrmTaskInput,
  CrmTaskQuery,
} from './types'

interface CrmRepositoryOptions {
  now?: () => Date
  idFactory?: () => string
}

interface ContactRow {
  owner_id: string
  local_id: string
  display_name: string
  phone: string | null
  email: string | null
  tags_json: string
  notes_json: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface TagRow {
  owner_id: string
  local_id: string
  title: string
  color: string
  created_at: string
  updated_at: string
}

interface NoteRow {
  owner_id: string
  local_id: string
  contact_id: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface TaskRow {
  owner_id: string
  local_id: string
  contact_id: string | null
  title: string
  due_at: string | null
  completed: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface InteractionRow {
  owner_id: string
  local_id: string
  contact_id: string
  kind: CrmInteractionKind
  summary: string
  occurred_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type CrmTable = 'crm_contacts' | 'crm_tags' | 'crm_notes' | 'crm_tasks' | 'crm_interactions'
type ImportCollection = 'contacts' | 'tags' | 'notes' | 'tasks' | 'interactions'
type CrmContactUpdateInput = Partial<CrmContactInput> & Pick<CrmContactInput, 'display_name'>
type CrmTagUpdateInput = Partial<CrmTagInput> & Pick<CrmTagInput, 'title'>
type CrmNoteUpdateInput = Partial<CrmNoteInput> & Pick<CrmNoteInput, 'contact_id' | 'body'>
type CrmTaskUpdateInput = Partial<CrmTaskInput> & Pick<CrmTaskInput, 'title'>
type CrmInteractionUpdateInput = Partial<CrmInteractionInput> &
  Pick<CrmInteractionInput, 'contact_id' | 'kind' | 'summary'>

const INTERACTION_KINDS: readonly CrmInteractionKind[] = [
  'call',
  'message',
  'meeting',
  'email',
  'other',
]

const DATASET_KEYS = [
  'contacts',
  'exported_at',
  'format',
  'interactions',
  'notes',
  'owner_id',
  'tasks',
  'tags',
  'version',
]

const IMPORT_KEYS: Record<ImportCollection, readonly string[]> = {
  contacts: [
    'created_at',
    'deleted_at',
    'display_name',
    'email',
    'local_id',
    'owner_id',
    'phone',
    'tag_ids',
    'updated_at',
  ],
  tags: ['color', 'created_at', 'local_id', 'owner_id', 'title', 'updated_at'],
  notes: ['body', 'contact_id', 'created_at', 'deleted_at', 'local_id', 'owner_id', 'updated_at'],
  tasks: [
    'completed',
    'contact_id',
    'created_at',
    'deleted_at',
    'due_at',
    'local_id',
    'owner_id',
    'title',
    'updated_at',
  ],
  interactions: [
    'contact_id',
    'created_at',
    'deleted_at',
    'kind',
    'local_id',
    'occurred_at',
    'owner_id',
    'summary',
    'updated_at',
  ],
}

const IMPORT_TABLES: Record<ImportCollection, CrmTable> = {
  contacts: 'crm_contacts',
  tags: 'crm_tags',
  notes: 'crm_notes',
  tasks: 'crm_tasks',
  interactions: 'crm_interactions',
}

function defaultIdFactory() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `crm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required.`)
  }
  return value
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null.`)
  return value
}

function normalizeTimestamp(value: unknown, label: string, allowDateOnly = false): string {
  const timestamp = requireString(value, label)
  const dateOnlyInput = /^\d{4}-\d{2}-\d{2}$/.test(timestamp)
  const date = new Date(allowDateOnly && dateOnlyInput ? `${timestamp}T00:00:00.000Z` : timestamp)
  if (
    Number.isNaN(date.getTime()) ||
    (dateOnlyInput && date.toISOString().slice(0, 10) !== timestamp)
  ) {
    throw new Error(`${label} must be a valid date-time.`)
  }
  return date.toISOString()
}

function nullableTimestamp(value: unknown, label: string, dateOnly = false): string | null {
  return value === null ? null : normalizeTimestamp(value, label, dateOnly)
}

function normalizeTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Contact tag IDs must be an array.')
  const tagIds = value.map((tagId) => requireString(tagId, 'Contact tag ID'))
  if (new Set(tagIds).size !== tagIds.length) {
    throw new Error('Contact tag IDs must be unique.')
  }
  return tagIds
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`)
  return value
}

function requireKind(value: unknown): CrmInteractionKind {
  if (!INTERACTION_KINDS.includes(value as CrmInteractionKind)) {
    throw new Error('Interaction kind is invalid.')
  }
  return value as CrmInteractionKind
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function parseOffset(cursor?: string) {
  const match = /^offset_(\d+)$/.exec(cursor || '')
  if (!match) return 0
  const offset = Number(match[1])
  return Number.isSafeInteger(offset) ? offset : 0
}

function pageLimit(limit?: number) {
  if (limit === undefined || !Number.isFinite(limit)) return 30
  return Math.min(Math.max(Math.floor(limit), 1), 100)
}

function parseTagIds(value: string): string[] {
  return JSON.parse(value) as string[]
}

function toContact(row: ContactRow): CrmContact {
  return {
    local_id: row.local_id,
    owner_id: row.owner_id,
    display_name: row.display_name,
    phone: row.phone,
    email: row.email,
    tag_ids: parseTagIds(row.tags_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

function toTag(row: TagRow): CrmTag {
  return {
    local_id: row.local_id,
    owner_id: row.owner_id,
    title: row.title,
    color: row.color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function toNote(row: NoteRow): CrmNote {
  return {
    local_id: row.local_id,
    owner_id: row.owner_id,
    contact_id: row.contact_id,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

function toTask(row: TaskRow): CrmTask {
  return {
    local_id: row.local_id,
    owner_id: row.owner_id,
    contact_id: row.contact_id,
    title: row.title,
    due_at: row.due_at,
    completed: row.completed === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

function toInteraction(row: InteractionRow): CrmInteraction {
  return {
    local_id: row.local_id,
    owner_id: row.owner_id,
    contact_id: row.contact_id,
    kind: row.kind,
    summary: row.summary,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function requireExactKeys(record: Record<string, unknown>, keys: readonly string[], label: string) {
  const actualKeys = Object.keys(record).sort()
  const expectedKeys = [...keys].sort()
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(`${label} has invalid fields.`)
  }
}

function requireRecordOwner(record: Record<string, unknown>, ownerId: CrmOwnerId, label: string) {
  if (record.owner_id !== ownerId) throw new Error(`${label} owner does not match.`)
}

function validateImportedContact(value: unknown, ownerId: CrmOwnerId): CrmContact {
  const record = requireRecord(value, 'CRM backup contact')
  requireExactKeys(record, IMPORT_KEYS.contacts, 'CRM backup contact')
  requireRecordOwner(record, ownerId, 'CRM backup contact')
  return {
    local_id: requireString(record.local_id, 'CRM backup contact ID'),
    owner_id: ownerId,
    display_name: requireString(record.display_name, 'CRM backup contact name'),
    phone: nullableString(record.phone, 'CRM backup contact phone'),
    email: nullableString(record.email, 'CRM backup contact email'),
    tag_ids: normalizeTagIds(record.tag_ids),
    created_at: requireString(record.created_at, 'CRM backup contact created timestamp'),
    updated_at: requireString(record.updated_at, 'CRM backup contact updated timestamp'),
    deleted_at:
      record.deleted_at === null
        ? null
        : requireString(record.deleted_at, 'CRM backup contact deleted timestamp'),
  }
}

function validateImportedTag(value: unknown, ownerId: CrmOwnerId): CrmTag {
  const record = requireRecord(value, 'CRM backup tag')
  requireExactKeys(record, IMPORT_KEYS.tags, 'CRM backup tag')
  requireRecordOwner(record, ownerId, 'CRM backup tag')
  return {
    local_id: requireString(record.local_id, 'CRM backup tag ID'),
    owner_id: ownerId,
    title: requireString(record.title, 'CRM backup tag title'),
    color: requireString(record.color, 'CRM backup tag color'),
    created_at: requireString(record.created_at, 'CRM backup tag created timestamp'),
    updated_at: requireString(record.updated_at, 'CRM backup tag updated timestamp'),
  }
}

function validateImportedNote(value: unknown, ownerId: CrmOwnerId): CrmNote {
  const record = requireRecord(value, 'CRM backup note')
  requireExactKeys(record, IMPORT_KEYS.notes, 'CRM backup note')
  requireRecordOwner(record, ownerId, 'CRM backup note')
  return {
    local_id: requireString(record.local_id, 'CRM backup note ID'),
    owner_id: ownerId,
    contact_id: requireString(record.contact_id, 'CRM backup note contact ID'),
    body: requireString(record.body, 'CRM backup note body'),
    created_at: requireString(record.created_at, 'CRM backup note created timestamp'),
    updated_at: requireString(record.updated_at, 'CRM backup note updated timestamp'),
    deleted_at:
      record.deleted_at === null
        ? null
        : requireString(record.deleted_at, 'CRM backup note deleted timestamp'),
  }
}

function validateImportedTask(value: unknown, ownerId: CrmOwnerId): CrmTask {
  const record = requireRecord(value, 'CRM backup task')
  requireExactKeys(record, IMPORT_KEYS.tasks, 'CRM backup task')
  requireRecordOwner(record, ownerId, 'CRM backup task')
  return {
    local_id: requireString(record.local_id, 'CRM backup task ID'),
    owner_id: ownerId,
    contact_id:
      record.contact_id === null
        ? null
        : requireString(record.contact_id, 'CRM backup task contact ID'),
    title: requireString(record.title, 'CRM backup task title'),
    due_at:
      record.due_at === null ? null : requireString(record.due_at, 'CRM backup task due timestamp'),
    completed: requireBoolean(record.completed, 'CRM backup task completion'),
    created_at: requireString(record.created_at, 'CRM backup task created timestamp'),
    updated_at: requireString(record.updated_at, 'CRM backup task updated timestamp'),
    deleted_at:
      record.deleted_at === null
        ? null
        : requireString(record.deleted_at, 'CRM backup task deleted timestamp'),
  }
}

function validateImportedInteraction(value: unknown, ownerId: CrmOwnerId): CrmInteraction {
  const record = requireRecord(value, 'CRM backup interaction')
  requireExactKeys(record, IMPORT_KEYS.interactions, 'CRM backup interaction')
  requireRecordOwner(record, ownerId, 'CRM backup interaction')
  return {
    local_id: requireString(record.local_id, 'CRM backup interaction ID'),
    owner_id: ownerId,
    contact_id: requireString(record.contact_id, 'CRM backup interaction contact ID'),
    kind: requireKind(record.kind),
    summary: requireString(record.summary, 'CRM backup interaction summary'),
    occurred_at: requireString(record.occurred_at, 'CRM backup interaction timestamp'),
    created_at: requireString(record.created_at, 'CRM backup interaction created timestamp'),
    updated_at: requireString(record.updated_at, 'CRM backup interaction updated timestamp'),
    deleted_at:
      record.deleted_at === null
        ? null
        : requireString(record.deleted_at, 'CRM backup interaction deleted timestamp'),
  }
}

function validateDataset(value: unknown, ownerId: CrmOwnerId): CrmDataset {
  const record = requireRecord(value, 'CRM backup')
  requireExactKeys(record, DATASET_KEYS, 'CRM backup')
  if (record.format !== 'superapp.crm.backup') throw new Error('CRM backup format is invalid.')
  if (record.version !== 1) throw new Error('CRM backup version is invalid.')
  requireRecordOwner(record, ownerId, 'CRM backup')
  const exportedAt = requireString(record.exported_at, 'CRM backup export timestamp')

  const arrays: Record<ImportCollection, unknown[]> = {
    contacts: requireArray(record.contacts, 'CRM backup contacts'),
    tags: requireArray(record.tags, 'CRM backup tags'),
    notes: requireArray(record.notes, 'CRM backup notes'),
    tasks: requireArray(record.tasks, 'CRM backup tasks'),
    interactions: requireArray(record.interactions, 'CRM backup interactions'),
  }

  const dataset: CrmDataset = {
    format: 'superapp.crm.backup',
    version: 1,
    exported_at: exportedAt,
    owner_id: ownerId,
    contacts: arrays.contacts.map((contact) => validateImportedContact(contact, ownerId)),
    tags: arrays.tags.map((tag) => validateImportedTag(tag, ownerId)),
    notes: arrays.notes.map((note) => validateImportedNote(note, ownerId)),
    tasks: arrays.tasks.map((task) => validateImportedTask(task, ownerId)),
    interactions: arrays.interactions.map((interaction) =>
      validateImportedInteraction(interaction, ownerId),
    ),
  }

  const collections: Record<ImportCollection, Array<{ local_id: string }>> = {
    contacts: dataset.contacts,
    tags: dataset.tags,
    notes: dataset.notes,
    tasks: dataset.tasks,
    interactions: dataset.interactions,
  }
  for (const [collection, records] of Object.entries(collections)) {
    const ids = new Set<string>()
    for (const record of records) {
      if (ids.has(record.local_id)) {
        throw new Error(`CRM backup ${collection} IDs must be unique.`)
      }
      ids.add(record.local_id)
    }
  }

  return dataset
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value
}

export class CrmRepository {
  private readonly now: () => Date
  private readonly idFactory: () => string

  constructor(
    private readonly database: LocalDatabase,
    options: CrmRepositoryOptions = {},
  ) {
    this.now = options.now || (() => new Date())
    this.idFactory = options.idFactory || defaultIdFactory
  }

  private timestamp() {
    return this.now().toISOString()
  }

  private async existingIds(database: LocalDatabase, ownerId: string, table: CrmTable) {
    const rows = await database.all<{ local_id: string }>(
      `SELECT local_id FROM ${table} WHERE owner_id = ?`,
      [ownerId],
    )
    return new Set(rows.map((row) => row.local_id))
  }

  private async nextId(database: LocalDatabase, ownerId: string, table: CrmTable) {
    const localId = requireString(this.idFactory(), 'CRM ID')
    const ids = await this.existingIds(database, ownerId, table)
    if (ids.has(localId)) throw new Error(`CRM ${table} ID must be unique.`)
    return localId
  }

  private async requireOwnedTag(database: LocalDatabase, ownerId: string, tagId: string) {
    const tag = await database.get<TagRow>(
      'SELECT * FROM crm_tags WHERE owner_id = ? AND local_id = ?',
      [ownerId, tagId],
    )
    if (!tag) throw new Error(`Tag ${tagId} was not found for this owner.`)
  }

  private async requireOwnedTags(database: LocalDatabase, ownerId: string, tagIds: string[]) {
    for (const tagId of tagIds) await this.requireOwnedTag(database, ownerId, tagId)
  }

  private async requireOwnedContact(database: LocalDatabase, ownerId: string, contactId: string) {
    const contact = await database.get<ContactRow>(
      `SELECT * FROM crm_contacts
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [ownerId, contactId],
    )
    if (!contact) throw new Error(`Contact ${contactId} was not found for this owner.`)
  }

  private async insertContact(database: LocalDatabase, contact: CrmContact) {
    await database.run(
      `INSERT INTO crm_contacts (
        owner_id, local_id, display_name, phone, email, tags_json,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contact.owner_id,
        contact.local_id,
        contact.display_name,
        contact.phone,
        contact.email,
        JSON.stringify(contact.tag_ids),
        contact.created_at,
        contact.updated_at,
        contact.deleted_at,
      ],
    )
  }

  private async insertTag(database: LocalDatabase, tag: CrmTag) {
    await database.run(
      `INSERT INTO crm_tags (owner_id, local_id, title, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tag.owner_id, tag.local_id, tag.title, tag.color, tag.created_at, tag.updated_at],
    )
  }

  private async insertNote(database: LocalDatabase, note: CrmNote) {
    await database.run(
      `INSERT INTO crm_notes (
        owner_id, local_id, contact_id, body, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        note.owner_id,
        note.local_id,
        note.contact_id,
        note.body,
        note.created_at,
        note.updated_at,
        note.deleted_at,
      ],
    )
  }

  private async insertTask(database: LocalDatabase, task: CrmTask) {
    await database.run(
      `INSERT INTO crm_tasks (
        owner_id, local_id, contact_id, title, due_at, completed,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.owner_id,
        task.local_id,
        task.contact_id,
        task.title,
        task.due_at,
        task.completed ? 1 : 0,
        task.created_at,
        task.updated_at,
        task.deleted_at,
      ],
    )
  }

  private async insertInteraction(database: LocalDatabase, interaction: CrmInteraction) {
    await database.run(
      `INSERT INTO crm_interactions (
        owner_id, local_id, contact_id, kind, summary, occurred_at,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        interaction.owner_id,
        interaction.local_id,
        interaction.contact_id,
        interaction.kind,
        interaction.summary,
        interaction.occurred_at,
        interaction.created_at,
        interaction.updated_at,
        interaction.deleted_at,
      ],
    )
  }

  async listContacts(
    ownerId: CrmOwnerId,
    query: CrmContactQuery = {},
  ): Promise<{ items: CrmContact[]; next_cursor: string | null; has_more: boolean }> {
    requireString(ownerId, 'CRM owner ID')
    const conditions = ['owner_id = ?', 'deleted_at IS NULL']
    const params: SqlValue[] = [ownerId]
    const search = query.search?.trim()
    if (search) {
      conditions.push(
        `(display_name LIKE ? ESCAPE '\\'
          OR COALESCE(phone, '') LIKE ? ESCAPE '\\'
          OR COALESCE(email, '') LIKE ? ESCAPE '\\')`,
      )
      const pattern = `%${escapeLike(search)}%`
      params.push(pattern, pattern, pattern)
    }
    if (query.tagId !== undefined) {
      conditions.push(
        `EXISTS (
          SELECT 1 FROM json_each(crm_contacts.tags_json) AS contact_tag
          WHERE contact_tag.value = ?
        )`,
      )
      params.push(requireString(query.tagId, 'Contact tag ID'))
    }

    const limit = pageLimit(query.limit)
    const offset = parseOffset(query.cursor)
    params.push(limit + 1, offset)
    const rows = await this.database.all<ContactRow>(
      `SELECT * FROM crm_contacts
       WHERE ${conditions.join(' AND ')}
       ORDER BY display_name ASC, local_id ASC
       LIMIT ? OFFSET ?`,
      params,
    )
    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map(toContact)
    return {
      items,
      next_cursor: hasMore ? `offset_${offset + items.length}` : null,
      has_more: hasMore,
    }
  }

  async getContact(ownerId: CrmOwnerId, localId: string): Promise<CrmContact | null> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Contact ID')
    const row = await this.database.get<ContactRow>(
      `SELECT * FROM crm_contacts
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [ownerId, localId],
    )
    return row ? toContact(row) : null
  }

  async createContact(ownerId: CrmOwnerId, input: CrmContactInput): Promise<CrmContact> {
    requireString(ownerId, 'CRM owner ID')
    const displayName = requireString(input.display_name, 'Contact display name')
    const phone = input.phone == null ? null : nullableString(input.phone, 'Contact phone')
    const email = input.email == null ? null : nullableString(input.email, 'Contact email')
    const tagIds = normalizeTagIds(input.tag_ids ?? [])
    await this.requireOwnedTags(this.database, ownerId, tagIds)
    const localId = await this.nextId(this.database, ownerId, 'crm_contacts')
    const timestamp = this.timestamp()
    const contact: CrmContact = {
      local_id: localId,
      owner_id: ownerId,
      display_name: displayName,
      phone,
      email,
      tag_ids: tagIds,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }
    await this.insertContact(this.database, contact)
    return contact
  }

  async updateContact(
    ownerId: CrmOwnerId,
    localId: string,
    input: CrmContactUpdateInput,
  ): Promise<CrmContact> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Contact ID')
    const current = await this.getContact(ownerId, localId)
    if (!current) throw new Error(`Contact ${localId} was not found for this owner.`)
    const contact: CrmContact = {
      ...current,
      display_name: requireString(input.display_name, 'Contact display name'),
      phone:
        input.phone === undefined
          ? current.phone
          : input.phone === null
            ? null
            : nullableString(input.phone, 'Contact phone'),
      email:
        input.email === undefined
          ? current.email
          : input.email === null
            ? null
            : nullableString(input.email, 'Contact email'),
      tag_ids: input.tag_ids === undefined ? current.tag_ids : normalizeTagIds(input.tag_ids),
      updated_at: this.timestamp(),
    }
    await this.requireOwnedTags(this.database, ownerId, contact.tag_ids)
    await this.database.run(
      `UPDATE crm_contacts
       SET display_name = ?, phone = ?, email = ?, tags_json = ?, updated_at = ?
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [
        contact.display_name,
        contact.phone,
        contact.email,
        JSON.stringify(contact.tag_ids),
        contact.updated_at,
        ownerId,
        localId,
      ],
    )
    return contact
  }

  async deleteContact(ownerId: CrmOwnerId, localId: string): Promise<void> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Contact ID')
    await this.database.transaction(async (transaction) => {
      const contact = await transaction.get<ContactRow>(
        `SELECT * FROM crm_contacts
         WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
        [ownerId, localId],
      )
      if (!contact) return
      const deletedAt = this.timestamp()
      await transaction.run(
        `UPDATE crm_contacts SET deleted_at = ?, updated_at = ?
         WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
        [deletedAt, deletedAt, ownerId, localId],
      )
      for (const table of ['crm_notes', 'crm_tasks', 'crm_interactions'] as const) {
        await transaction.run(
          `UPDATE ${table} SET deleted_at = ?, updated_at = ?
           WHERE owner_id = ? AND contact_id = ? AND deleted_at IS NULL`,
          [deletedAt, deletedAt, ownerId, localId],
        )
      }
    })
  }

  async listTags(ownerId: CrmOwnerId): Promise<CrmTag[]> {
    requireString(ownerId, 'CRM owner ID')
    const rows = await this.database.all<TagRow>(
      'SELECT * FROM crm_tags WHERE owner_id = ? ORDER BY title ASC, local_id ASC',
      [ownerId],
    )
    return rows.map(toTag)
  }

  async getTag(ownerId: CrmOwnerId, localId: string): Promise<CrmTag | null> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Tag ID')
    const row = await this.database.get<TagRow>(
      'SELECT * FROM crm_tags WHERE owner_id = ? AND local_id = ?',
      [ownerId, localId],
    )
    return row ? toTag(row) : null
  }

  async createTag(ownerId: CrmOwnerId, input: CrmTagInput): Promise<CrmTag> {
    requireString(ownerId, 'CRM owner ID')
    const title = requireString(input.title, 'Tag title')
    const color = input.color === undefined ? '#64748b' : requireString(input.color, 'Tag color')
    const localId = await this.nextId(this.database, ownerId, 'crm_tags')
    const timestamp = this.timestamp()
    const tag: CrmTag = {
      local_id: localId,
      owner_id: ownerId,
      title,
      color,
      created_at: timestamp,
      updated_at: timestamp,
    }
    await this.insertTag(this.database, tag)
    return tag
  }

  async updateTag(ownerId: CrmOwnerId, localId: string, input: CrmTagUpdateInput): Promise<CrmTag> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Tag ID')
    const current = await this.getTag(ownerId, localId)
    if (!current) throw new Error(`Tag ${localId} was not found for this owner.`)
    const tag: CrmTag = {
      ...current,
      title: requireString(input.title, 'Tag title'),
      color: input.color === undefined ? current.color : requireString(input.color, 'Tag color'),
      updated_at: this.timestamp(),
    }
    await this.database.run(
      `UPDATE crm_tags SET title = ?, color = ?, updated_at = ?
       WHERE owner_id = ? AND local_id = ?`,
      [tag.title, tag.color, tag.updated_at, ownerId, localId],
    )
    return tag
  }

  async deleteTag(ownerId: CrmOwnerId, localId: string): Promise<void> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Tag ID')
    await this.database.transaction(async (transaction) => {
      const tag = await transaction.get<TagRow>(
        'SELECT * FROM crm_tags WHERE owner_id = ? AND local_id = ?',
        [ownerId, localId],
      )
      if (!tag) return
      const timestamp = this.timestamp()
      const contacts = await transaction.all<ContactRow>(
        'SELECT * FROM crm_contacts WHERE owner_id = ?',
        [ownerId],
      )
      for (const contact of contacts) {
        const tagIds = parseTagIds(contact.tags_json)
        if (!tagIds.includes(localId)) continue
        await transaction.run(
          `UPDATE crm_contacts SET tags_json = ?, updated_at = ?
           WHERE owner_id = ? AND local_id = ?`,
          [
            JSON.stringify(tagIds.filter((tagId) => tagId !== localId)),
            timestamp,
            ownerId,
            contact.local_id,
          ],
        )
      }
      await transaction.run('DELETE FROM crm_tags WHERE owner_id = ? AND local_id = ?', [
        ownerId,
        localId,
      ])
    })
  }

  async listNotes(ownerId: CrmOwnerId, contactId?: string): Promise<CrmNote[]> {
    requireString(ownerId, 'CRM owner ID')
    const conditions = [
      'note.owner_id = ?',
      'note.deleted_at IS NULL',
      `EXISTS (
        SELECT 1 FROM crm_contacts AS contact
        WHERE contact.owner_id = note.owner_id
          AND contact.local_id = note.contact_id
          AND contact.deleted_at IS NULL
      )`,
    ]
    const params: SqlValue[] = [ownerId]
    if (contactId !== undefined) {
      conditions.push('note.contact_id = ?')
      params.push(requireString(contactId, 'Contact ID'))
    }
    const rows = await this.database.all<NoteRow>(
      `SELECT note.* FROM crm_notes AS note
       WHERE ${conditions.join(' AND ')}
       ORDER BY note.created_at DESC, note.local_id DESC`,
      params,
    )
    return rows.map(toNote)
  }

  async getNote(ownerId: CrmOwnerId, localId: string): Promise<CrmNote | null> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Note ID')
    const row = await this.database.get<NoteRow>(
      `SELECT note.* FROM crm_notes AS note
       WHERE note.owner_id = ? AND note.local_id = ? AND note.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM crm_contacts AS contact
           WHERE contact.owner_id = note.owner_id
             AND contact.local_id = note.contact_id
             AND contact.deleted_at IS NULL
         )`,
      [ownerId, localId],
    )
    return row ? toNote(row) : null
  }

  async createNote(ownerId: CrmOwnerId, input: CrmNoteInput): Promise<CrmNote> {
    requireString(ownerId, 'CRM owner ID')
    const contactId = requireString(input.contact_id, 'Note contact ID')
    const body = requireString(input.body, 'Note body')
    await this.requireOwnedContact(this.database, ownerId, contactId)
    const localId = await this.nextId(this.database, ownerId, 'crm_notes')
    const timestamp = this.timestamp()
    const note: CrmNote = {
      local_id: localId,
      owner_id: ownerId,
      contact_id: contactId,
      body,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }
    await this.insertNote(this.database, note)
    return note
  }

  async updateNote(
    ownerId: CrmOwnerId,
    localId: string,
    input: CrmNoteUpdateInput,
  ): Promise<CrmNote> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Note ID')
    const current = await this.getNote(ownerId, localId)
    if (!current) throw new Error(`Note ${localId} was not found for this owner.`)
    const note: CrmNote = {
      ...current,
      contact_id: requireString(input.contact_id, 'Note contact ID'),
      body: requireString(input.body, 'Note body'),
      updated_at: this.timestamp(),
    }
    await this.requireOwnedContact(this.database, ownerId, note.contact_id)
    await this.database.run(
      `UPDATE crm_notes SET contact_id = ?, body = ?, updated_at = ?
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [note.contact_id, note.body, note.updated_at, ownerId, localId],
    )
    return note
  }

  async deleteNote(ownerId: CrmOwnerId, localId: string): Promise<void> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Note ID')
    const deletedAt = this.timestamp()
    await this.database.run(
      `UPDATE crm_notes SET deleted_at = ?, updated_at = ?
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [deletedAt, deletedAt, ownerId, localId],
    )
  }

  async listTasks(ownerId: CrmOwnerId, query: CrmTaskQuery = {}): Promise<CrmTask[]> {
    requireString(ownerId, 'CRM owner ID')
    const conditions = [
      'task.owner_id = ?',
      'task.deleted_at IS NULL',
      `(task.contact_id IS NULL OR EXISTS (
        SELECT 1 FROM crm_contacts AS contact
        WHERE contact.owner_id = task.owner_id
          AND contact.local_id = task.contact_id
          AND contact.deleted_at IS NULL
      ))`,
    ]
    const params: SqlValue[] = [ownerId]
    if (query.contactId !== undefined) {
      conditions.push('task.contact_id = ?')
      params.push(requireString(query.contactId, 'Contact ID'))
    }
    if (query.completed !== undefined) {
      conditions.push('task.completed = ?')
      params.push(requireBoolean(query.completed, 'Task completion filter') ? 1 : 0)
    }
    const rows = await this.database.all<TaskRow>(
      `SELECT task.* FROM crm_tasks AS task
       WHERE ${conditions.join(' AND ')}
       ORDER BY task.completed ASC, task.due_at IS NULL ASC, task.due_at ASC,
                task.title ASC, task.local_id ASC`,
      params,
    )
    return rows.map(toTask)
  }

  async getTask(ownerId: CrmOwnerId, localId: string): Promise<CrmTask | null> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Task ID')
    const row = await this.database.get<TaskRow>(
      `SELECT task.* FROM crm_tasks AS task
       WHERE task.owner_id = ? AND task.local_id = ? AND task.deleted_at IS NULL
         AND (task.contact_id IS NULL OR EXISTS (
           SELECT 1 FROM crm_contacts AS contact
           WHERE contact.owner_id = task.owner_id
             AND contact.local_id = task.contact_id
             AND contact.deleted_at IS NULL
         ))`,
      [ownerId, localId],
    )
    return row ? toTask(row) : null
  }

  async createTask(ownerId: CrmOwnerId, input: CrmTaskInput): Promise<CrmTask> {
    requireString(ownerId, 'CRM owner ID')
    const title = requireString(input.title, 'Task title')
    const contactId =
      input.contact_id == null ? null : requireString(input.contact_id, 'Task contact ID')
    if (contactId) await this.requireOwnedContact(this.database, ownerId, contactId)
    const dueAt =
      input.due_at === undefined
        ? null
        : nullableTimestamp(input.due_at, 'Task due timestamp', true)
    const completed =
      input.completed === undefined ? false : requireBoolean(input.completed, 'Task completion')
    const localId = await this.nextId(this.database, ownerId, 'crm_tasks')
    const timestamp = this.timestamp()
    const task: CrmTask = {
      local_id: localId,
      owner_id: ownerId,
      contact_id: contactId,
      title,
      due_at: dueAt,
      completed,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }
    await this.insertTask(this.database, task)
    return task
  }

  async updateTask(
    ownerId: CrmOwnerId,
    localId: string,
    input: CrmTaskUpdateInput,
  ): Promise<CrmTask> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Task ID')
    const current = await this.getTask(ownerId, localId)
    if (!current) throw new Error(`Task ${localId} was not found for this owner.`)
    const task: CrmTask = {
      ...current,
      contact_id:
        input.contact_id === undefined
          ? current.contact_id
          : input.contact_id === null
            ? null
            : requireString(input.contact_id, 'Task contact ID'),
      title: requireString(input.title, 'Task title'),
      due_at:
        input.due_at === undefined
          ? current.due_at
          : nullableTimestamp(input.due_at, 'Task due timestamp', true),
      completed:
        input.completed === undefined
          ? current.completed
          : requireBoolean(input.completed, 'Task completion'),
      updated_at: this.timestamp(),
    }
    if (task.contact_id) await this.requireOwnedContact(this.database, ownerId, task.contact_id)
    await this.database.run(
      `UPDATE crm_tasks
       SET contact_id = ?, title = ?, due_at = ?, completed = ?, updated_at = ?
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [
        task.contact_id,
        task.title,
        task.due_at,
        task.completed ? 1 : 0,
        task.updated_at,
        ownerId,
        localId,
      ],
    )
    return task
  }

  async deleteTask(ownerId: CrmOwnerId, localId: string): Promise<void> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Task ID')
    const deletedAt = this.timestamp()
    await this.database.run(
      `UPDATE crm_tasks SET deleted_at = ?, updated_at = ?
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [deletedAt, deletedAt, ownerId, localId],
    )
  }

  async listInteractions(ownerId: CrmOwnerId, contactId?: string): Promise<CrmInteraction[]> {
    requireString(ownerId, 'CRM owner ID')
    const conditions = [
      'interaction.owner_id = ?',
      'interaction.deleted_at IS NULL',
      `EXISTS (
        SELECT 1 FROM crm_contacts AS contact
        WHERE contact.owner_id = interaction.owner_id
          AND contact.local_id = interaction.contact_id
          AND contact.deleted_at IS NULL
      )`,
    ]
    const params: SqlValue[] = [ownerId]
    if (contactId !== undefined) {
      conditions.push('interaction.contact_id = ?')
      params.push(requireString(contactId, 'Contact ID'))
    }
    const rows = await this.database.all<InteractionRow>(
      `SELECT interaction.* FROM crm_interactions AS interaction
       WHERE ${conditions.join(' AND ')}
       ORDER BY interaction.occurred_at DESC, interaction.local_id DESC`,
      params,
    )
    return rows.map(toInteraction)
  }

  async getInteraction(ownerId: CrmOwnerId, localId: string): Promise<CrmInteraction | null> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Interaction ID')
    const row = await this.database.get<InteractionRow>(
      `SELECT interaction.* FROM crm_interactions AS interaction
       WHERE interaction.owner_id = ? AND interaction.local_id = ?
         AND interaction.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM crm_contacts AS contact
           WHERE contact.owner_id = interaction.owner_id
             AND contact.local_id = interaction.contact_id
             AND contact.deleted_at IS NULL
         )`,
      [ownerId, localId],
    )
    return row ? toInteraction(row) : null
  }

  async createInteraction(
    ownerId: CrmOwnerId,
    input: CrmInteractionInput,
  ): Promise<CrmInteraction> {
    requireString(ownerId, 'CRM owner ID')
    const contactId = requireString(input.contact_id, 'Interaction contact ID')
    const kind = requireKind(input.kind)
    const summary = requireString(input.summary, 'Interaction summary')
    await this.requireOwnedContact(this.database, ownerId, contactId)
    const localId = await this.nextId(this.database, ownerId, 'crm_interactions')
    const timestamp = this.timestamp()
    const interaction: CrmInteraction = {
      local_id: localId,
      owner_id: ownerId,
      contact_id: contactId,
      kind,
      summary,
      occurred_at:
        input.occurred_at === undefined
          ? timestamp
          : normalizeTimestamp(input.occurred_at, 'Interaction timestamp'),
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    }
    await this.insertInteraction(this.database, interaction)
    return interaction
  }

  async updateInteraction(
    ownerId: CrmOwnerId,
    localId: string,
    input: CrmInteractionUpdateInput,
  ): Promise<CrmInteraction> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Interaction ID')
    const current = await this.getInteraction(ownerId, localId)
    if (!current) throw new Error(`Interaction ${localId} was not found for this owner.`)
    const interaction: CrmInteraction = {
      ...current,
      contact_id: requireString(input.contact_id, 'Interaction contact ID'),
      kind: requireKind(input.kind),
      summary: requireString(input.summary, 'Interaction summary'),
      occurred_at:
        input.occurred_at === undefined
          ? current.occurred_at
          : normalizeTimestamp(input.occurred_at, 'Interaction timestamp'),
      updated_at: this.timestamp(),
    }
    await this.requireOwnedContact(this.database, ownerId, interaction.contact_id)
    await this.database.run(
      `UPDATE crm_interactions
       SET contact_id = ?, kind = ?, summary = ?, occurred_at = ?, updated_at = ?
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [
        interaction.contact_id,
        interaction.kind,
        interaction.summary,
        interaction.occurred_at,
        interaction.updated_at,
        ownerId,
        localId,
      ],
    )
    return interaction
  }

  async deleteInteraction(ownerId: CrmOwnerId, localId: string): Promise<void> {
    requireString(ownerId, 'CRM owner ID')
    requireString(localId, 'Interaction ID')
    const deletedAt = this.timestamp()
    await this.database.run(
      `UPDATE crm_interactions SET deleted_at = ?, updated_at = ?
       WHERE owner_id = ? AND local_id = ? AND deleted_at IS NULL`,
      [deletedAt, deletedAt, ownerId, localId],
    )
  }

  async exportDataset(ownerId: CrmOwnerId): Promise<CrmDataset> {
    requireString(ownerId, 'CRM owner ID')
    const [contacts, tags, notes, tasks, interactions] = await Promise.all([
      this.database.all<ContactRow>(
        `SELECT * FROM crm_contacts WHERE owner_id = ? AND deleted_at IS NULL
         ORDER BY display_name ASC, local_id ASC`,
        [ownerId],
      ),
      this.listTags(ownerId),
      this.listNotes(ownerId),
      this.listTasks(ownerId),
      this.listInteractions(ownerId),
    ])
    return {
      format: 'superapp.crm.backup',
      version: 1,
      exported_at: this.timestamp(),
      owner_id: ownerId,
      contacts: contacts.map(toContact),
      tags,
      notes,
      tasks,
      interactions,
    }
  }

  async importDataset(ownerId: CrmOwnerId, dataset: CrmDataset): Promise<void> {
    requireString(ownerId, 'CRM owner ID')
    const validatedDataset = validateDataset(dataset, ownerId)
    await this.database.transaction(async (transaction) => {
      for (const collection of Object.keys(IMPORT_TABLES) as ImportCollection[]) {
        const existingIds = await this.existingIds(transaction, ownerId, IMPORT_TABLES[collection])
        for (const record of validatedDataset[collection]) {
          if (existingIds.has(record.local_id)) {
            throw new Error(`CRM backup ${collection} IDs must be unique.`)
          }
        }
      }

      const existingTags = await this.existingIds(transaction, ownerId, 'crm_tags')
      const existingContacts = await this.existingIds(transaction, ownerId, 'crm_contacts')
      const tagIds = new Set([...existingTags, ...validatedDataset.tags.map((tag) => tag.local_id)])
      const contactIds = new Set([
        ...existingContacts,
        ...validatedDataset.contacts.map((contact) => contact.local_id),
      ])
      for (const contact of validatedDataset.contacts) {
        for (const tagId of contact.tag_ids) {
          if (!tagIds.has(tagId)) {
            throw new Error(`Tag ${tagId} was not found for this owner.`)
          }
        }
      }
      for (const note of validatedDataset.notes) {
        this.requireImportedContact(note.contact_id, contactIds)
      }
      for (const task of validatedDataset.tasks) {
        if (task.contact_id) this.requireImportedContact(task.contact_id, contactIds)
      }
      for (const interaction of validatedDataset.interactions) {
        this.requireImportedContact(interaction.contact_id, contactIds)
      }

      for (const tag of validatedDataset.tags) await this.insertTag(transaction, tag)
      for (const contact of validatedDataset.contacts)
        await this.insertContact(transaction, contact)
      for (const note of validatedDataset.notes) await this.insertNote(transaction, note)
      for (const task of validatedDataset.tasks) await this.insertTask(transaction, task)
      for (const interaction of validatedDataset.interactions) {
        await this.insertInteraction(transaction, interaction)
      }
    })
  }

  private requireImportedContact(contactId: string, contactIds: ReadonlySet<string>) {
    if (!contactIds.has(contactId)) {
      throw new Error(`Contact ${contactId} was not found for this owner.`)
    }
  }

  async clear(ownerId: CrmOwnerId): Promise<void> {
    requireString(ownerId, 'CRM owner ID')
    await this.database.transaction(async (transaction) => {
      for (const table of [
        'crm_interactions',
        'crm_notes',
        'crm_tasks',
        'crm_contacts',
        'crm_tags',
      ] as const) {
        await transaction.run(`DELETE FROM ${table} WHERE owner_id = ?`, [ownerId])
      }
    })
  }
}
