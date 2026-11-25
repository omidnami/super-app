import type {
  CanonicalMessage,
  Conversation,
  ConversationListQuery,
  ConversationPage,
  MessageListQuery,
  MessagePage,
  SyncChange,
  SyncQuery,
  SyncResult,
} from '@superapp/chat-contracts'
import conversationFixtures from '../mocks/fixtures/conversations.json'
import messageFixtures from '../mocks/fixtures/messages.json'
import syncChangeFixtures from '../mocks/fixtures/sync-changes.json'
import {
  createMockMediaApi,
  createPlanetMediaApi,
  PlanetApiError,
  type ConversationMediaApi,
} from './media'

export { PlanetApiError } from './media'

const conversations = conversationFixtures as unknown as Conversation[]
const messages = messageFixtures as unknown as CanonicalMessage[]
const syncChanges = syncChangeFixtures as unknown as SyncChange[]

export interface ConversationRequestContext {
  accessToken?: string
  signal?: AbortSignal
}

export interface ConversationApi {
  media?: ConversationMediaApi
  list(
    query?: ConversationListQuery,
    context?: ConversationRequestContext,
  ): Promise<ConversationPage>
  get(id: string, context?: ConversationRequestContext): Promise<Conversation | null>
  listMessages(
    conversationId: string,
    query?: MessageListQuery,
    context?: ConversationRequestContext,
  ): Promise<MessagePage>
  sync?(query: SyncQuery, context?: ConversationRequestContext): Promise<SyncResult>
}

export interface PlanetConversationApiOptions {
  baseUrl: string
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  fetch?: typeof fetch
}

function offsetFromCursor(cursor?: string) {
  const match = /^offset_(\d+)$/.exec(cursor || '')
  return match ? Number(match[1]) : 0
}

function includesSearch(value: string, search: string) {
  return value.toLocaleLowerCase('fa').includes(search.toLocaleLowerCase('fa'))
}

export function filterConversations(items: Conversation[], query: ConversationListQuery = {}) {
  const search = query.search?.trim() || ''
  return items.filter((conversation) => {
    if (
      search &&
      ![
        conversation.customer.display_name,
        conversation.last_message,
        conversation.chat_id,
        conversation.assignee?.name || '',
      ].some((value) => includesSearch(value, search))
    ) {
      return false
    }
    if (query.source && conversation.source !== query.source) return false
    if (query.support_level && conversation.support_level !== query.support_level) return false
    if (query.status && conversation.status !== query.status) return false
    if (query.assignee_operator_id && conversation.assignee?.id !== query.assignee_operator_id) {
      return false
    }
    if (query.unread_only && conversation.unread_count <= 0) return false
    return conversation.deleted_at === null
  })
}

function hydrateMockSyncChanges(): SyncChange[] {
  return syncChanges.map((change) => {
    if (change.op === 'delete') return { ...change, data: null }
    const data =
      change.entity === 'conversation'
        ? conversations.find((conversation) => conversation.id === change.id)
        : messages.find((message) => message.id === change.id)
    return { ...change, data: data || null }
  })
}

function matchesMockSyncScope(change: SyncChange, query: SyncQuery) {
  if (change.entity === 'conversation') {
    return (
      (!query.conversation_id || change.id === query.conversation_id) &&
      (!query.project_id ||
        conversations.find((item) => item.id === change.id)?.project_id === query.project_id)
    )
  }
  const message = messages.find((item) => item.id === change.id)
  const conversation = conversations.find((item) => item.id === message?.conversation_id)
  return (
    (!query.conversation_id || message?.conversation_id === query.conversation_id) &&
    (!query.project_id || conversation?.project_id === query.project_id)
  )
}

export function createMockConversationApi(): ConversationApi {
  return {
    media: createMockMediaApi(),
    async list(query = {}) {
      const filtered = filterConversations(conversations, query).sort(
        (a, b) =>
          Date.parse(b.last_message_at || b.updated_at) -
          Date.parse(a.last_message_at || a.updated_at),
      )
      const limit = Math.min(Math.max(query.limit || 30, 1), 100)
      const offset = offsetFromCursor(query.cursor)
      const items = filtered.slice(offset, offset + limit)
      const nextOffset = offset + items.length
      return {
        items,
        next_cursor: nextOffset < filtered.length ? `offset_${nextOffset}` : null,
        has_more: nextOffset < filtered.length,
      }
    },

    async get(id) {
      return (
        conversations.find((conversation) => conversation.id === id && !conversation.deleted_at) ||
        null
      )
    },

    async listMessages(conversationId, query = {}) {
      const conversation = conversations.find((item) => item.id === conversationId)
      if (!conversation) throw new Error('Conversation not found')
      const items = messages
        .filter((message) => message.conversation_id === conversationId && !message.deleted_at)
        .sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at) || a.id.localeCompare(b.id))
      let end = items.length
      if (query.before) {
        const index = items.findIndex((message) => message.id === query.before)
        if (index >= 0) end = index
      }
      const limit = Math.min(Math.max(query.limit || 50, 1), 200)
      const offset = offsetFromCursor(query.cursor)
      const effectiveEnd = Math.max(0, end - offset)
      const start = Math.max(0, effectiveEnd - limit)
      const pageItems = items.slice(start, effectiveEnd)
      const nextOffset = offset + pageItems.length
      return {
        items: pageItems,
        next_cursor: start > 0 ? `offset_${nextOffset}` : null,
        has_more: start > 0,
        conversation,
      }
    },

    async sync(query = {}) {
      const serverTime = new Date().toISOString()
      if (query.cursor === 'mock_cursor_1') {
        return {
          changes: [],
          next_cursor: 'mock_cursor_1',
          server_time: serverTime,
          has_more: false,
        }
      }
      return {
        changes: hydrateMockSyncChanges().filter((change) => matchesMockSyncScope(change, query)),
        next_cursor: 'mock_cursor_1',
        server_time: serverTime,
        has_more: false,
      }
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isConversation(value: unknown): value is Conversation {
  if (!isRecord(value) || !isRecord(value.customer)) return false
  const customer = value.customer
  const assignee = value.assignee
  return (
    typeof value.id === 'string' &&
    typeof value.project_id === 'string' &&
    typeof value.source === 'string' &&
    typeof value.robot_id === 'string' &&
    typeof value.chat_id === 'string' &&
    isNullableString(customer.id) &&
    typeof customer.display_name === 'string' &&
    typeof customer.initials === 'string' &&
    (customer.mobile === undefined || typeof customer.mobile === 'string') &&
    typeof value.support_level === 'string' &&
    typeof value.status === 'string' &&
    (assignee === null ||
      (isRecord(assignee) &&
        typeof assignee.id === 'string' &&
        typeof assignee.name === 'string')) &&
    typeof value.last_message === 'string' &&
    isNullableString(value.last_message_at) &&
    typeof value.unread_count === 'number' &&
    Number.isFinite(value.unread_count) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    isNullableString(value.deleted_at)
  )
}

function isConversationPage(value: unknown): value is ConversationPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(isConversation) ||
    !isNullableString(value.next_cursor) ||
    typeof value.has_more !== 'boolean'
  ) {
    return false
  }
  if (value.has_more) return typeof value.next_cursor === 'string' && value.next_cursor.length > 0
  return value.next_cursor === null
}

function isCanonicalMessage(value: unknown): value is CanonicalMessage {
  if (!isRecord(value)) return false
  const attachment = value.attachment
  return (
    typeof value.id === 'string' &&
    typeof value.conversation_id === 'string' &&
    isNullableString(value.client_mutation_id) &&
    (value.sender === 'client' || value.sender === 'operator') &&
    typeof value.sender_id === 'string' &&
    typeof value.text === 'string' &&
    (attachment === null || (isRecord(attachment) && isMessageAttachment(attachment))) &&
    typeof value.sent_at === 'string' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    isNullableString(value.deleted_at) &&
    (value.delivery_status === 'pending' ||
      value.delivery_status === 'sent' ||
      value.delivery_status === 'failed' ||
      value.delivery_status === 'unknown')
  )
}

function isMessageAttachment(value: Record<string, unknown>) {
  return (
    typeof value.id === 'string' &&
    (value.provider === 'planet' || value.provider === 'bale') &&
    (value.type === 'photo' ||
      value.type === 'voice' ||
      value.type === 'audio' ||
      value.type === 'video' ||
      value.type === 'document') &&
    typeof value.file_name === 'string' &&
    typeof value.mime_type === 'string' &&
    typeof value.file_size === 'number' &&
    Number.isFinite(value.file_size) &&
    value.file_size >= 0 &&
    (value.duration === undefined ||
      value.duration === null ||
      (typeof value.duration === 'number' && Number.isFinite(value.duration))) &&
    (value.url === undefined || isNullableString(value.url)) &&
    typeof value.created_at === 'string'
  )
}

function isSyncChange(value: unknown): value is SyncChange {
  if (!isRecord(value)) return false
  if (
    (value.entity !== 'conversation' && value.entity !== 'message') ||
    (value.op !== 'upsert' && value.op !== 'delete') ||
    typeof value.id !== 'string' ||
    typeof value.version !== 'number' ||
    !Number.isInteger(value.version) ||
    value.version < 0 ||
    typeof value.updated_at !== 'string' ||
    !isNullableString(value.deleted_at)
  ) {
    return false
  }
  if (value.op === 'upsert' && value.data === null) return false
  if (value.data === null) return true
  const data = value.data
  if (value.entity === 'conversation') {
    return isConversation(data) && data.id === value.id
  }
  return isCanonicalMessage(data) && data.id === value.id
}

function isSyncResult(value: unknown): value is SyncResult {
  return (
    isRecord(value) &&
    Array.isArray(value.changes) &&
    value.changes.every(isSyncChange) &&
    typeof value.next_cursor === 'string' &&
    typeof value.server_time === 'string' &&
    typeof value.has_more === 'boolean'
  )
}

export function createConfiguredConversationApi(baseUrl?: string): ConversationApi {
  const normalizedBaseUrl = baseUrl?.trim()
  return normalizedBaseUrl
    ? createPlanetConversationApi({ baseUrl: normalizedBaseUrl })
    : createMockConversationApi()
}

export function createPlanetConversationApi({
  baseUrl,
  getAccessToken,
  fetch: fetchImpl = globalThis.fetch,
}: PlanetConversationApiOptions): ConversationApi {
  const root = baseUrl.replace(/\/$/, '')

  async function request<T>(
    path: string,
    query: object = {},
    context: ConversationRequestContext = {},
  ): Promise<T> {
    const url = new URL(`${root}${path}`)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
    const accessToken = context.accessToken || (await getAccessToken?.())
    const headers = new Headers({ Accept: 'application/json' })
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

    const response = await fetchImpl(url, { method: 'GET', headers, signal: context.signal })
    if (!response.ok) {
      throw new PlanetApiError('دریافت داده از Planet ناموفق بود.', response.status)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new PlanetApiError('پاسخ Planet معتبر نیست.', response.status)
    }
    if (!isRecord(payload) || payload.status !== true || !('data' in payload)) {
      throw new PlanetApiError('پاسخ Planet معتبر نیست.', response.status)
    }
    return payload.data as T
  }

  return {
    media: createPlanetMediaApi({ baseUrl, getAccessToken, fetch: fetchImpl }),
    async list(query = {}, context) {
      const page = await request<unknown>('/api/v1/chat/conversations', query, context)
      if (!isConversationPage(page)) {
        throw new PlanetApiError('پاسخ فهرست گفتگوها معتبر نیست.', 200)
      }
      return page
    },
    get(id, context) {
      return request<Conversation | null>(
        `/api/v1/chat/conversations/${encodeURIComponent(id)}`,
        {},
        context,
      )
    },
    listMessages(conversationId, query = {}, context) {
      return request<MessagePage>(
        `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
        query,
        context,
      )
    },
    async sync(query = {}, context) {
      const result = await request<unknown>('/api/v1/chat/sync', query, context)
      if (!isSyncResult(result)) {
        throw new PlanetApiError('پاسخ همگام‌سازی Planet معتبر نیست.', 200)
      }
      return result
    },
  }
}
