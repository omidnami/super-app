import type { ConversationApi } from '@superapp/api-client'
import type {
  CanonicalMessage,
  Conversation,
  MessageListQuery,
  Paginated,
} from '@superapp/chat-contracts'

export type ChatStatus = 'loading' | 'ready' | 'error'
export type ChatDataSource = 'remote' | 'cache'

export interface ChatSendResult {
  ok: boolean
  code?: 'EMPTY' | 'TOO_LONG' | 'OFFLINE' | 'DISCONNECTED'
}

export interface MessageCache {
  listMessages(
    ownerId: string,
    conversationId: string,
    query: MessageListQuery,
  ): Promise<Paginated<CanonicalMessage>>
  saveMessages(
    ownerId: string,
    conversationId: string,
    messages: CanonicalMessage[],
    syncedAt?: string,
  ): Promise<void>
}

export interface UseChatOptions {
  api: ConversationApi
  conversation: Conversation
  ownerId: string
  operatorId?: string
  accessToken?: string
  cache?: MessageCache
  isOnline?: boolean
  pageSize?: number
  sendTimeoutMs?: number
}

export interface UseChatResult {
  messages: CanonicalMessage[]
  status: ChatStatus
  error: string | null
  dataSource: ChatDataSource | null
  nextCursor: string | null
  hasMore: boolean
  isLoadingMore: boolean
  isSending: boolean
  isOffline: boolean
  loadMore: () => Promise<void>
  retry: () => Promise<void>
  send: (text: string) => Promise<ChatSendResult>
  clearError: () => void
}

export type ChatController = UseChatResult
