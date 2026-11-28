// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LocalDatabase, SqlValue } from '@superapp/local-db'
import { runMigrations } from '@superapp/local-db/migrate'
import { CrmRepository } from '../../../../packages/crm/src/repository'
import type {
  CrmContact,
  CrmDataset,
  CrmInteraction,
  CrmNote,
  CrmTag,
  CrmTask,
} from '../../../../packages/crm/src/types'

class NodeSqliteDatabase implements LocalDatabase {
  private readonly database = new DatabaseSync(':memory:')

  async exec(sql: string) {
    this.database.exec(sql)
  }

  async all<T>(sql: string, params: SqlValue[] = []) {
    return this.database.prepare(sql).all(...params) as T[]
  }

  async get<T>(sql: string, params: SqlValue[] = []) {
    return (this.database.prepare(sql).get(...params) as T | undefined) ?? null
  }

  async run(sql: string, params: SqlValue[] = []) {
    this.database.prepare(sql).run(...params)
  }

  async transaction<T>(task: (database: LocalDatabase) => Promise<T>) {
    this.database.exec('BEGIN')
    try {
      const result = await task(this)
      this.database.exec('COMMIT')
      return result
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  async close() {
    this.database.close()
  }
}

const OWNER_ID = 'owner_1'
const OTHER_OWNER_ID = 'owner_2'
const THIRD_OWNER_ID = 'owner_3'
const T0 = '2026-11-28T09:00:00.000Z'
const T1 = '2026-11-28T10:00:00.000Z'
const T2 = '2026-11-28T11:00:00.000Z'
const T3 = '2026-11-28T12:00:00.000Z'
const CRM_TABLES = [
  'crm_contacts',
  'crm_tags',
  'crm_notes',
  'crm_tasks',
  'crm_interactions',
] as const

let database: NodeSqliteDatabase
let currentTime: string
let idCounter: number

function createRepository(
  options: { now?: () => Date; idFactory?: () => string } = {},
): CrmRepository {
  return new CrmRepository(database, {
    now: () => new Date(currentTime),
    idFactory: () => `id_${++idCounter}`,
    ...options,
  })
}

function fixedIds(...ids: string[]) {
  const remaining = [...ids]
  return () => {
    const id = remaining.shift()
    if (!id) throw new Error('No deterministic test ID remaining.')
    return id
  }
}

function emptyDataset(overrides: Partial<CrmDataset> = {}): CrmDataset {
  return {
    format: 'superapp.crm.backup',
    version: 1,
    exported_at: T0,
    owner_id: OWNER_ID,
    contacts: [],
    tags: [],
    notes: [],
    tasks: [],
    interactions: [],
    ...overrides,
  }
}

function contactFixture(overrides: Partial<CrmContact> = {}): CrmContact {
  return {
    local_id: 'contact_1',
    owner_id: OWNER_ID,
    display_name: 'Alice',
    phone: '09000000000',
    email: 'alice@example.test',
    tag_ids: [],
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    ...overrides,
  }
}

function tagFixture(overrides: Partial<CrmTag> = {}): CrmTag {
  return {
    local_id: 'tag_1',
    owner_id: OWNER_ID,
    title: 'VIP',
    color: '#123456',
    created_at: T0,
    updated_at: T0,
    ...overrides,
  }
}

function noteFixture(overrides: Partial<CrmNote> = {}): CrmNote {
  return {
    local_id: 'note_1',
    owner_id: OWNER_ID,
    contact_id: 'contact_1',
    body: 'Call back tomorrow',
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    ...overrides,
  }
}

function taskFixture(overrides: Partial<CrmTask> = {}): CrmTask {
  return {
    local_id: 'task_1',
    owner_id: OWNER_ID,
    contact_id: 'contact_1',
    title: 'Send proposal',
    due_at: T1,
    completed: false,
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    ...overrides,
  }
}

function interactionFixture(overrides: Partial<CrmInteraction> = {}): CrmInteraction {
  return {
    local_id: 'interaction_1',
    owner_id: OWNER_ID,
    contact_id: 'contact_1',
    kind: 'call',
    summary: 'Discussed pricing',
    occurred_at: T1,
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    ...overrides,
  }
}

beforeEach(async () => {
  database = new NodeSqliteDatabase()
  await runMigrations(database)
  currentTime = T0
  idCounter = 0
})

afterEach(async () => {
  await database.close()
})

describe('CRM repository', () => {
  it('creates, lists, gets, updates and soft-deletes contacts', async () => {
    const repository = createRepository()
    const tag = await repository.createTag(OWNER_ID, { title: 'Customer', color: '#123456' })
    const contact = await repository.createContact(OWNER_ID, {
      display_name: 'Alice',
      phone: '09000000000',
      email: 'alice@example.test',
      tag_ids: [tag.local_id],
    })

    expect(contact).toEqual({
      local_id: 'id_2',
      owner_id: OWNER_ID,
      display_name: 'Alice',
      phone: '09000000000',
      email: 'alice@example.test',
      tag_ids: ['id_1'],
      created_at: T0,
      updated_at: T0,
      deleted_at: null,
    })
    expect(await repository.getContact(OWNER_ID, contact.local_id)).toEqual(contact)
    expect((await repository.listContacts(OWNER_ID)).items).toEqual([contact])

    currentTime = T1
    const updated = await repository.updateContact(OWNER_ID, contact.local_id, {
      display_name: 'Alice Smith',
      phone: null,
      email: 'alice.smith@example.test',
      tag_ids: [],
    })
    expect(updated).toMatchObject({
      display_name: 'Alice Smith',
      phone: null,
      email: 'alice.smith@example.test',
      tag_ids: [],
      created_at: T0,
      updated_at: T1,
    })
    expect(await repository.getContact(OTHER_OWNER_ID, contact.local_id)).toBeNull()
    await expect(
      repository.updateContact(OTHER_OWNER_ID, contact.local_id, { display_name: 'No' }),
    ).rejects.toThrow('was not found for this owner')

    currentTime = T2
    await repository.deleteContact(OWNER_ID, contact.local_id)
    expect(await repository.getContact(OWNER_ID, contact.local_id)).toBeNull()
    expect((await repository.listContacts(OWNER_ID)).items).toEqual([])
    expect(
      await database.get(
        'SELECT deleted_at, updated_at FROM crm_contacts WHERE owner_id = ? AND local_id = ?',
        [OWNER_ID, contact.local_id],
      ),
    ).toEqual({ deleted_at: T2, updated_at: T2 })
  })

  it('creates, lists, gets, updates and deletes tags', async () => {
    const repository = createRepository()
    const first = await repository.createTag(OWNER_ID, { title: 'Zulu' })
    const second = await repository.createTag(OWNER_ID, { title: 'Alpha', color: '#abcdef' })

    expect(first.color).toBe('#64748b')
    expect((await repository.listTags(OWNER_ID)).map((tag) => tag.local_id)).toEqual([
      second.local_id,
      first.local_id,
    ])
    expect(await repository.getTag(OWNER_ID, first.local_id)).toEqual(first)
    expect(await repository.getTag(OTHER_OWNER_ID, first.local_id)).toBeNull()

    currentTime = T1
    expect(
      await repository.updateTag(OWNER_ID, first.local_id, { title: 'Updated' }),
    ).toMatchObject({
      title: 'Updated',
      color: '#64748b',
      created_at: T0,
      updated_at: T1,
    })
    await expect(
      repository.updateTag(OTHER_OWNER_ID, first.local_id, { title: 'No' }),
    ).rejects.toThrow('was not found for this owner')

    await repository.deleteTag(OWNER_ID, first.local_id)
    expect(await repository.getTag(OWNER_ID, first.local_id)).toBeNull()
    expect((await repository.listTags(OWNER_ID)).map((tag) => tag.local_id)).toEqual([
      second.local_id,
    ])
  })

  it('removes a deleted tag from every contact in only that owner scope', async () => {
    const ownerRepository = createRepository({
      idFactory: fixedIds(
        'tag_vip',
        'tag_other',
        'contact_1',
        'contact_2',
        'contact_3',
        'contact_deleted',
      ),
    })
    const otherRepository = createRepository({ idFactory: fixedIds('tag_vip', 'contact_other') })
    const vip = await ownerRepository.createTag(OWNER_ID, { title: 'VIP' })
    const other = await ownerRepository.createTag(OWNER_ID, { title: 'Other' })
    const first = await ownerRepository.createContact(OWNER_ID, {
      display_name: 'First',
      tag_ids: [vip.local_id, other.local_id],
    })
    const second = await ownerRepository.createContact(OWNER_ID, {
      display_name: 'Second',
      tag_ids: [vip.local_id],
    })
    const third = await ownerRepository.createContact(OWNER_ID, {
      display_name: 'Third',
      tag_ids: [other.local_id],
    })
    const deleted = await ownerRepository.createContact(OWNER_ID, {
      display_name: 'Deleted',
      tag_ids: [vip.local_id],
    })
    await ownerRepository.deleteContact(OWNER_ID, deleted.local_id)

    const otherVip = await otherRepository.createTag(OTHER_OWNER_ID, { title: 'VIP' })
    const otherContact = await otherRepository.createContact(OTHER_OWNER_ID, {
      display_name: 'Other owner',
      tag_ids: [otherVip.local_id],
    })

    currentTime = T1
    await ownerRepository.deleteTag(OWNER_ID, vip.local_id)

    expect(await ownerRepository.getTag(OWNER_ID, vip.local_id)).toBeNull()
    expect((await ownerRepository.getContact(OWNER_ID, first.local_id))?.tag_ids).toEqual([
      other.local_id,
    ])
    expect((await ownerRepository.getContact(OWNER_ID, second.local_id))?.tag_ids).toEqual([])
    expect((await ownerRepository.getContact(OWNER_ID, third.local_id))?.tag_ids).toEqual([
      other.local_id,
    ])
    expect(
      JSON.parse(
        (await database.get<{ tags_json: string }>(
          'SELECT tags_json FROM crm_contacts WHERE owner_id = ? AND local_id = ?',
          [OWNER_ID, deleted.local_id],
        ))!.tags_json,
      ),
    ).toEqual([])
    expect(
      (await otherRepository.getContact(OTHER_OWNER_ID, otherContact.local_id))?.tag_ids,
    ).toEqual([otherVip.local_id])
    expect(await otherRepository.getTag(OTHER_OWNER_ID, otherVip.local_id)).not.toBeNull()
  })

  it('creates, filters, sorts, updates and soft-deletes notes', async () => {
    const repository = createRepository()
    const firstContact = await repository.createContact(OWNER_ID, { display_name: 'Alice' })
    const secondContact = await repository.createContact(OWNER_ID, { display_name: 'Bob' })
    const first = await repository.createNote(OWNER_ID, {
      contact_id: firstContact.local_id,
      body: 'Older note',
    })

    currentTime = T1
    const second = await repository.createNote(OWNER_ID, {
      contact_id: firstContact.local_id,
      body: 'Newer note',
    })
    const otherContactNote = await repository.createNote(OWNER_ID, {
      contact_id: secondContact.local_id,
      body: 'Bob note',
    })
    expect((await repository.listNotes(OWNER_ID)).map((note) => note.local_id)).toEqual([
      otherContactNote.local_id,
      second.local_id,
      first.local_id,
    ])
    expect(
      (await repository.listNotes(OWNER_ID, firstContact.local_id)).map((note) => note.local_id),
    ).toEqual([second.local_id, first.local_id])
    expect(await repository.getNote(OWNER_ID, first.local_id)).toEqual(first)
    expect(await repository.getNote(OTHER_OWNER_ID, first.local_id)).toBeNull()

    currentTime = T2
    expect(
      await repository.updateNote(OWNER_ID, first.local_id, {
        contact_id: secondContact.local_id,
        body: 'Updated note',
      }),
    ).toMatchObject({
      contact_id: secondContact.local_id,
      body: 'Updated note',
      created_at: T0,
      updated_at: T2,
    })
    expect(
      (await repository.listNotes(OWNER_ID, firstContact.local_id)).map((note) => note.local_id),
    ).toEqual([second.local_id])
    await expect(
      repository.updateNote(OTHER_OWNER_ID, first.local_id, {
        contact_id: firstContact.local_id,
        body: 'No',
      }),
    ).rejects.toThrow('was not found for this owner')

    currentTime = T3
    await repository.deleteNote(OWNER_ID, first.local_id)
    expect(await repository.getNote(OWNER_ID, first.local_id)).toBeNull()
    expect((await repository.listNotes(OWNER_ID)).map((note) => note.local_id)).not.toContain(
      first.local_id,
    )
    expect(
      await database.get(
        'SELECT deleted_at, updated_at FROM crm_notes WHERE owner_id = ? AND local_id = ?',
        [OWNER_ID, first.local_id],
      ),
    ).toEqual({ deleted_at: T3, updated_at: T3 })
  })

  it('creates, filters, sorts, updates and soft-deletes tasks', async () => {
    const repository = createRepository()
    const contact = await repository.createContact(OWNER_ID, { display_name: 'Alice' })
    const later = await repository.createTask(OWNER_ID, {
      contact_id: contact.local_id,
      title: 'Later',
      due_at: T2,
    })
    const earlier = await repository.createTask(OWNER_ID, {
      contact_id: contact.local_id,
      title: 'Earlier',
      due_at: T1,
    })
    const noDueDate = await repository.createTask(OWNER_ID, { title: 'No due date' })
    const completed = await repository.createTask(OWNER_ID, {
      title: 'Completed',
      due_at: T0,
      completed: true,
    })

    expect((await repository.listTasks(OWNER_ID)).map((task) => task.local_id)).toEqual([
      earlier.local_id,
      later.local_id,
      noDueDate.local_id,
      completed.local_id,
    ])
    expect(
      (await repository.listTasks(OWNER_ID, { completed: false })).map((task) => task.local_id),
    ).toEqual([earlier.local_id, later.local_id, noDueDate.local_id])
    expect(
      (await repository.listTasks(OWNER_ID, { contactId: contact.local_id })).map(
        (task) => task.local_id,
      ),
    ).toEqual([earlier.local_id, later.local_id])
    expect(await repository.getTask(OWNER_ID, later.local_id)).toEqual(later)
    expect(await repository.getTask(OTHER_OWNER_ID, later.local_id)).toBeNull()

    currentTime = T1
    expect(
      await repository.updateTask(OWNER_ID, noDueDate.local_id, {
        contact_id: contact.local_id,
        title: 'Now scheduled',
        due_at: T0,
        completed: true,
      }),
    ).toMatchObject({
      contact_id: contact.local_id,
      title: 'Now scheduled',
      due_at: T0,
      completed: true,
      created_at: T0,
      updated_at: T1,
    })
    await expect(
      repository.updateTask(OTHER_OWNER_ID, later.local_id, { title: 'No' }),
    ).rejects.toThrow('was not found for this owner')

    currentTime = T2
    await repository.deleteTask(OWNER_ID, earlier.local_id)
    expect(await repository.getTask(OWNER_ID, earlier.local_id)).toBeNull()
    expect((await repository.listTasks(OWNER_ID)).map((task) => task.local_id)).not.toContain(
      earlier.local_id,
    )
    expect(
      await database.get(
        'SELECT deleted_at, updated_at FROM crm_tasks WHERE owner_id = ? AND local_id = ?',
        [OWNER_ID, earlier.local_id],
      ),
    ).toEqual({ deleted_at: T2, updated_at: T2 })
  })

  it('creates, filters, sorts, updates and soft-deletes interactions', async () => {
    const repository = createRepository()
    const firstContact = await repository.createContact(OWNER_ID, { display_name: 'Alice' })
    const secondContact = await repository.createContact(OWNER_ID, { display_name: 'Bob' })
    const older = await repository.createInteraction(OWNER_ID, {
      contact_id: firstContact.local_id,
      kind: 'call',
      summary: 'Older call',
      occurred_at: T0,
    })
    const newer = await repository.createInteraction(OWNER_ID, {
      contact_id: firstContact.local_id,
      kind: 'email',
      summary: 'Newer email',
      occurred_at: T2,
    })
    const otherContactInteraction = await repository.createInteraction(OWNER_ID, {
      contact_id: secondContact.local_id,
      kind: 'meeting',
      summary: 'Bob meeting',
      occurred_at: T1,
    })

    expect((await repository.listInteractions(OWNER_ID)).map((item) => item.local_id)).toEqual([
      newer.local_id,
      otherContactInteraction.local_id,
      older.local_id,
    ])
    expect(
      (await repository.listInteractions(OWNER_ID, firstContact.local_id)).map(
        (item) => item.local_id,
      ),
    ).toEqual([newer.local_id, older.local_id])
    expect(await repository.getInteraction(OWNER_ID, older.local_id)).toEqual(older)
    expect(await repository.getInteraction(OTHER_OWNER_ID, older.local_id)).toBeNull()

    currentTime = T3
    expect(
      await repository.updateInteraction(OWNER_ID, older.local_id, {
        contact_id: secondContact.local_id,
        kind: 'message',
        summary: 'Updated interaction',
        occurred_at: T3,
      }),
    ).toMatchObject({
      contact_id: secondContact.local_id,
      kind: 'message',
      summary: 'Updated interaction',
      occurred_at: T3,
      created_at: T0,
      updated_at: T3,
    })
    await expect(
      repository.updateInteraction(OTHER_OWNER_ID, newer.local_id, {
        contact_id: firstContact.local_id,
        kind: 'email',
        summary: 'No',
      }),
    ).rejects.toThrow('was not found for this owner')

    await repository.deleteInteraction(OWNER_ID, newer.local_id)
    expect(await repository.getInteraction(OWNER_ID, newer.local_id)).toBeNull()
    expect(
      (await repository.listInteractions(OWNER_ID)).map((item) => item.local_id),
    ).not.toContain(newer.local_id)
    expect(
      await database.get(
        'SELECT deleted_at, updated_at FROM crm_interactions WHERE owner_id = ? AND local_id = ?',
        [OWNER_ID, newer.local_id],
      ),
    ).toEqual({ deleted_at: T3, updated_at: T3 })
  })

  it('normalizes local date inputs to canonical timestamps and rejects invalid dates', async () => {
    const repository = createRepository()
    const contact = await repository.createContact(OWNER_ID, { display_name: 'Alice' })
    const task = await repository.createTask(OWNER_ID, {
      contact_id: contact.local_id,
      title: 'Scheduled',
      due_at: '2026-11-30',
    })
    const interaction = await repository.createInteraction(OWNER_ID, {
      contact_id: contact.local_id,
      kind: 'meeting',
      summary: 'Local meeting',
      occurred_at: '2026-11-28T14:30',
    })

    expect(task.due_at).toBe('2026-11-30T00:00:00.000Z')
    expect(interaction.occurred_at).toBe(new Date('2026-11-28T14:30').toISOString())
    await expect(
      repository.createTask(OWNER_ID, { title: 'Invalid', due_at: '2026-02-30' }),
    ).rejects.toThrow('valid date-time')
    await expect(
      repository.createInteraction(OWNER_ID, {
        contact_id: contact.local_id,
        kind: 'call',
        summary: 'Invalid',
        occurred_at: 'not-a-date',
      }),
    ).rejects.toThrow('valid date-time')
  })

  it('searches name, phone and email and paginates only after search and tag filtering', async () => {
    const repository = createRepository()
    const vip = await repository.createTag(OWNER_ID, { title: 'VIP' })
    const newsletter = await repository.createTag(OWNER_ID, { title: 'Newsletter' })
    await repository.createContact(OWNER_ID, { display_name: 'Aaron' })
    const amy = await repository.createContact(OWNER_ID, {
      display_name: 'Amy',
      phone: '0900-MATCH-1234',
      tag_ids: [vip.local_id],
    })
    const bob = await repository.createContact(OWNER_ID, {
      display_name: 'Bob',
      email: 'match@example.test',
      tag_ids: [newsletter.local_id],
    })
    await repository.createContact(OWNER_ID, { display_name: 'Cara' })
    const percent = await repository.createContact(OWNER_ID, {
      display_name: 'Percent% Name',
      tag_ids: [vip.local_id],
    })
    const underscore = await repository.createContact(OWNER_ID, {
      display_name: 'Under_Score',
      tag_ids: [vip.local_id],
    })
    const zoe = await repository.createContact(OWNER_ID, {
      display_name: 'Zoe Match',
      tag_ids: [vip.local_id],
    })

    expect(
      (await repository.listContacts(OWNER_ID, { search: ' match ' })).items.map(
        (item) => item.local_id,
      ),
    ).toEqual([amy.local_id, bob.local_id, zoe.local_id])
    expect(
      (await repository.listContacts(OWNER_ID, { search: '%' })).items.map((item) => item.local_id),
    ).toEqual([percent.local_id])
    expect(
      (await repository.listContacts(OWNER_ID, { search: '_' })).items.map((item) => item.local_id),
    ).toEqual([underscore.local_id])

    const first = await repository.listContacts(OWNER_ID, {
      search: 'match',
      tagId: vip.local_id,
      limit: 1,
    })
    expect(first.items.map((item) => item.local_id)).toEqual([amy.local_id])
    expect(first).toMatchObject({ next_cursor: 'offset_1', has_more: true })
    const second = await repository.listContacts(OWNER_ID, {
      search: 'match',
      tagId: vip.local_id,
      limit: 1,
      cursor: first.next_cursor!,
    })
    expect(second.items.map((item) => item.local_id)).toEqual([zoe.local_id])
    expect(second).toMatchObject({ next_cursor: null, has_more: false })

    const tagPage = await repository.listContacts(OWNER_ID, { tagId: vip.local_id, limit: 1 })
    expect(tagPage.items.map((item) => item.local_id)).toEqual([amy.local_id])
    expect(
      (await repository.listContacts(OWNER_ID, { tagId: newsletter.local_id })).items.map(
        (item) => item.local_id,
      ),
    ).toEqual([bob.local_id])
  })

  it('uses local_id as the deterministic contact sort tie-breaker', async () => {
    const repository = createRepository()
    const first = await repository.createContact(OWNER_ID, { display_name: 'Same name' })
    const second = await repository.createContact(OWNER_ID, { display_name: 'Same name' })

    expect((await repository.listContacts(OWNER_ID)).items.map((item) => item.local_id)).toEqual(
      [first.local_id, second.local_id].sort(),
    )
  })

  it('validates required strings, ID uniqueness and owned contact/tag references', async () => {
    const repository = createRepository()
    const contact = await repository.createContact(OWNER_ID, { display_name: 'Alice' })
    const tag = await repository.createTag(OWNER_ID, { title: 'VIP' })
    const otherContact = await repository.createContact(OTHER_OWNER_ID, { display_name: 'Other' })
    const otherTag = await repository.createTag(OTHER_OWNER_ID, { title: 'Other' })

    await expect(repository.createContact(OWNER_ID, { display_name: ' ' })).rejects.toThrow(
      'Contact display name is required',
    )
    await expect(repository.createTag(OWNER_ID, { title: '' })).rejects.toThrow(
      'Tag title is required',
    )
    await expect(
      repository.createNote(OWNER_ID, { contact_id: contact.local_id, body: ' ' }),
    ).rejects.toThrow('Note body is required')
    await expect(repository.createTask(OWNER_ID, { title: '' })).rejects.toThrow(
      'Task title is required',
    )
    await expect(
      repository.createInteraction(OWNER_ID, {
        contact_id: contact.local_id,
        kind: 'call',
        summary: '',
      }),
    ).rejects.toThrow('Interaction summary is required')
    await expect(repository.listTags('')).rejects.toThrow('CRM owner ID is required')

    await expect(
      repository.createContact(OWNER_ID, {
        display_name: 'Bad tag',
        tag_ids: [tag.local_id, tag.local_id],
      }),
    ).rejects.toThrow('tag IDs must be unique')
    await expect(
      repository.createContact(OWNER_ID, {
        display_name: 'Foreign tag',
        tag_ids: [otherTag.local_id],
      }),
    ).rejects.toThrow('was not found for this owner')
    await expect(
      repository.updateContact(OWNER_ID, contact.local_id, {
        display_name: contact.display_name,
        tag_ids: [otherTag.local_id],
      }),
    ).rejects.toThrow('was not found for this owner')
    expect((await repository.getContact(OWNER_ID, contact.local_id))?.tag_ids).toEqual([])

    await expect(
      repository.createNote(OWNER_ID, {
        contact_id: otherContact.local_id,
        body: 'Foreign contact',
      }),
    ).rejects.toThrow('was not found for this owner')
    await expect(
      repository.createTask(OWNER_ID, {
        title: 'Foreign contact',
        contact_id: otherContact.local_id,
      }),
    ).rejects.toThrow('was not found for this owner')
    await expect(
      repository.createInteraction(OWNER_ID, {
        contact_id: otherContact.local_id,
        kind: 'call',
        summary: 'Foreign contact',
      }),
    ).rejects.toThrow('was not found for this owner')

    const note = await repository.createNote(OWNER_ID, {
      contact_id: contact.local_id,
      body: 'Owned note',
    })
    const task = await repository.createTask(OWNER_ID, {
      title: 'Owned task',
      contact_id: contact.local_id,
    })
    const interaction = await repository.createInteraction(OWNER_ID, {
      contact_id: contact.local_id,
      kind: 'call',
      summary: 'Owned interaction',
    })
    await expect(
      repository.updateNote(OWNER_ID, note.local_id, {
        contact_id: otherContact.local_id,
        body: note.body,
      }),
    ).rejects.toThrow('was not found for this owner')
    await expect(
      repository.updateTask(OWNER_ID, task.local_id, {
        contact_id: otherContact.local_id,
        title: task.title,
      }),
    ).rejects.toThrow('was not found for this owner')
    await expect(
      repository.updateInteraction(OWNER_ID, interaction.local_id, {
        contact_id: otherContact.local_id,
        kind: interaction.kind,
        summary: interaction.summary,
      }),
    ).rejects.toThrow('was not found for this owner')

    const duplicateRepository = createRepository({ idFactory: () => 'duplicate' })
    await duplicateRepository.createTag(OWNER_ID, { title: 'First' })
    await expect(duplicateRepository.createTag(OWNER_ID, { title: 'Second' })).rejects.toThrow(
      'ID must be unique',
    )
    const blankIdRepository = createRepository({ idFactory: () => ' ' })
    await expect(blankIdRepository.createTag(OWNER_ID, { title: 'Invalid ID' })).rejects.toThrow(
      'CRM ID is required',
    )
  })

  it('cascades contact soft-deletes to related rows and hides them from lists and export', async () => {
    const ownerRepository = createRepository({
      idFactory: fixedIds('contact_1', 'note_1', 'task_1', 'interaction_1'),
    })
    const otherRepository = createRepository({
      idFactory: fixedIds('contact_1', 'note_1', 'task_1', 'interaction_1'),
    })
    for (const [repository, ownerId] of [
      [ownerRepository, OWNER_ID],
      [otherRepository, OTHER_OWNER_ID],
    ] as const) {
      const contact = await repository.createContact(ownerId, { display_name: 'Alice' })
      await repository.createNote(ownerId, { contact_id: contact.local_id, body: 'Note' })
      await repository.createTask(ownerId, { contact_id: contact.local_id, title: 'Task' })
      await repository.createInteraction(ownerId, {
        contact_id: contact.local_id,
        kind: 'call',
        summary: 'Interaction',
      })
    }

    currentTime = T2
    await ownerRepository.deleteContact(OWNER_ID, 'contact_1')

    expect((await ownerRepository.listContacts(OWNER_ID)).items).toEqual([])
    expect(await ownerRepository.listNotes(OWNER_ID)).toEqual([])
    expect(await ownerRepository.listTasks(OWNER_ID)).toEqual([])
    expect(await ownerRepository.listInteractions(OWNER_ID)).toEqual([])
    expect(await ownerRepository.exportDataset(OWNER_ID)).toMatchObject({
      contacts: [],
      notes: [],
      tasks: [],
      interactions: [],
    })
    for (const table of ['crm_contacts', 'crm_notes', 'crm_tasks', 'crm_interactions'] as const) {
      expect(
        await database.get(`SELECT deleted_at, updated_at FROM ${table} WHERE owner_id = ?`, [
          OWNER_ID,
        ]),
      ).toEqual({ deleted_at: T2, updated_at: T2 })
    }

    expect(await otherRepository.getContact(OTHER_OWNER_ID, 'contact_1')).not.toBeNull()
    expect(await otherRepository.listNotes(OTHER_OWNER_ID)).toHaveLength(1)
    expect(await otherRepository.listTasks(OTHER_OWNER_ID)).toHaveLength(1)
    expect(await otherRepository.listInteractions(OTHER_OWNER_ID)).toHaveLength(1)
  })

  it('exports and imports a deterministic round-trip while preserving IDs and timestamps', async () => {
    const repository = createRepository({
      idFactory: fixedIds(
        'tag_1',
        'contact_1',
        'note_1',
        'task_1',
        'interaction_1',
        'note_deleted',
        'task_deleted',
        'interaction_deleted',
        'contact_deleted',
      ),
    })
    const tag = await repository.createTag(OWNER_ID, { title: 'VIP', color: '#123456' })
    const contact = await repository.createContact(OWNER_ID, {
      display_name: 'Alice',
      phone: '09000000000',
      email: 'alice@example.test',
      tag_ids: [tag.local_id],
    })
    const note = await repository.createNote(OWNER_ID, {
      contact_id: contact.local_id,
      body: 'Remember the proposal',
    })

    currentTime = T1
    const task = await repository.createTask(OWNER_ID, {
      contact_id: contact.local_id,
      title: 'Send proposal',
      due_at: T2,
    })
    const interaction = await repository.createInteraction(OWNER_ID, {
      contact_id: contact.local_id,
      kind: 'meeting',
      summary: 'Project meeting',
      occurred_at: T1,
    })
    const deletedNote = await repository.createNote(OWNER_ID, {
      contact_id: contact.local_id,
      body: 'Deleted note',
    })
    const deletedTask = await repository.createTask(OWNER_ID, { title: 'Deleted task' })
    const deletedInteraction = await repository.createInteraction(OWNER_ID, {
      contact_id: contact.local_id,
      kind: 'other',
      summary: 'Deleted interaction',
    })
    const deletedContact = await repository.createContact(OWNER_ID, { display_name: 'Deleted' })
    await repository.deleteNote(OWNER_ID, deletedNote.local_id)
    await repository.deleteTask(OWNER_ID, deletedTask.local_id)
    await repository.deleteInteraction(OWNER_ID, deletedInteraction.local_id)
    await repository.deleteContact(OWNER_ID, deletedContact.local_id)

    currentTime = T3
    const dataset = await repository.exportDataset(OWNER_ID)
    expect(dataset).toEqual({
      format: 'superapp.crm.backup',
      version: 1,
      exported_at: T3,
      owner_id: OWNER_ID,
      contacts: [contact],
      tags: [tag],
      notes: [note],
      tasks: [task],
      interactions: [interaction],
    })

    await repository.clear(OWNER_ID)
    await repository.importDataset(OWNER_ID, dataset)

    expect(await repository.exportDataset(OWNER_ID)).toEqual(dataset)
    expect(await repository.getContact(OWNER_ID, contact.local_id)).toEqual(contact)
    expect(await repository.getTag(OWNER_ID, tag.local_id)).toEqual(tag)
    expect(await repository.getNote(OWNER_ID, note.local_id)).toEqual(note)
    expect(await repository.getTask(OWNER_ID, task.local_id)).toEqual(task)
    expect(await repository.getInteraction(OWNER_ID, interaction.local_id)).toEqual(interaction)
    expect(await repository.getContact(OWNER_ID, deletedContact.local_id)).toBeNull()
  })

  it('rejects malformed, cross-owner, duplicate and dangling-reference imports without writes', async () => {
    const repository = createRepository()
    const contact = contactFixture({ tag_ids: ['tag_1'] })
    const tag = tagFixture()
    const note = noteFixture()
    const task = taskFixture()
    const interaction = interactionFixture()
    const valid = emptyDataset({
      contacts: [contact],
      tags: [tag],
      notes: [note],
      tasks: [task],
      interactions: [interaction],
    })
    const invalidDatasets: unknown[] = [
      null,
      { ...valid, format: 'superapp.crm.backup.encrypted' },
      { ...valid, version: 2 },
      { ...valid, owner_id: OTHER_OWNER_ID },
      { ...valid, exported_at: '' },
      { ...valid, contacts: {} },
      { ...valid, extra_field: true },
      { ...valid, contacts: [{ ...contact, owner_id: OTHER_OWNER_ID }] },
      { ...valid, tags: [{ ...tag, owner_id: OTHER_OWNER_ID }] },
      { ...valid, notes: [{ ...note, owner_id: OTHER_OWNER_ID }] },
      { ...valid, tasks: [{ ...task, owner_id: OTHER_OWNER_ID }] },
      { ...valid, interactions: [{ ...interaction, owner_id: OTHER_OWNER_ID }] },
      { ...valid, contacts: [contact, { ...contact }] },
      { ...valid, contacts: [{ ...contact, display_name: ' ' }] },
      { ...valid, contacts: [{ ...contact, created_at: 123 }] },
      { ...valid, contacts: [{ ...contact, tag_ids: ['missing_tag'] }] },
      { ...valid, notes: [{ ...note, contact_id: 'missing_contact' }] },
      { ...valid, tasks: [{ ...task, contact_id: 'missing_contact' }] },
      { ...valid, interactions: [{ ...interaction, contact_id: 'missing_contact' }] },
      { ...valid, interactions: [{ ...interaction, kind: 'invalid' }] },
      { ...valid, tasks: [{ ...task, completed: 1 }] },
    ]

    for (const invalid of invalidDatasets) {
      await expect(repository.importDataset(OWNER_ID, invalid as CrmDataset)).rejects.toThrow()
      expect(await repository.exportDataset(OWNER_ID)).toEqual(emptyDataset({ exported_at: T0 }))
    }
  })

  it('rejects imports that collide with existing IDs without changing the current dataset', async () => {
    const repository = createRepository({ idFactory: () => 'contact_1' })
    const current = await repository.createContact(OWNER_ID, { display_name: 'Current' })
    const imported = contactFixture({ display_name: 'Imported' })

    await expect(
      repository.importDataset(OWNER_ID, emptyDataset({ contacts: [imported] })),
    ).rejects.toThrow('IDs must be unique')

    expect((await repository.listContacts(OWNER_ID)).items).toEqual([current])
  })

  it('rolls back all imported rows when a later insert fails', async () => {
    const repository = createRepository()
    await database.exec(`
      CREATE TRIGGER reject_second_tag
      BEFORE INSERT ON crm_tags
      WHEN NEW.local_id = 'tag_2'
      BEGIN
        SELECT RAISE(ABORT, 'forced import failure');
      END;
    `)
    const dataset = emptyDataset({
      contacts: [contactFixture()],
      tags: [tagFixture(), tagFixture({ local_id: 'tag_2', title: 'Second' })],
      notes: [noteFixture()],
    })

    await expect(repository.importDataset(OWNER_ID, dataset)).rejects.toThrow(
      'forced import failure',
    )
    expect(await repository.exportDataset(OWNER_ID)).toEqual(emptyDataset({ exported_at: T0 }))
  })

  it('keeps datasets isolated and clears every CRM table including tombstones for one owner', async () => {
    const ids = fixedIds('tag_1', 'contact_1', 'note_1', 'task_1', 'interaction_1', 'note_deleted')
    const ownerRepository = createRepository({ idFactory: ids })
    const otherRepository = createRepository({
      idFactory: fixedIds('tag_1', 'contact_1', 'note_1', 'task_1', 'interaction_1'),
    })
    for (const [repository, ownerId] of [
      [ownerRepository, OWNER_ID],
      [otherRepository, OTHER_OWNER_ID],
    ] as const) {
      const tag = await repository.createTag(ownerId, { title: 'VIP' })
      const contact = await repository.createContact(ownerId, {
        display_name: 'Alice',
        tag_ids: [tag.local_id],
      })
      await repository.createNote(ownerId, { contact_id: contact.local_id, body: 'Note' })
      await repository.createTask(ownerId, { contact_id: contact.local_id, title: 'Task' })
      await repository.createInteraction(ownerId, {
        contact_id: contact.local_id,
        kind: 'call',
        summary: 'Interaction',
      })
    }
    const deletedNote = await ownerRepository.createNote(OWNER_ID, {
      contact_id: 'contact_1',
      body: 'Tombstone',
    })
    await ownerRepository.deleteNote(OWNER_ID, deletedNote.local_id)

    expect(await ownerRepository.getContact(THIRD_OWNER_ID, 'contact_1')).toBeNull()
    expect(await ownerRepository.getTag(THIRD_OWNER_ID, 'tag_1')).toBeNull()
    expect(await ownerRepository.getNote(THIRD_OWNER_ID, 'note_1')).toBeNull()
    expect(await ownerRepository.getTask(THIRD_OWNER_ID, 'task_1')).toBeNull()
    expect(await ownerRepository.getInteraction(THIRD_OWNER_ID, 'interaction_1')).toBeNull()
    expect((await ownerRepository.exportDataset(THIRD_OWNER_ID)).contacts).toEqual([])
    expect((await ownerRepository.exportDataset(OWNER_ID)).contacts).toHaveLength(1)
    expect((await ownerRepository.exportDataset(OTHER_OWNER_ID)).contacts).toHaveLength(1)

    await ownerRepository.clear(OWNER_ID)

    for (const table of CRM_TABLES) {
      expect(
        await database.get(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id = ?`, [OWNER_ID]),
      ).toEqual({ count: 0 })
      expect(
        await database.get(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id = ?`, [
          OTHER_OWNER_ID,
        ]),
      ).toEqual({ count: 1 })
    }
    expect(await otherRepository.getContact(OTHER_OWNER_ID, 'contact_1')).not.toBeNull()
    expect(await otherRepository.getTag(OTHER_OWNER_ID, 'tag_1')).not.toBeNull()
    expect(await otherRepository.getNote(OTHER_OWNER_ID, 'note_1')).not.toBeNull()
    expect(await otherRepository.getTask(OTHER_OWNER_ID, 'task_1')).not.toBeNull()
    expect(await otherRepository.getInteraction(OTHER_OWNER_ID, 'interaction_1')).not.toBeNull()
    expect(await otherRepository.exportDataset(OTHER_OWNER_ID)).toMatchObject({
      contacts: [expect.any(Object)],
      tags: [expect.any(Object)],
      notes: [expect.any(Object)],
      tasks: [expect.any(Object)],
      interactions: [expect.any(Object)],
    })
  })
})
