// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CanonicalMessage, Conversation, SyncChange } from '@superapp/chat-contracts'
import {
  createMockConversationApi,
  createPlanetConversationApi,
  PlanetApiError,
} from '@superapp/api-client'
import type { LocalDatabase, SqlValue } from '@superapp/local-db'
import { BacklogRepository } from '@superapp/local-db/backlog-repository'
import { runMigrations } from '@superapp/local-db/migrate'
import { MessageRepository } from '@superapp/local-db/repositories'

class NodeSqliteDatabase implements LocalDatabase {
  private readonly database = new DatabaseSync(':memory:')
  failSql: string | null = null

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
    if (this.failSql && sql.includes(this.failSql)) {
      this.failSql = null
      throw new Error('simulated database crash')
    }
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

const OWNER = '["op_1","prj_12"]'
const OTHER_OWNER = '["op_2","prj_12"]'
const T1 = '2026-11-25T10:00:00.000Z'
const T2 = '2026-11-25T10:02:00.000Z'
const T3 = '2026-11-25T10:03:00.000Z'
const T4 = '2026-11-25T10:04:00.000Z'
const T5 = '2026-11-25T10:05:00.000Z'

function conversation(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    project_id: 'prj_12',
    source: 'bale',
    robot_id: 'robot_1',
    chat_id: `chat_${id}`,
    customer: { id: `user_${id}`, display_name: 'Customer', initials: 'C' },
    support_level: 'level_1',
    status: 'open',
    assignee: null,
    last_message: 'Conversation',
    last_message_at: T1,
    unread_count: 0,
    created_at: T1,
    updated_at: T1,
    deleted_at: null,
    ...overrides,
  }
}

function message(
  id: string,
  conversationId: string,
  overrides: Partial<CanonicalMessage> = {},
): CanonicalMessage {
  return {
    id,
    conversation_id: conversationId,
    client_mutation_id: null,
    sender: 'client',
    sender_id: 'user_1',
    text: id,
    attachment: null,
    sent_at: T1,
    created_at: T1,
    updated_at: T1,
    deleted_at: null,
    delivery_status: 'sent',
    ...overrides,
  }
}

function upsertConversation(value: Conversation): SyncChange {
  return {
    entity: 'conversation',
    id: value.id,
    op: 'upsert',
    version: 1,
    updated_at: value.updated_at,
    deleted_at: null,
    data: value,
  }
}

function upsertMessage(value: CanonicalMessage): SyncChange {
  return {
    entity: 'message',
    id: value.id,
    op: 'upsert',
    version: 1,
    updated_at: value.updated_at,
    deleted_at: null,
    data: value,
  }
}

function deleteMessage(id: string, deletedAt: string): SyncChange {
  return {
    entity: 'message',
    id,
    op: 'delete',
    version: 2,
    updated_at: deletedAt,
    deleted_at: deletedAt,
    data: null,
  }
}

describe('conversation sync API', () => {
  it('hydrates mock upserts, filters by conversation, and exhausts the mock cursor', async () => {
    const api = createMockConversationApi()
    const first = await api.sync!({ conversation_id: 'conv_1001' })

    expect(first.next_cursor).toBe('mock_cursor_1')
    expect(first.changes.map((change) => change.id)).toEqual(['conv_1001', 'msg_2003'])
    expect(first.changes.every((change) => change.data !== null)).toBe(true)
    expect(first.changes[1]?.data).toMatchObject({ id: 'msg_2003', conversation_id: 'conv_1001' })

    const second = await api.sync!({ conversation_id: 'conv_1001', cursor: first.next_cursor })
    expect(second.changes).toEqual([])
  })

  it('sends an authenticated GET with query and signal and validates the result', async () => {
    const calls: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: new URL(String(input)), init })
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            changes: [],
            next_cursor: 'cursor_1',
            server_time: T5,
            has_more: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const api = createPlanetConversationApi({
      baseUrl: 'https://planet.test/',
      getAccessToken: () => 'access-token',
      fetch: fetchImpl,
    })
    const controller = new AbortController()

    await expect(
      api.sync!(
        { project_id: 'prj_12', conversation_id: 'conv_1', cursor: 'cursor_0', limit: 25 },
        { signal: controller.signal },
      ),
    ).resolves.toMatchObject({ changes: [], next_cursor: 'cursor_1' })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url.pathname).toBe('/api/v1/chat/sync')
    expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({
      project_id: 'prj_12',
      conversation_id: 'conv_1',
      cursor: 'cursor_0',
      limit: '25',
    })
    expect(calls[0]?.init?.method).toBe('GET')
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toBe('Bearer access-token')
    expect(calls[0]?.init?.signal).toBe(controller.signal)
  })

  it('rejects malformed sync results and preserves HTTP 410 errors', async () => {
    const malformedApi = createPlanetConversationApi({
      baseUrl: 'https://planet.test',
      fetch: async () =>
        new Response(
          JSON.stringify({
            status: true,
            data: { changes: [], next_cursor: null, server_time: T5, has_more: false },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    })
    await expect(malformedApi.sync!({})).rejects.toMatchObject({
      name: 'PlanetApiError',
      status: 200,
    })

    const goneApi = createPlanetConversationApi({
      baseUrl: 'https://planet.test',
      fetch: async () => new Response('{}', { status: 410 }),
    })
    const request = goneApi.sync!({})
    await expect(request).rejects.toBeInstanceOf(PlanetApiError)
    await expect(request).rejects.toMatchObject({ status: 410 })
  })
})

describe('BacklogRepository', () => {
  let database: NodeSqliteDatabase
  let repository: BacklogRepository

  beforeEach(async () => {
    database = new NodeSqliteDatabase()
    await runMigrations(database)
    repository = new BacklogRepository(database)
  })

  afterEach(async () => {
    await database.close()
  })

  async function seedConversation(id = 'conv_1') {
    await repository.applyChanges(
      OWNER,
      id,
      [upsertConversation(conversation(id))],
      `seed_${id}`,
      T1,
    )
  }

  it('isolates sync cursors by conversation', async () => {
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [upsertConversation(conversation('conv_1')), upsertMessage(message('msg_1', 'conv_1'))],
      'cursor_conv_1',
      T2,
    )
    await repository.applyChanges(
      OWNER,
      'conv_2',
      [upsertConversation(conversation('conv_2')), upsertMessage(message('msg_2', 'conv_2'))],
      'cursor_conv_2',
      T3,
    )

    expect(await repository.getState(OWNER, 'conv_1')).toEqual({
      owner_id: OWNER,
      dataset: 'chat:conv_1',
      cursor: 'cursor_conv_1',
      last_synced_at: T2,
      status: 'success',
    })
    expect(await repository.getState(OWNER, 'conv_2')).toMatchObject({
      dataset: 'chat:conv_2',
      cursor: 'cursor_conv_2',
      last_synced_at: T3,
      status: 'success',
    })
    expect(await repository.getState(OTHER_OWNER, 'conv_1')).toBeNull()
    expect(
      await database.get(
        'SELECT sync_version FROM cached_conversations WHERE owner_id = ? AND server_id = ?',
        [OWNER, 'conv_1'],
      ),
    ).toEqual({ sync_version: 1 })
    expect(
      await database.get(
        'SELECT sync_version FROM cached_messages WHERE owner_id = ? AND server_id = ?',
        [OWNER, 'msg_1'],
      ),
    ).toEqual({ sync_version: 1 })
  })

  it('merges gapped and duplicate pages without regressing newer records', async () => {
    await seedConversation()
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [upsertMessage(message('msg_1', 'conv_1', { text: 'old' }))],
      'cursor_seed_message',
      T1,
    )

    await repository.applyChanges(
      OWNER,
      'conv_1',
      [
        upsertMessage(message('msg_3', 'conv_1', { sent_at: T4, created_at: T4, updated_at: T4 })),
        upsertMessage(message('msg_2', 'conv_1', { sent_at: T3, created_at: T3, updated_at: T3 })),
        upsertMessage(message('msg_1', 'conv_1', { text: 'stale', updated_at: T1 })),
      ],
      'cursor_gap',
      T4,
    )
    const newer = message('msg_1', 'conv_1', { text: 'new', updated_at: T5 })
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [upsertMessage(newer), upsertMessage(newer)],
      'cursor_duplicate',
      T5,
    )
    await repository.applyChanges(OWNER, 'conv_1', [upsertMessage(newer)], 'cursor_duplicate', T5)

    const result = await new MessageRepository(database).list(OWNER, 'conv_1')
    expect(result.items.map((item) => item.id)).toEqual(['msg_1', 'msg_2', 'msg_3'])
    expect(result.items[0]).toMatchObject({ text: 'new', updated_at: T5 })
    expect(await repository.getState(OWNER, 'conv_1')).toMatchObject({
      cursor: 'cursor_duplicate',
      last_synced_at: T5,
    })
  })

  it('rolls back earlier writes and the cursor when a change is out of scope', async () => {
    await seedConversation()
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [upsertMessage(message('msg_1', 'conv_1'))],
      'cursor_before_invalid',
      T2,
    )

    await expect(
      repository.applyChanges(
        OWNER,
        'conv_1',
        [
          upsertMessage(message('msg_2', 'conv_1', { updated_at: T3 })),
          upsertMessage(message('msg_3', 'conv_2', { updated_at: T3 })),
        ],
        'cursor_invalid',
        T3,
      ),
    ).rejects.toThrow('does not belong to conv_1')

    expect(
      (await new MessageRepository(database).list(OWNER, 'conv_1')).items.map((m) => m.id),
    ).toEqual(['msg_1'])
    expect(await repository.getState(OWNER, 'conv_1')).toMatchObject({
      cursor: 'cursor_before_invalid',
      last_synced_at: T2,
    })
  })

  it('rolls back canonical data when persisting the cursor crashes', async () => {
    await seedConversation()
    database.failSql = 'INSERT INTO sync_state'

    await expect(
      repository.applyChanges(
        OWNER,
        'conv_1',
        [upsertMessage(message('msg_1', 'conv_1', { updated_at: T2 }))],
        'cursor_crash',
        T2,
      ),
    ).rejects.toThrow('simulated database crash')

    expect(await database.all('SELECT * FROM cached_messages')).toEqual([])
    expect(await repository.getState(OWNER, 'conv_1')).toMatchObject({
      cursor: 'seed_conv_1',
      last_synced_at: T1,
    })
  })

  it('tombstones deleted messages, hides them from lists, and ignores stale resurrection', async () => {
    await seedConversation()
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [upsertMessage(message('msg_1', 'conv_1'))],
      'cursor_before_delete',
      T1,
    )

    await repository.applyChanges(
      OWNER,
      'conv_1',
      [deleteMessage('msg_1', T3)],
      'cursor_deleted',
      T3,
    )
    expect(await new MessageRepository(database).list(OWNER, 'conv_1')).toMatchObject({ items: [] })
    expect(
      await database.get('SELECT * FROM cached_messages WHERE server_id = ?', ['msg_1']),
    ).toMatchObject({
      deleted_at: T3,
      cache_status: 'deleted',
      sync_version: 2,
    })

    await repository.applyChanges(
      OWNER,
      'conv_1',
      [upsertMessage(message('msg_1', 'conv_1', { text: 'stale', updated_at: T2 }))],
      'cursor_stale',
      T4,
    )
    expect(await new MessageRepository(database).list(OWNER, 'conv_1')).toMatchObject({ items: [] })
    expect(await repository.getState(OWNER, 'conv_1')).toMatchObject({ cursor: 'cursor_stale' })

    const staleAtDeletion = message('msg_1', 'conv_1', { text: 'stale_equal', updated_at: T3 })
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [
        { ...upsertMessage(staleAtDeletion), version: 2 },
        { ...upsertMessage(staleAtDeletion), version: 1 },
      ],
      'cursor_stale_equal',
      T4,
    )
    expect(await new MessageRepository(database).list(OWNER, 'conv_1')).toMatchObject({ items: [] })
    expect(
      await database.get(
        'SELECT deleted_at, sync_version FROM cached_messages WHERE server_id = ?',
        ['msg_1'],
      ),
    ).toEqual({ deleted_at: T3, sync_version: 2 })

    await repository.applyChanges(
      OWNER,
      'conv_1',
      [
        {
          ...upsertMessage(message('msg_1', 'conv_1', { text: 'revived_equal', updated_at: T3 })),
          version: 3,
        },
      ],
      'cursor_revived_equal',
      T4,
    )
    expect(await new MessageRepository(database).list(OWNER, 'conv_1')).toMatchObject({
      items: [{ id: 'msg_1', text: 'revived_equal' }],
    })
    expect(
      await database.get('SELECT sync_version FROM cached_messages WHERE server_id = ?', ['msg_1']),
    ).toEqual({ sync_version: 3 })
  })

  it('tombstones snapshot omissions without deleting history or touching another scope', async () => {
    await seedConversation()
    await seedConversation('conv_2')
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [upsertMessage(message('msg_1', 'conv_1')), upsertMessage(message('msg_2', 'conv_1'))],
      'cursor_before_snapshot',
      T2,
    )
    await repository.applyChanges(
      OWNER,
      'conv_2',
      [upsertMessage(message('msg_other_conversation', 'conv_2'))],
      'cursor_other_conversation',
      T2,
    )
    await repository.applyChanges(
      OTHER_OWNER,
      'conv_1',
      [
        upsertConversation(conversation('conv_1')),
        upsertMessage(message('msg_other_owner', 'conv_1')),
      ],
      'cursor_other_owner',
      T2,
    )

    await repository.replaceSnapshot(
      OWNER,
      'conv_1',
      [message('msg_1', 'conv_1', { text: 'snapshot', updated_at: T5 })],
      'cursor_snapshot',
      T5,
    )

    expect((await new MessageRepository(database).list(OWNER, 'conv_1')).items).toMatchObject([
      { id: 'msg_1', text: 'snapshot' },
    ])
    expect(
      await database.get('SELECT * FROM cached_messages WHERE owner_id = ? AND server_id = ?', [
        OWNER,
        'msg_2',
      ]),
    ).toMatchObject({ deleted_at: T5, cache_status: 'deleted', sync_version: 2 })
    expect(await database.all('SELECT * FROM cached_messages')).toHaveLength(4)
    expect(
      await database.get(
        'SELECT deleted_at FROM cached_messages WHERE owner_id = ? AND server_id = ?',
        [OWNER, 'msg_other_conversation'],
      ),
    ).toEqual({ deleted_at: null })
    expect(
      await database.get(
        'SELECT deleted_at FROM cached_messages WHERE owner_id = ? AND server_id = ?',
        [OTHER_OWNER, 'msg_other_owner'],
      ),
    ).toEqual({ deleted_at: null })
    expect(await repository.getState(OWNER, 'conv_1')).toMatchObject({
      cursor: 'cursor_snapshot',
      last_synced_at: T5,
      status: 'success',
    })

    const staleSnapshotDelta = message('msg_2', 'conv_1', { text: 'stale', updated_at: T5 })
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [
        { ...upsertMessage(staleSnapshotDelta), version: 2 },
        { ...upsertMessage(staleSnapshotDelta), version: 1 },
      ],
      'cursor_stale_snapshot_delta',
      T5,
    )
    expect(
      await database.get(
        'SELECT deleted_at, sync_version FROM cached_messages WHERE server_id = ?',
        ['msg_2'],
      ),
    ).toEqual({ deleted_at: T5, sync_version: 2 })

    await repository.replaceSnapshot(
      OWNER,
      'conv_1',
      [staleSnapshotDelta],
      'cursor_snapshot_restore',
      T5,
    )
    expect((await new MessageRepository(database).list(OWNER, 'conv_1')).items).toMatchObject([
      { id: 'msg_2', text: 'stale', deleted_at: null },
    ])
  })

  it('removes a matching synthetic hub duplicate before inserting the canonical message', async () => {
    await seedConversation()
    const canonical = message('msg_1', 'conv_1', {
      text: 'canonical',
      attachment: {
        id: 'att_1',
        provider: 'planet',
        type: 'photo',
        file_name: 'photo.jpg',
        mime_type: 'image/jpeg',
        file_size: 10,
        duration: null,
        url: null,
        created_at: T1,
      },
    })
    await new MessageRepository(database).upsert(
      OWNER,
      { ...canonical, id: 'hub_synthetic', client_mutation_id: 'cm_synthetic' },
      T1,
    )

    await repository.applyChanges(
      OWNER,
      'conv_1',
      [upsertMessage(canonical)],
      'cursor_canonical',
      T2,
    )

    expect(await database.all('SELECT server_id FROM cached_messages')).toEqual([
      { server_id: 'msg_1' },
    ])
    expect((await new MessageRepository(database).list(OWNER, 'conv_1')).items).toMatchObject([
      { id: 'msg_1', text: 'canonical' },
    ])
  })

  it('reads applied backlog data offline through fresh repository instances', async () => {
    await repository.applyChanges(
      OWNER,
      'conv_1',
      [
        upsertConversation(conversation('conv_1')),
        upsertMessage(message('msg_1', 'conv_1')),
        upsertMessage(message('msg_2', 'conv_1', { sent_at: T2, created_at: T2, updated_at: T2 })),
      ],
      'cursor_offline',
      T2,
    )

    const offlineRepository = new BacklogRepository(database)
    expect(await offlineRepository.getState(OWNER, 'conv_1')).toMatchObject({
      cursor: 'cursor_offline',
      status: 'success',
    })
    expect(
      (await new MessageRepository(database).list(OWNER, 'conv_1')).items.map((m) => m.id),
    ).toEqual(['msg_1', 'msg_2'])
  })
})
