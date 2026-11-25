import type {
  CanonicalMessage,
  Conversation,
  ConversationListQuery,
  ConversationPage,
  MessageListQuery,
  MessagePage,
} from '@superapp/chat-contracts'
import conversationFixtures from '../mocks/fixtures/conversations.json'
import messageFixtures from '../mocks/fixtures/messages.json'

const conversations = conversationFixtures as unknown as Conversation[]
const messages = messageFixtures as unknown as CanonicalMessage[]

export interface ConversationRequestContext {
  accessToken?: string
  signal?: AbortSignal
}

export interface ConversationApi {
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
}

export class PlanetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'PlanetApiError'
  }
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

export function createMockConversationApi(): ConversationApi {
  return {
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
      let items = messages
        .filter((message) => message.conversation_id === conversationId && !message.deleted_at)
        .sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at) || a.id.localeCompare(b.id))
      if (query.before) {
        const index = items.findIndex((message) => message.id === query.before)
        if (index >= 0) items = items.slice(0, index)
      }
      const limit = Math.min(Math.max(query.limit || 50, 1), 200)
      const offset = offsetFromCursor(query.cursor)
      const pageItems = items.slice(offset, offset + limit)
      const nextOffset = offset + pageItems.length
      return {
        items: pageItems,
        next_cursor: nextOffset < items.length ? `offset_${nextOffset}` : null,
        has_more: nextOffset < items.length,
        conversation,
      }
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

    const response = await fetchImpl(url, { headers, signal: context.signal })
    if (!response.ok) {
      throw new PlanetApiError('دریافت داده از Planet ناموفق بود.', response.status)
    }
    const payload: unknown = await response.json()
    if (!isRecord(payload) || payload.status !== true || !('data' in payload)) {
      throw new PlanetApiError('پاسخ Planet معتبر نیست.', response.status)
    }
    return payload.data as T
  }

  return {
    list(query = {}, context) {
      return request<{ items: Conversation[]; next_cursor: string | null; has_more: boolean }>(
        '/api/v1/chat/conversations',
        query,
        context,
      )
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
  }
}
