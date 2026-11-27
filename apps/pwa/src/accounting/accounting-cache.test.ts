// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  AccountingDashboard,
  AccountingDocument,
  CanonicalMessage,
  Conversation,
  Order,
} from '@superapp/chat-contracts'
import type { LocalDatabase, PayloadCipher, SqlValue } from '@superapp/local-db'
import { runMigrations } from '@superapp/local-db/migrate'
import { createAesGcmPayloadCipher, PayloadCipherError } from '@superapp/local-db/payload-cipher'
import {
  AccountingRepository,
  ACCOUNTING_CACHE_RETENTION_DAYS,
  ConversationRepository,
  MessageRepository,
  OrderRepository,
} from '@superapp/local-db/repositories'
import { ShopRepository } from '@superapp/local-db/shop-repository'
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

const OWNER_ID = 'owner_1'
const OTHER_OWNER_ID = 'owner_2'
const NOW = '2026-11-26T10:00:00.000Z'
const SYNCED_AT = '2026-11-26T10:05:00.000Z'
const DAY_MS = 24 * 60 * 60 * 1000
const TEST_KEY = Uint8Array.from({ length: 32 }, (_, index) => index + 1)
const WRONG_KEY = Uint8Array.from({ length: 32 }, (_, index) => 255 - index)

function createCipher(getKey: () => Uint8Array = () => TEST_KEY) {
  return createAesGcmPayloadCipher({ getKey, randomBytes })
}

const cipher = createCipher()

function document(overrides: Partial<AccountingDocument> = {}): AccountingDocument {
  return {
    id: 'doc_1',
    code: 'INV-PLAINTEXT-9471',
    type: 'invoice',
    status: 'confirmed',
    counterparty_name: 'COUNTERPARTY-PLAINTEXT-9471',
    total: { amount: 987654321012345, currency: 'IRR' },
    issued_at: '2026-11-20T09:30:00.000Z',
    updated_at: '2026-11-26T09:30:00.000Z',
    deleted_at: null,
    description: 'DESCRIPTION-PLAINTEXT-9471',
    ...overrides,
  }
}

const dashboard: AccountingDashboard = {
  total_receivable: { amount: 876543210987654, currency: 'IRR' },
  total_payable: { amount: 123456789012345, currency: 'IRR' },
  current_balance: { amount: 753086421975309, currency: 'IRR' },
  documents_count: 1,
  balances: [
    {
      account_id: 'acc_1',
      title: 'ACCOUNT-TITLE-PLAINTEXT-9471',
      balance: { amount: 753086421975309, currency: 'IRR' },
      updated_at: NOW,
    },
  ],
  updated_at: '2026-11-26T09:45:00.000Z',
}

const filterDocuments = [
  document({
    id: 'doc_before',
    code: 'INV-BEFORE',
    description: 'Boundary before service',
    issued_at: '2026-11-20T23:59:59.999Z',
  }),
  document({
    id: 'doc_start',
    code: 'INV-START',
    description: 'Boundary start service',
    issued_at: '2026-11-21T00:00:00.000Z',
  }),
  document({
    id: 'doc_middle',
    code: 'INV-MIDDLE',
    description: 'Boundary middle service',
    issued_at: '2026-11-22T12:00:00.000Z',
  }),
  document({
    id: 'doc_receipt',
    code: 'RCPT-MIDDLE',
    type: 'receipt',
    status: 'draft',
    counterparty_name: 'Needle Counterparty',
    description: 'Needle description service',
    issued_at: '2026-11-22T18:00:00.000Z',
  }),
  document({
    id: 'doc_cancelled',
    code: 'INV-CANCELLED',
    status: 'cancelled',
    description: 'Boundary cancelled service',
    issued_at: '2026-11-22T19:00:00.000Z',
  }),
  document({
    id: 'doc_end',
    code: 'INV-END',
    description: 'Boundary end service',
    issued_at: '2026-11-23T23:59:59.999Z',
  }),
  document({
    id: 'doc_after',
    code: 'INV-AFTER',
    description: 'Boundary after service',
    issued_at: '2026-11-24T00:00:00.000Z',
  }),
]

const boundaryFilters = {
  search: ' boundary ',
  type: 'invoice',
  status: 'confirmed',
  issued_from: '2026-11-21',
  issued_to: '2026-11-23',
} as const

interface AccountingRow {
  owner_id: string
  server_id: string
  issued_at: string
  updated_at: string
  deleted_at: string | null
  synced_at: string
  expires_at: string
  payload_ciphertext: string
}

interface ReportRow {
  owner_id: string
  report_key: string
  payload_json: string
  updated_at: string
  synced_at: string
  expires_at: string | null
}

let database: NodeSqliteDatabase

function createRepository(
  options: { cipher?: PayloadCipher; retentionDays?: number; now?: () => Date } = {},
) {
  return new AccountingRepository(database, {
    cipher,
    now: () => new Date(NOW),
    ...options,
  })
}

function expectEncryptedPayload(payload: string, plaintextValues: readonly string[]) {
  expect(payload).toMatch(/^v1\.[0-9a-f]{24}\.[0-9a-f]+$/)
  for (const value of plaintextValues) expect(payload).not.toContain(value)
}

function tamperCiphertext(payload: string) {
  const [version, nonce, encrypted] = payload.split('.')
  if (!version || !nonce || !encrypted) throw new Error('Expected a versioned ciphertext payload.')
  const flippedFirstNibble = encrypted[0] === '0' ? '1' : '0'
  return `${version}.${nonce}.${flippedFirstNibble}${encrypted.slice(1)}`
}

beforeEach(async () => {
  database = new NodeSqliteDatabase()
  await runMigrations(database)
})

afterEach(async () => {
  await database.close()
})

describe('encrypted accounting cache', () => {
  it('stores only ciphertext and removes legacy plaintext financial columns', async () => {
    const repository = createRepository()
    await repository.upsert(OWNER_ID, document(), SYNCED_AT)
    await repository.saveDashboard(OWNER_ID, dashboard, SYNCED_AT)

    const accountingColumns = await database.all<{ name: string }>(
      'PRAGMA table_info(cached_accounting_documents)',
    )
    expect(accountingColumns.map((column) => column.name)).toEqual([
      'owner_id',
      'server_id',
      'issued_at',
      'updated_at',
      'deleted_at',
      'synced_at',
      'expires_at',
      'payload_ciphertext',
    ])
    for (const legacyColumn of [
      'code',
      'type',
      'status',
      'counterparty_name',
      'total_amount',
      'currency',
      'payload_json',
    ]) {
      expect(accountingColumns.map((column) => column.name)).not.toContain(legacyColumn)
    }

    const accountingRows = await database.all<AccountingRow>(
      'SELECT * FROM cached_accounting_documents WHERE owner_id = ?',
      [OWNER_ID],
    )
    const reportRows = await database.all<ReportRow>(
      "SELECT * FROM cached_reports WHERE owner_id = ? AND report_key = 'accounting:dashboard'",
      [OWNER_ID],
    )
    expect(accountingRows).toHaveLength(1)
    expect(reportRows).toHaveLength(1)

    const sensitiveValues = [
      document().code,
      document().counterparty_name,
      String(document().total.amount),
      document().description,
      String(dashboard.total_receivable.amount),
      String(dashboard.total_payable.amount),
      String(dashboard.current_balance.amount),
      dashboard.balances[0]!.title,
    ]
    expectEncryptedPayload(accountingRows[0]!.payload_ciphertext, sensitiveValues)
    expectEncryptedPayload(reportRows[0]!.payload_json, sensitiveValues)
    for (const value of sensitiveValues) {
      expect(JSON.stringify(accountingRows[0])).not.toContain(value)
      expect(JSON.stringify(reportRows[0])).not.toContain(value)
    }
  })

  it('round-trips documents and dashboards and rejects wrong keys and tampered payloads', async () => {
    const repository = createRepository()
    await repository.upsert(OWNER_ID, document(), SYNCED_AT)
    await repository.saveDashboard(OWNER_ID, dashboard, SYNCED_AT)

    expect(await repository.get(OWNER_ID, document().id)).toEqual(document())
    expect(await repository.getDashboard(OWNER_ID)).toEqual(dashboard)

    const wrongKeyRepository = new AccountingRepository(database, {
      cipher: createCipher(() => WRONG_KEY),
      now: () => new Date(NOW),
    })
    await expect(wrongKeyRepository.get(OWNER_ID, document().id)).rejects.toBeInstanceOf(
      PayloadCipherError,
    )
    await expect(wrongKeyRepository.getDashboard(OWNER_ID)).rejects.toBeInstanceOf(
      PayloadCipherError,
    )

    const accountingRow = await database.get<AccountingRow>(
      'SELECT * FROM cached_accounting_documents WHERE owner_id = ? AND server_id = ?',
      [OWNER_ID, document().id],
    )
    await database.run(
      'UPDATE cached_accounting_documents SET payload_ciphertext = ? WHERE owner_id = ? AND server_id = ?',
      [tamperCiphertext(accountingRow!.payload_ciphertext), OWNER_ID, document().id],
    )
    await expect(repository.get(OWNER_ID, document().id)).rejects.toBeInstanceOf(PayloadCipherError)

    const reportRow = await database.get<ReportRow>(
      "SELECT * FROM cached_reports WHERE owner_id = ? AND report_key = 'accounting:dashboard'",
      [OWNER_ID],
    )
    await database.run(
      "UPDATE cached_reports SET payload_json = ? WHERE owner_id = ? AND report_key = 'accounting:dashboard'",
      [tamperCiphertext(reportRow!.payload_json), OWNER_ID],
    )
    await expect(repository.getDashboard(OWNER_ID)).rejects.toBeInstanceOf(PayloadCipherError)
  })

  it('uses a fresh AES-GCM nonce when the same payload is stored again', async () => {
    const repository = createRepository()
    await repository.upsert(OWNER_ID, document(), SYNCED_AT)
    const firstRow = await database.get<AccountingRow>(
      'SELECT * FROM cached_accounting_documents WHERE owner_id = ? AND server_id = ?',
      [OWNER_ID, document().id],
    )

    await repository.upsert(OWNER_ID, document(), '2026-11-26T10:06:00.000Z')
    const secondRow = await database.get<AccountingRow>(
      'SELECT * FROM cached_accounting_documents WHERE owner_id = ? AND server_id = ?',
      [OWNER_ID, document().id],
    )

    expect(secondRow!.payload_ciphertext).not.toBe(firstRow!.payload_ciphertext)
    expect(await repository.get(OWNER_ID, document().id)).toEqual(document())
  })

  it('filters decrypted documents by search, type, status and inclusive date-only ranges', async () => {
    const repository = createRepository()
    await repository.saveDocuments(OWNER_ID, filterDocuments, SYNCED_AT)

    expect(
      (await repository.list(OWNER_ID, { search: ' inv-start ' })).items.map((item) => item.id),
    ).toEqual(['doc_start'])
    expect(
      (await repository.list(OWNER_ID, { search: ' NEEDLE ' })).items.map((item) => item.id),
    ).toEqual(['doc_receipt'])
    expect(
      (await repository.list(OWNER_ID, { search: 'middle service' })).items.map((item) => item.id),
    ).toEqual(['doc_middle'])
    expect(
      (await repository.list(OWNER_ID, { type: 'invoice' })).items.map((item) => item.id),
    ).toEqual(['doc_after', 'doc_end', 'doc_cancelled', 'doc_middle', 'doc_start', 'doc_before'])
    expect(
      (await repository.list(OWNER_ID, { status: 'confirmed' })).items.map((item) => item.id),
    ).toEqual(['doc_after', 'doc_end', 'doc_middle', 'doc_start', 'doc_before'])
    expect(
      (
        await repository.list(OWNER_ID, {
          issued_from: '2026-11-21',
          issued_to: '2026-11-23',
        })
      ).items.map((item) => item.id),
    ).toEqual(['doc_end', 'doc_cancelled', 'doc_receipt', 'doc_middle', 'doc_start'])
    expect((await repository.list(OWNER_ID, boundaryFilters)).items.map((item) => item.id)).toEqual(
      ['doc_end', 'doc_middle', 'doc_start'],
    )
  })

  it('rejects invalid or reversed date ranges instead of returning unfiltered rows', async () => {
    const repository = createRepository()
    await repository.saveDocuments(OWNER_ID, filterDocuments, SYNCED_AT)

    await expect(repository.list(OWNER_ID, { issued_from: '2026-02-31' })).rejects.toThrow(
      'Accounting date range is invalid.',
    )
    await expect(
      repository.list(OWNER_ID, { issued_from: '2026-11-25', issued_to: '2026-11-24' }),
    ).rejects.toThrow('Accounting date range is invalid.')
  })

  it('paginates the filtered result set without duplicates or gaps', async () => {
    const repository = createRepository()
    await repository.saveDocuments(OWNER_ID, filterDocuments, SYNCED_AT)

    const first = await repository.list(OWNER_ID, { ...boundaryFilters, limit: 1 })
    const second = await repository.list(OWNER_ID, {
      ...boundaryFilters,
      limit: 1,
      cursor: first.next_cursor!,
    })
    const third = await repository.list(OWNER_ID, {
      ...boundaryFilters,
      limit: 1,
      cursor: second.next_cursor!,
    })

    expect(first.items.map((item) => item.id)).toEqual(['doc_end'])
    expect(first).toMatchObject({ next_cursor: 'offset_1', has_more: true })
    expect(second.items.map((item) => item.id)).toEqual(['doc_middle'])
    expect(second).toMatchObject({ next_cursor: 'offset_2', has_more: true })
    expect(third.items.map((item) => item.id)).toEqual(['doc_start'])
    expect(third).toMatchObject({ next_cursor: null, has_more: false })
  })

  it('ignores older upserts, hides newer tombstones and blocks older resurrections', async () => {
    const repository = createRepository()
    const current = document({ code: 'INV-CURRENT', updated_at: '2026-11-26T10:00:00.000Z' })
    await repository.upsert(OWNER_ID, current, '2026-11-26T10:01:00.000Z')
    await repository.upsert(
      OWNER_ID,
      {
        ...current,
        code: 'INV-STALE',
        description: 'Stale payload',
        updated_at: '2026-11-26T09:00:00.000Z',
      },
      '2026-11-26T12:00:00.000Z',
    )
    expect(await repository.get(OWNER_ID, current.id)).toEqual(current)

    const deletedAt = '2026-11-26T11:00:00.000Z'
    await repository.markDeleted(OWNER_ID, current.id, deletedAt, deletedAt)
    expect(await repository.get(OWNER_ID, current.id)).toBeNull()
    expect(await repository.list(OWNER_ID)).toMatchObject({ items: [] })

    await repository.upsert(
      OWNER_ID,
      {
        ...current,
        code: 'INV-STALE-RESURRECTION',
        updated_at: '2026-11-26T10:30:00.000Z',
        deleted_at: null,
      },
      '2026-11-26T12:05:00.000Z',
    )
    expect(await repository.get(OWNER_ID, current.id)).toBeNull()
    expect(
      await database.get(
        'SELECT deleted_at, updated_at FROM cached_accounting_documents WHERE owner_id = ? AND server_id = ?',
        [OWNER_ID, current.id],
      ),
    ).toEqual({ deleted_at: deletedAt, updated_at: deletedAt })

    const restored = { ...current, code: 'INV-RESTORED', updated_at: '2026-11-26T11:01:00.000Z' }
    await repository.upsert(OWNER_ID, restored, '2026-11-26T12:06:00.000Z')
    expect(await repository.get(OWNER_ID, current.id)).toEqual(restored)
  })

  it('purges documents and dashboard data at the default 30-day retention boundary', async () => {
    let now = Date.parse(NOW)
    const repository = createRepository({ now: () => new Date(now) })
    await repository.upsert(OWNER_ID, document(), SYNCED_AT)
    await repository.saveDashboard(OWNER_ID, dashboard, SYNCED_AT)
    await repository.upsert(OTHER_OWNER_ID, document(), SYNCED_AT)
    await repository.saveDashboard(OTHER_OWNER_ID, dashboard, SYNCED_AT)

    const expiresAt = new Date(now + 30 * DAY_MS).toISOString()
    expect(ACCOUNTING_CACHE_RETENTION_DAYS).toBe(30)
    expect(
      await database.get<AccountingRow>(
        'SELECT expires_at FROM cached_accounting_documents WHERE owner_id = ?',
        [OWNER_ID],
      ),
    ).toEqual({ expires_at: expiresAt })
    expect(
      await database.get<ReportRow>(
        "SELECT expires_at FROM cached_reports WHERE owner_id = ? AND report_key = 'accounting:dashboard'",
        [OWNER_ID],
      ),
    ).toEqual({ expires_at: expiresAt })

    now += 30 * DAY_MS
    expect(await repository.get(OWNER_ID, document().id)).toBeNull()
    expect(await repository.getDashboard(OWNER_ID)).toBeNull()
    expect(
      await database.all('SELECT * FROM cached_accounting_documents WHERE owner_id = ?', [
        OWNER_ID,
      ]),
    ).toEqual([])
    expect(
      await database.all(
        "SELECT * FROM cached_reports WHERE owner_id = ? AND report_key LIKE 'accounting:%'",
        [OWNER_ID],
      ),
    ).toEqual([])
    expect(
      await database.all('SELECT * FROM cached_accounting_documents WHERE owner_id = ?', [
        OTHER_OWNER_ID,
      ]),
    ).toHaveLength(1)
    expect(
      await database.all(
        "SELECT * FROM cached_reports WHERE owner_id = ? AND report_key LIKE 'accounting:%'",
        [OTHER_OWNER_ID],
      ),
    ).toHaveLength(1)
  })

  it('honors configurable retention for documents and dashboard data', async () => {
    let now = Date.parse(NOW)
    const repository = createRepository({ retentionDays: 7, now: () => new Date(now) })
    await repository.upsert(OWNER_ID, document(), SYNCED_AT)
    await repository.saveDashboard(OWNER_ID, dashboard, SYNCED_AT)

    const expiresAt = new Date(now + 7 * DAY_MS).toISOString()
    expect(
      await database.get<AccountingRow>(
        'SELECT expires_at FROM cached_accounting_documents WHERE owner_id = ?',
        [OWNER_ID],
      ),
    ).toEqual({ expires_at: expiresAt })
    expect(
      await database.get<ReportRow>(
        "SELECT expires_at FROM cached_reports WHERE owner_id = ? AND report_key = 'accounting:dashboard'",
        [OWNER_ID],
      ),
    ).toEqual({ expires_at: expiresAt })

    now += 7 * DAY_MS - 1
    expect(await repository.get(OWNER_ID, document().id)).toEqual(document())
    expect(await repository.getDashboard(OWNER_ID)).toEqual(dashboard)

    now += 1
    expect(await repository.get(OWNER_ID, document().id)).toBeNull()
    expect(await repository.getDashboard(OWNER_ID)).toBeNull()
    expect(
      await database.all('SELECT * FROM cached_accounting_documents WHERE owner_id = ?', [
        OWNER_ID,
      ]),
    ).toEqual([])
    expect(
      await database.all(
        "SELECT * FROM cached_reports WHERE owner_id = ? AND report_key LIKE 'accounting:%'",
        [OWNER_ID],
      ),
    ).toEqual([])
  })

  it('purges expired financial rows before saving a dashboard snapshot', async () => {
    let now = Date.parse(NOW)
    const repository = createRepository({ now: () => new Date(now) })
    await repository.saveDocuments(OWNER_ID, [document()], SYNCED_AT)
    now += 30 * DAY_MS

    await repository.saveDashboard(OWNER_ID, dashboard, new Date(now).toISOString())

    expect(
      await database.all('SELECT * FROM cached_accounting_documents WHERE owner_id = ?', [
        OWNER_ID,
      ]),
    ).toEqual([])
    expect(await repository.getDashboard(OWNER_ID)).toEqual(dashboard)
  })

  it('records a synchronized empty document page', async () => {
    const repository = createRepository()
    await repository.saveDocuments(OWNER_ID, [], SYNCED_AT)

    expect(await repository.list(OWNER_ID)).toMatchObject({ items: [], has_more: false })
    expect(await repository.getSyncState(OWNER_ID, 'accounting:documents')).toMatchObject({
      last_synced_at: SYNCED_AT,
      status: 'success',
    })
  })

  it('does not let a stale dashboard payload overwrite a newer dashboard', async () => {
    const repository = createRepository()
    const newerDashboard = { ...dashboard, updated_at: '2026-11-26T12:00:00.000Z' }
    await repository.saveDashboard(OWNER_ID, newerDashboard, '2026-11-26T12:01:00.000Z')
    const before = await database.get<ReportRow>(
      "SELECT * FROM cached_reports WHERE owner_id = ? AND report_key = 'accounting:dashboard'",
      [OWNER_ID],
    )

    await repository.saveDashboard(OWNER_ID, dashboard, '2026-11-26T13:00:00.000Z')
    const after = await database.get<ReportRow>(
      "SELECT * FROM cached_reports WHERE owner_id = ? AND report_key = 'accounting:dashboard'",
      [OWNER_ID],
    )

    expect(await repository.getDashboard(OWNER_ID)).toEqual(newerDashboard)
    expect(after).toEqual(before)
  })

  it('clears only the owner accounting scope and preserves shop, chat and other-owner data', async () => {
    const accounting = createRepository()
    const shop = new ShopRepository(database)
    const conversations = new ConversationRepository(database)
    const messages = new MessageRepository(database)
    const orders = new OrderRepository(database)
    const engine = new SyncEngine(database)
    const otherOwnerDocument = document({ id: 'doc_other_owner', code: 'INV-OTHER-OWNER' })
    const order: Order = {
      id: 'ord_1',
      code: 'ORD-1',
      customer_name: 'Shop Customer',
      status: 'paid',
      payment_status: 'paid',
      total: { amount: 1000, currency: 'IRR' },
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
      lines: [],
    }
    const shopDashboard = {
      today_sales: { amount: 1000, currency: 'IRR' as const },
      today_orders: 1,
      pending_orders: 0,
      low_stock_products: 0,
      updated_at: NOW,
    }
    const conversation: Conversation = {
      id: 'conv_1',
      project_id: 'prj_1',
      source: 'bale',
      robot_id: 'robot_1',
      chat_id: 'chat_1',
      customer: { id: 'customer_1', display_name: 'Chat Customer', initials: 'CC' },
      support_level: 'level_1',
      status: 'open',
      assignee: null,
      last_message: 'Hello',
      last_message_at: NOW,
      unread_count: 0,
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
    }
    const message: CanonicalMessage = {
      id: 'msg_1',
      conversation_id: conversation.id,
      client_mutation_id: null,
      sender: 'client',
      sender_id: 'customer_1',
      text: 'Hello',
      attachment: null,
      sent_at: NOW,
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null,
      delivery_status: 'sent',
    }

    await accounting.saveDocuments(OWNER_ID, [document()], SYNCED_AT)
    await accounting.saveDashboard(OWNER_ID, dashboard, SYNCED_AT)
    await accounting.saveDocuments(OTHER_OWNER_ID, [otherOwnerDocument], SYNCED_AT)
    await accounting.saveDashboard(OTHER_OWNER_ID, dashboard, SYNCED_AT)
    await shop.saveOrders(OWNER_ID, [order], SYNCED_AT)
    await shop.saveDashboard(OWNER_ID, shopDashboard, SYNCED_AT)
    await engine.applyChatChanges(
      OWNER_ID,
      [
        {
          entity: 'conversation',
          id: conversation.id,
          op: 'upsert',
          version: 1,
          updated_at: conversation.updated_at,
          deleted_at: null,
          data: conversation,
        },
        {
          entity: 'message',
          id: message.id,
          op: 'upsert',
          version: 1,
          updated_at: message.updated_at,
          deleted_at: null,
          data: message,
        },
      ],
      'chat_cursor_1',
      SYNCED_AT,
    )

    await accounting.clear(OWNER_ID)

    expect(await accounting.get(OWNER_ID, document().id)).toBeNull()
    expect(await accounting.list(OWNER_ID)).toMatchObject({ items: [] })
    expect(await accounting.getDashboard(OWNER_ID)).toBeNull()
    expect(
      await database.all(
        "SELECT * FROM cached_reports WHERE owner_id = ? AND report_key LIKE 'accounting:%'",
        [OWNER_ID],
      ),
    ).toEqual([])
    expect(
      await database.all(
        "SELECT * FROM sync_state WHERE owner_id = ? AND dataset LIKE 'accounting:%'",
        [OWNER_ID],
      ),
    ).toEqual([])

    expect(await accounting.get(OTHER_OWNER_ID, otherOwnerDocument.id)).toEqual(otherOwnerDocument)
    expect(await accounting.getDashboard(OTHER_OWNER_ID)).toEqual(dashboard)
    expect(await accounting.getSyncState(OTHER_OWNER_ID, 'accounting:documents')).toMatchObject({
      last_synced_at: SYNCED_AT,
      status: 'success',
    })
    expect(await shop.getDashboard(OWNER_ID)).toEqual(shopDashboard)
    expect((await orders.list(OWNER_ID)).items).toEqual([order])
    expect(await shop.getSyncState(OWNER_ID, 'shop:orders')).toMatchObject({
      last_synced_at: SYNCED_AT,
      status: 'success',
    })
    expect(await conversations.get(OWNER_ID, conversation.id)).toEqual(conversation)
    expect((await messages.list(OWNER_ID, conversation.id)).items).toEqual([message])
    expect(await engine.getCursor(OWNER_ID, 'chat')).toMatchObject({
      cursor: 'chat_cursor_1',
      last_synced_at: SYNCED_AT,
      status: 'success',
    })
  })

  it('applies accounting snapshots as encrypted payloads and advances the cursor', async () => {
    const engine = new SyncEngine(database, { accountingCipher: cipher })
    const result = await engine.applyAccountingSnapshot(
      OWNER_ID,
      [document()],
      'accounting_cursor_1',
      SYNCED_AT,
    )

    expect(result).toEqual({
      applied: 1,
      cursor: 'accounting_cursor_1',
      syncedAt: SYNCED_AT,
    })
    expect(await createRepository().get(OWNER_ID, document().id)).toEqual(document())
    expect(await engine.getCursor(OWNER_ID, 'accounting')).toMatchObject({
      cursor: 'accounting_cursor_1',
      last_synced_at: SYNCED_AT,
      status: 'success',
    })
    const row = await database.get<AccountingRow>(
      'SELECT * FROM cached_accounting_documents WHERE owner_id = ? AND server_id = ?',
      [OWNER_ID, document().id],
    )
    expectEncryptedPayload(row!.payload_ciphertext, [
      document().code,
      document().counterparty_name,
      String(document().total.amount),
      document().description,
    ])
  })

  it('rejects accounting snapshots without a cipher and rolls back rows and cursor', async () => {
    const encryptedEngine = new SyncEngine(database, { accountingCipher: cipher })
    await encryptedEngine.applyAccountingSnapshot(
      OWNER_ID,
      [document()],
      'accounting_cursor_secure',
      SYNCED_AT,
    )
    const rowsBefore = await database.all<AccountingRow>(
      'SELECT * FROM cached_accounting_documents ORDER BY owner_id, server_id',
    )
    const cursorBefore = await encryptedEngine.getCursor(OWNER_ID, 'accounting')
    const engineWithoutCipher = new SyncEngine(database)

    await expect(
      engineWithoutCipher.applyAccountingSnapshot(
        OWNER_ID,
        [document({ id: 'doc_unencrypted', code: 'INV-UNENCRYPTED' })],
        'accounting_cursor_rejected',
        '2026-11-26T11:00:00.000Z',
      ),
    ).rejects.toThrow('Encrypted accounting cache requires a PayloadCipher.')

    expect(
      await database.all<AccountingRow>(
        'SELECT * FROM cached_accounting_documents ORDER BY owner_id, server_id',
      ),
    ).toEqual(rowsBefore)
    expect(await engineWithoutCipher.getCursor(OWNER_ID, 'accounting')).toEqual(cursorBefore)
  })
})
