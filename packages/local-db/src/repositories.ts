import type {
  AccountingDocument,
  CanonicalMessage,
  Conversation,
  Order,
  Product,
} from '@superapp/chat-contracts'
import type { LocalDatabase, SqlValue } from './database'

interface ConversationRow {
  owner_id: string
  project_id: string
  server_id: string
  source: Conversation['source']
  robot_id: string
  chat_id: string
  customer_json: string
  support_level: Conversation['support_level']
  status: Conversation['status']
  assignee_json: string | null
  last_message: string
  last_message_at: string | null
  unread_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface MessageRow {
  owner_id: string
  server_id: string
  conversation_id: string
  client_mutation_id: string | null
  sender: CanonicalMessage['sender']
  sender_id: string
  text: string
  attachment_json: string | null
  sent_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  delivery_status: CanonicalMessage['delivery_status']
}

interface OrderRow {
  owner_id: string
  server_id: string
  code: string
  customer_name: string
  status: Order['status']
  payment_status: Order['payment_status']
  total_amount: number
  currency: 'IRR'
  payload_json: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface ProductRow {
  owner_id: string
  server_id: string
  title: string
  slug: string
  status: Product['status']
  price_amount: number
  currency: 'IRR'
  inventory_quantity: number
  payload_json: string
  updated_at: string
  deleted_at: string | null
}

interface AccountingRow {
  owner_id: string
  server_id: string
  code: string
  type: AccountingDocument['type']
  status: AccountingDocument['status']
  counterparty_name: string
  total_amount: number
  currency: 'IRR'
  payload_json: string
  issued_at: string
  updated_at: string
  deleted_at: string | null
}

function parseJson<T>(value: string | null): T | null {
  return value === null ? null : (JSON.parse(value) as T)
}

function parseOffset(cursor?: string) {
  const match = /^offset_(\d+)$/.exec(cursor || '')
  return match ? Number(match[1]) : 0
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.server_id,
    project_id: row.project_id,
    source: row.source,
    robot_id: row.robot_id,
    chat_id: row.chat_id,
    customer: parseJson<Conversation['customer']>(row.customer_json)!,
    support_level: row.support_level,
    status: row.status,
    assignee: parseJson<Conversation['assignee']>(row.assignee_json),
    last_message: row.last_message,
    last_message_at: row.last_message_at,
    unread_count: row.unread_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

function toMessage(row: MessageRow): CanonicalMessage {
  return {
    id: row.server_id,
    conversation_id: row.conversation_id,
    client_mutation_id: row.client_mutation_id,
    sender: row.sender,
    sender_id: row.sender_id,
    text: row.text,
    attachment: parseJson<CanonicalMessage['attachment']>(row.attachment_json),
    sent_at: row.sent_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    delivery_status: row.delivery_status,
  }
}

function toOrder(row: OrderRow): Order {
  return parseJson<Order>(row.payload_json)!
}

function toProduct(row: ProductRow): Product {
  return parseJson<Product>(row.payload_json)!
}

function toAccountingDocument(row: AccountingRow): AccountingDocument {
  return parseJson<AccountingDocument>(row.payload_json)!
}

export class ConversationRepository {
  constructor(private readonly database: LocalDatabase) {}

  async upsert(ownerId: string, conversation: Conversation, syncedAt: string) {
    await this.database.run(
      `INSERT INTO cached_conversations (
        owner_id, project_id, server_id, source, robot_id, chat_id, customer_json,
        support_level, status, assignee_json, last_message, last_message_at,
        unread_count, created_at, updated_at, deleted_at, synced_at, cache_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, server_id) DO UPDATE SET
        project_id = excluded.project_id,
        source = excluded.source,
        robot_id = excluded.robot_id,
        chat_id = excluded.chat_id,
        customer_json = excluded.customer_json,
        support_level = excluded.support_level,
        status = excluded.status,
        assignee_json = excluded.assignee_json,
        last_message = excluded.last_message,
        last_message_at = excluded.last_message_at,
        unread_count = excluded.unread_count,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        synced_at = excluded.synced_at,
        cache_status = excluded.cache_status
      WHERE (cached_conversations.deleted_at IS NULL
        AND excluded.updated_at >= cached_conversations.updated_at)
        OR (cached_conversations.deleted_at IS NOT NULL
        AND excluded.updated_at > cached_conversations.updated_at)`,
      [
        ownerId,
        conversation.project_id,
        conversation.id,
        conversation.source,
        conversation.robot_id,
        conversation.chat_id,
        JSON.stringify(conversation.customer),
        conversation.support_level,
        conversation.status,
        conversation.assignee ? JSON.stringify(conversation.assignee) : null,
        conversation.last_message,
        conversation.last_message_at,
        conversation.unread_count,
        conversation.created_at,
        conversation.updated_at,
        conversation.deleted_at,
        syncedAt,
        'synced',
      ],
    )
  }

  async markDeleted(ownerId: string, id: string, deletedAt: string, syncedAt: string) {
    await this.database.run(
      `UPDATE cached_conversations
       SET deleted_at = ?, updated_at = ?, synced_at = ?, cache_status = 'deleted'
       WHERE owner_id = ? AND server_id = ?`,
      [deletedAt, deletedAt, syncedAt, ownerId, id],
    )
  }

  async markMissingDeleted(
    ownerId: string,
    retainedIds: string[],
    deletedAt: string,
    syncedAt: string,
  ) {
    await this.database.run(
      `UPDATE cached_conversations
       SET deleted_at = ?, updated_at = MAX(updated_at, ?), synced_at = ?, cache_status = 'deleted'
       WHERE owner_id = ? AND deleted_at IS NULL
         AND server_id NOT IN (SELECT value FROM json_each(?))`,
      [deletedAt, syncedAt, syncedAt, ownerId, JSON.stringify(retainedIds)],
    )
  }

  async get(ownerId: string, id: string) {
    const row = await this.database.get<ConversationRow>(
      'SELECT * FROM cached_conversations WHERE owner_id = ? AND server_id = ? AND deleted_at IS NULL',
      [ownerId, id],
    )
    return row ? toConversation(row) : null
  }

  async list(
    ownerId: string,
    filters: {
      search?: string
      source?: Conversation['source']
      supportLevel?: Conversation['support_level']
      status?: Conversation['status']
      assigneeId?: string
      unreadOnly?: boolean
      cursor?: string
      limit?: number
    } = {},
  ) {
    const conditions = ['owner_id = ?', 'deleted_at IS NULL']
    const params: SqlValue[] = [ownerId]
    if (filters.search) {
      conditions.push(
        "(last_message LIKE ? ESCAPE '\\' OR json_extract(customer_json, '$.display_name') LIKE ? ESCAPE '\\' OR chat_id LIKE ? ESCAPE '\\' OR json_extract(assignee_json, '$.name') LIKE ? ESCAPE '\\')",
      )
      const search = `%${escapeLike(filters.search)}%`
      params.push(search, search, search, search)
    }
    if (filters.source) {
      conditions.push('source = ?')
      params.push(filters.source)
    }
    if (filters.supportLevel) {
      conditions.push('support_level = ?')
      params.push(filters.supportLevel)
    }
    if (filters.status) {
      conditions.push('status = ?')
      params.push(filters.status)
    }
    if (filters.assigneeId) {
      conditions.push("json_extract(assignee_json, '$.id') = ?")
      params.push(filters.assigneeId)
    }
    if (filters.unreadOnly) conditions.push('unread_count > 0')

    const limit = Math.min(Math.max(filters.limit || 30, 1), 100)
    const offset = parseOffset(filters.cursor)
    params.push(limit + 1, offset)
    const rows = await this.database.all<ConversationRow>(
      `SELECT * FROM cached_conversations
       WHERE ${conditions.join(' AND ')}
       ORDER BY last_message_at DESC, server_id DESC
       LIMIT ? OFFSET ?`,
      params,
    )
    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map(toConversation)
    const nextOffset = offset + items.length
    return {
      items,
      next_cursor: hasMore ? `offset_${nextOffset}` : null,
      has_more: hasMore,
    }
  }
}

export class MessageRepository {
  constructor(private readonly database: LocalDatabase) {}

  async deleteSyntheticDuplicate(ownerId: string, message: CanonicalMessage) {
    if (message.id.startsWith('hub_')) return
    await this.database.run(
      `DELETE FROM cached_messages
       WHERE owner_id = ? AND conversation_id = ? AND server_id GLOB 'hub_*'
         AND sender = ? AND text = ? AND sent_at = ? AND attachment_json IS ?`,
      [
        ownerId,
        message.conversation_id,
        message.sender,
        message.text,
        message.sent_at,
        message.attachment ? JSON.stringify(message.attachment) : null,
      ],
    )
  }

  async upsert(ownerId: string, message: CanonicalMessage, syncedAt: string) {
    await this.database.run(
      `INSERT INTO cached_messages (
        owner_id, server_id, conversation_id, client_mutation_id, sender,
        sender_id, text, attachment_json, sent_at, created_at, updated_at,
        deleted_at, delivery_status, synced_at, cache_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, server_id) DO UPDATE SET
        conversation_id = excluded.conversation_id,
        client_mutation_id = excluded.client_mutation_id,
        sender = excluded.sender,
        sender_id = excluded.sender_id,
        text = excluded.text,
        attachment_json = excluded.attachment_json,
        sent_at = excluded.sent_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        delivery_status = excluded.delivery_status,
        synced_at = excluded.synced_at,
        cache_status = excluded.cache_status
      WHERE excluded.updated_at >= cached_messages.updated_at`,
      [
        ownerId,
        message.id,
        message.conversation_id,
        message.client_mutation_id,
        message.sender,
        message.sender_id,
        message.text,
        message.attachment ? JSON.stringify(message.attachment) : null,
        message.sent_at,
        message.created_at,
        message.updated_at,
        message.deleted_at,
        message.delivery_status,
        syncedAt,
        'synced',
      ],
    )
  }

  async markDeleted(ownerId: string, id: string, deletedAt: string, syncedAt: string) {
    await this.database.run(
      `UPDATE cached_messages
       SET deleted_at = ?, updated_at = ?, synced_at = ?, cache_status = 'deleted'
       WHERE owner_id = ? AND server_id = ?`,
      [deletedAt, deletedAt, syncedAt, ownerId, id],
    )
  }

  async list(
    ownerId: string,
    conversationId: string,
    options: { cursor?: string; before?: string; limit?: number } = {},
  ) {
    const limit = Math.min(Math.max(options.limit || 50, 1), 200)
    const offset = parseOffset(options.cursor)
    const conditions = ['owner_id = ?', 'conversation_id = ?', 'deleted_at IS NULL']
    const params: SqlValue[] = [ownerId, conversationId]
    if (options.before) {
      conditions.push(
        `(sent_at, server_id) < (
          SELECT sent_at, server_id FROM cached_messages
          WHERE owner_id = ? AND server_id = ?
        )`,
      )
      params.push(ownerId, options.before)
    }
    params.push(limit + 1, offset)
    const rows = await this.database.all<MessageRow>(
      `SELECT * FROM cached_messages
       WHERE ${conditions.join(' AND ')}
       ORDER BY sent_at DESC, server_id DESC
       LIMIT ? OFFSET ?`,
      params,
    )
    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).reverse().map(toMessage)
    const nextOffset = offset + items.length
    return {
      items,
      next_cursor: hasMore ? `offset_${nextOffset}` : null,
      has_more: hasMore,
    }
  }
}

export class SyncStateRepository {
  constructor(private readonly database: LocalDatabase) {}

  async get(ownerId: string, dataset: string) {
    return this.database.get<{
      owner_id: string
      dataset: string
      cursor: string | null
      last_synced_at: string | null
      status: string
    }>('SELECT * FROM sync_state WHERE owner_id = ? AND dataset = ?', [ownerId, dataset])
  }

  async upsert(
    ownerId: string,
    dataset: string,
    values: { cursor?: string | null; lastSyncedAt?: string | null; status?: string },
  ) {
    await this.database.run(
      `INSERT INTO sync_state (owner_id, dataset, cursor, last_synced_at, status)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_id, dataset) DO UPDATE SET
         cursor = excluded.cursor,
         last_synced_at = excluded.last_synced_at,
         status = excluded.status`,
      [
        ownerId,
        dataset,
        values.cursor ?? null,
        values.lastSyncedAt ?? null,
        values.status ?? 'idle',
      ],
    )
  }
}

export class OrderRepository {
  constructor(private readonly database: LocalDatabase) {}

  async upsert(ownerId: string, order: Order, syncedAt: string) {
    await this.database.run(
      `INSERT INTO cached_orders (
        owner_id, server_id, code, customer_name, status, payment_status,
        total_amount, currency, payload_json, created_at, updated_at, deleted_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, server_id) DO UPDATE SET
        code = excluded.code, customer_name = excluded.customer_name,
        status = excluded.status, payment_status = excluded.payment_status,
        total_amount = excluded.total_amount, currency = excluded.currency,
        payload_json = excluded.payload_json, created_at = excluded.created_at,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
        synced_at = excluded.synced_at
      WHERE excluded.updated_at >= cached_orders.updated_at`,
      [
        ownerId,
        order.id,
        order.code,
        order.customer_name,
        order.status,
        order.payment_status,
        order.total.amount,
        order.total.currency,
        JSON.stringify(order),
        order.created_at,
        order.updated_at,
        order.deleted_at,
        syncedAt,
      ],
    )
  }

  async markDeleted(ownerId: string, id: string, deletedAt: string, syncedAt: string) {
    await this.database.run(
      'UPDATE cached_orders SET deleted_at = ?, updated_at = ?, synced_at = ? WHERE owner_id = ? AND server_id = ?',
      [deletedAt, deletedAt, syncedAt, ownerId, id],
    )
  }

  async list(
    ownerId: string,
    options: { cursor?: string; limit?: number; status?: Order['status'] } = {},
  ) {
    const limit = Math.min(Math.max(options.limit || 30, 1), 100)
    const offset = parseOffset(options.cursor)
    const params: SqlValue[] = [ownerId]
    let statusCondition = ''
    if (options.status) {
      statusCondition = 'AND status = ?'
      params.push(options.status)
    }
    params.push(limit + 1, offset)
    const rows = await this.database.all<OrderRow>(
      `SELECT * FROM cached_orders WHERE owner_id = ? AND deleted_at IS NULL ${statusCondition} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      params,
    )
    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map(toOrder)
    return {
      items,
      next_cursor: hasMore ? `offset_${offset + items.length}` : null,
      has_more: hasMore,
    }
  }
}

export class ProductRepository {
  constructor(private readonly database: LocalDatabase) {}

  async upsert(ownerId: string, product: Product, syncedAt: string) {
    await this.database.run(
      `INSERT INTO cached_products (
        owner_id, server_id, title, slug, status, price_amount, currency,
        inventory_quantity, payload_json, updated_at, deleted_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, server_id) DO UPDATE SET
        title = excluded.title, slug = excluded.slug, status = excluded.status,
        price_amount = excluded.price_amount, currency = excluded.currency,
        inventory_quantity = excluded.inventory_quantity,
        payload_json = excluded.payload_json, updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at, synced_at = excluded.synced_at
      WHERE excluded.updated_at >= cached_products.updated_at`,
      [
        ownerId,
        product.id,
        product.title,
        product.slug,
        product.status,
        product.price.amount,
        product.price.currency,
        product.inventory_quantity,
        JSON.stringify(product),
        product.updated_at,
        product.deleted_at,
        syncedAt,
      ],
    )
  }

  async markDeleted(ownerId: string, id: string, deletedAt: string, syncedAt: string) {
    await this.database.run(
      'UPDATE cached_products SET deleted_at = ?, updated_at = ?, synced_at = ? WHERE owner_id = ? AND server_id = ?',
      [deletedAt, deletedAt, syncedAt, ownerId, id],
    )
  }

  async list(ownerId: string, options: { cursor?: string; limit?: number; search?: string } = {}) {
    const limit = Math.min(Math.max(options.limit || 30, 1), 100)
    const offset = parseOffset(options.cursor)
    const params: SqlValue[] = [ownerId]
    let searchCondition = ''
    if (options.search) {
      searchCondition = 'AND (title LIKE ? OR slug LIKE ?)'
      const search = `%${options.search}%`
      params.push(search, search)
    }
    params.push(limit + 1, offset)
    const rows = await this.database.all<ProductRow>(
      `SELECT * FROM cached_products WHERE owner_id = ? AND deleted_at IS NULL ${searchCondition} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      params,
    )
    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map(toProduct)
    return {
      items,
      next_cursor: hasMore ? `offset_${offset + items.length}` : null,
      has_more: hasMore,
    }
  }
}

export class AccountingRepository {
  constructor(private readonly database: LocalDatabase) {}

  async upsert(ownerId: string, document: AccountingDocument, syncedAt: string) {
    await this.database.run(
      `INSERT INTO cached_accounting_documents (
        owner_id, server_id, code, type, status, counterparty_name,
        total_amount, currency, payload_json, issued_at, updated_at, deleted_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, server_id) DO UPDATE SET
        code = excluded.code, type = excluded.type, status = excluded.status,
        counterparty_name = excluded.counterparty_name,
        total_amount = excluded.total_amount, currency = excluded.currency,
        payload_json = excluded.payload_json, issued_at = excluded.issued_at,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
        synced_at = excluded.synced_at
      WHERE excluded.updated_at >= cached_accounting_documents.updated_at`,
      [
        ownerId,
        document.id,
        document.code,
        document.type,
        document.status,
        document.counterparty_name,
        document.total.amount,
        document.total.currency,
        JSON.stringify(document),
        document.issued_at,
        document.updated_at,
        document.deleted_at,
        syncedAt,
      ],
    )
  }

  async markDeleted(ownerId: string, id: string, deletedAt: string, syncedAt: string) {
    await this.database.run(
      'UPDATE cached_accounting_documents SET deleted_at = ?, updated_at = ?, synced_at = ? WHERE owner_id = ? AND server_id = ?',
      [deletedAt, deletedAt, syncedAt, ownerId, id],
    )
  }

  async list(
    ownerId: string,
    options: { cursor?: string; limit?: number; type?: AccountingDocument['type'] } = {},
  ) {
    const limit = Math.min(Math.max(options.limit || 30, 1), 100)
    const offset = parseOffset(options.cursor)
    const params: SqlValue[] = [ownerId]
    let typeCondition = ''
    if (options.type) {
      typeCondition = 'AND type = ?'
      params.push(options.type)
    }
    params.push(limit + 1, offset)
    const rows = await this.database.all<AccountingRow>(
      `SELECT * FROM cached_accounting_documents WHERE owner_id = ? AND deleted_at IS NULL ${typeCondition} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      params,
    )
    const hasMore = rows.length > limit
    const items = rows.slice(0, limit).map(toAccountingDocument)
    return {
      items,
      next_cursor: hasMore ? `offset_${offset + items.length}` : null,
      has_more: hasMore,
    }
  }
}

export class AppSettingsRepository {
  constructor(private readonly database: LocalDatabase) {}

  async set<T>(ownerId: string, key: string, value: T) {
    const updatedAt = new Date().toISOString()
    await this.database.run(
      `INSERT INTO app_settings (owner_id, key, value_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_id, key) DO UPDATE SET
         value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [ownerId, key, JSON.stringify(value), updatedAt],
    )
  }

  async get<T>(ownerId: string, key: string): Promise<T | null> {
    const row = await this.database.get<{ value_json: string }>(
      'SELECT value_json FROM app_settings WHERE owner_id = ? AND key = ?',
      [ownerId, key],
    )
    return row ? (JSON.parse(row.value_json) as T) : null
  }
}
