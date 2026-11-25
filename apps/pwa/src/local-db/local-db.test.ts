// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CanonicalMessage, Conversation, SyncChange } from '@superapp/chat-contracts'
import type { LocalDatabase, SqlValue } from '@superapp/local-db'
import { runMigrations } from '@superapp/local-db/migrate'
import { MIGRATIONS } from '@superapp/local-db/migrations'
import { ConversationRepository, MessageRepository } from '@superapp/local-db/repositories'
import { SyncEngine } from '@superapp/local-db/sync-engine'

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

const conversation: Conversation = {
  id: 'conv_1',
  project_id: 'prj_12',
  source: 'bale',
  robot_id: '987654',
  chat_id: '501',
  customer: { id: 'usr_501', display_name: 'علی محمدی', initials: 'عم' },
  support_level: 'level_1',
  status: 'open',
  assignee: { id: 'op_42', name: 'سارا رضایی' },
  last_message: 'سلام',
  last_message_at: '2026-11-25T10:00:00.000Z',
  unread_count: 1,
  created_at: '2026-11-25T09:59:00.000Z',
  updated_at: '2026-11-25T10:00:00.000Z',
  deleted_at: null,
}

const message: CanonicalMessage = {
  id: 'msg_1',
  conversation_id: 'conv_1',
  client_mutation_id: 'cm_1',
  sender: 'client',
  sender_id: 'usr_501',
  text: 'سلام',
  attachment: null,
  sent_at: '2026-11-25T10:00:00.000Z',
  created_at: '2026-11-25T10:00:00.000Z',
  updated_at: '2026-11-25T10:00:00.000Z',
  deleted_at: null,
  delivery_status: 'sent',
}

let database: NodeSqliteDatabase

beforeEach(async () => {
  database = new NodeSqliteDatabase()
  await runMigrations(database)
})

describe('local database and sync core', () => {
  it('runs versioned migrations idempotently', async () => {
    await runMigrations(database)
    const rows = await database.all<{ version: number }>('SELECT version FROM schema_migrations')
    expect(rows.map((row) => row.version)).toEqual([1, 2])
  })

  it('removes legacy project-only conversation cache during the operator-scope migration', async () => {
    const legacy = new NodeSqliteDatabase()
    await legacy.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `)
    await legacy.transaction(async (transaction) => {
      await transaction.exec(MIGRATIONS[0]!.sql)
      await transaction.run(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [1, MIGRATIONS[0]!.name, '2026-11-25T10:00:00.000Z'],
      )
    })
    await legacy.run(
      `INSERT INTO cached_conversations (
        owner_id, server_id, source, robot_id, chat_id, customer_json,
        support_level, status, last_message, unread_count, created_at, updated_at,
        synced_at, cache_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'prj_12',
        'legacy_1',
        'bale',
        'robot_1',
        'chat_1',
        JSON.stringify({ id: 'user_1', display_name: 'Legacy', initials: 'L' }),
        'level_1',
        'open',
        'Legacy message',
        1,
        '2026-11-25T09:00:00.000Z',
        '2026-11-25T10:00:00.000Z',
        '2026-11-25T10:00:00.000Z',
        'synced',
      ],
    )

    await runMigrations(legacy)

    expect(await legacy.all('SELECT * FROM cached_conversations')).toHaveLength(0)
    expect(await legacy.get('SELECT name FROM schema_migrations WHERE version = 2')).toMatchObject({
      name: 'scope_conversation_cache_by_operator',
    })
    await legacy.close()
  })

  it('upserts by canonical id without duplicates and ignores older updates', async () => {
    const repository = new ConversationRepository(database)
    await repository.upsert('prj_12', conversation, '2026-11-25T10:01:00.000Z')
    await repository.upsert(
      'prj_12',
      { ...conversation, status: 'assigned', updated_at: '2026-11-25T10:02:00.000Z' },
      '2026-11-25T10:02:00.000Z',
    )
    await repository.upsert(
      'prj_12',
      { ...conversation, status: 'closed', updated_at: '2026-11-25T10:01:30.000Z' },
      '2026-11-25T10:01:30.000Z',
    )

    const rows = await database.all('SELECT * FROM cached_conversations')
    expect(rows).toHaveLength(1)
    expect(await repository.get('prj_12', 'conv_1')).toMatchObject({ status: 'assigned' })
  })

  it('keeps the real project id while isolating cache rows by operator scope', async () => {
    const repository = new ConversationRepository(database)
    const scope = JSON.stringify(['op_1', 'prj_12'])
    await repository.upsert(scope, conversation, '2026-11-25T10:01:00.000Z')

    expect(await repository.get(scope, 'conv_1')).toMatchObject({
      project_id: 'prj_12',
      id: 'conv_1',
    })
    expect(await repository.list(JSON.stringify(['op_2', 'prj_12']))).toMatchObject({
      items: [],
    })
  })

  it('matches offline search and assignee filters without wildcard or substring leaks', async () => {
    const repository = new ConversationRepository(database)
    const scope = JSON.stringify(['op_1', 'prj_12'])
    await repository.upsert(
      scope,
      { ...conversation, assignee: { id: 'op_1', name: 'سارا رضایی' } },
      '2026-11-25T10:01:00.000Z',
    )
    await repository.upsert(
      scope,
      {
        ...conversation,
        id: 'conv_2',
        chat_id: '502',
        assignee: { id: 'op_10', name: 'اپراتور دوم' },
      },
      '2026-11-25T10:01:00.000Z',
    )

    expect(
      (await repository.list(scope, { assigneeId: 'op_1' })).items.map((item) => item.id),
    ).toEqual(['conv_1'])
    expect((await repository.list(scope, { search: 'سارا' })).items.map((item) => item.id)).toEqual(
      ['conv_1'],
    )
    expect(await repository.list(scope, { search: '%' })).toMatchObject({ items: [] })
    expect(await repository.list(scope, { search: '_' })).toMatchObject({ items: [] })
  })

  it('tombstones conversations missing from a complete unfiltered snapshot', async () => {
    const repository = new ConversationRepository(database)
    const scope = JSON.stringify(['op_1', 'prj_12'])
    await repository.upsert(scope, conversation, '2026-11-25T10:01:00.000Z')
    await repository.upsert(
      scope,
      { ...conversation, id: 'conv_2', chat_id: '502' },
      '2026-11-25T10:01:00.000Z',
    )

    await repository.markMissingDeleted(
      scope,
      ['conv_1'],
      '2026-11-25T10:05:00.000Z',
      '2026-11-25T10:05:00.000Z',
    )

    expect(await repository.get(scope, 'conv_2')).toBeNull()
    expect(await database.all('SELECT * FROM cached_conversations')).toHaveLength(2)
  })

  it('orders messages chronologically', async () => {
    const conversations = new ConversationRepository(database)
    const messages = new MessageRepository(database)
    await conversations.upsert('prj_12', conversation, '2026-11-25T10:01:00.000Z')
    await messages.upsert(
      'prj_12',
      { ...message, id: 'msg_2', client_mutation_id: 'cm_2', sent_at: '2026-11-25T10:02:00.000Z' },
      '2026-11-25T10:02:00.000Z',
    )
    await messages.upsert('prj_12', message, '2026-11-25T10:01:00.000Z')

    const result = await messages.list('prj_12', 'conv_1')
    expect(result.items.map((item) => item.id)).toEqual(['msg_1', 'msg_2'])
  })

  it('rolls back the whole batch and cursor when a change fails', async () => {
    const engine = new SyncEngine(database)
    const invalidChange: SyncChange = {
      entity: 'message',
      id: 'msg_missing',
      op: 'upsert',
      version: 1,
      updated_at: '2026-11-25T10:03:00.000Z',
      deleted_at: null,
      data: null,
    }

    await expect(
      engine.applyChatChanges(
        'prj_12',
        [
          {
            entity: 'conversation',
            id: 'conv_1',
            op: 'upsert',
            version: 1,
            updated_at: conversation.updated_at,
            deleted_at: null,
            data: conversation,
          },
          invalidChange,
        ],
        'cursor_1',
      ),
    ).rejects.toThrow('has no data')

    expect(await database.all('SELECT * FROM cached_conversations')).toHaveLength(0)
    expect(await engine.getCursor('prj_12', 'chat')).toBeNull()
  })

  it('advances the cursor only after a successful batch', async () => {
    const engine = new SyncEngine(database)
    await engine.applyChatChanges(
      'prj_12',
      [
        {
          entity: 'conversation',
          id: 'conv_1',
          op: 'upsert',
          version: 1,
          updated_at: conversation.updated_at,
          deleted_at: null,
          data: conversation,
        },
        {
          entity: 'message',
          id: 'msg_1',
          op: 'upsert',
          version: 1,
          updated_at: message.updated_at,
          deleted_at: null,
          data: message,
        },
      ],
      'cursor_1',
      '2026-11-25T10:04:00.000Z',
    )

    expect(await engine.getCursor('prj_12', 'chat')).toMatchObject({
      cursor: 'cursor_1',
      status: 'success',
    })
  })

  it('keeps user data isolated', async () => {
    const repository = new ConversationRepository(database)
    await repository.upsert('prj_12', conversation, '2026-11-25T10:01:00.000Z')
    expect(await repository.list('prj_99')).toMatchObject({ items: [], has_more: false })
  })

  it('applies tombstones without losing message history', async () => {
    const engine = new SyncEngine(database)
    await engine.applyChatChanges(
      'prj_12',
      [
        {
          entity: 'conversation',
          id: 'conv_1',
          op: 'upsert',
          version: 1,
          updated_at: conversation.updated_at,
          deleted_at: null,
          data: conversation,
        },
        {
          entity: 'message',
          id: 'msg_1',
          op: 'upsert',
          version: 1,
          updated_at: message.updated_at,
          deleted_at: null,
          data: message,
        },
      ],
      'cursor_1',
    )
    await engine.applyChatChanges(
      'prj_12',
      [
        {
          entity: 'conversation',
          id: 'conv_1',
          op: 'delete',
          version: 2,
          updated_at: '2026-11-25T10:05:00.000Z',
          deleted_at: '2026-11-25T10:05:00.000Z',
          data: null,
        },
      ],
      'cursor_2',
    )

    expect(await new ConversationRepository(database).get('prj_12', 'conv_1')).toBeNull()
    expect(await database.all('SELECT * FROM cached_messages')).toHaveLength(1)
  })
})
