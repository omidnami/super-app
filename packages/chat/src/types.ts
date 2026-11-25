import type { ConversationApi } from '@superapp/api-client'
import type {
  Attachment,
  CanonicalMessage,
  SyncChange,
  Conversation,
  DeliveryStatus,
  MessageListQuery,
  Paginated,
} from '@superapp/chat-contracts'

export type ChatStatus = 'loading' | 'ready' | 'error'
export type ChatDataSource = 'remote' | 'cache'

export interface ChatSendResult {
  ok: boolean
  code?: 'EMPTY' | 'TOO_LONG' | 'OFFLINE' | 'DISCONNECTED'
  deliveryStatus?: DeliveryStatus
  clientMutationId?: string
}

export interface BacklogState {
  cursor: string | null
  lastSyncedAt?: string | null
  last_synced_at?: string | null
  status: string
}

export interface BacklogCache {
  getState(ownerId: string, conversationId: string): Promise<BacklogState | null>
  applyChanges(
    ownerId: string,
    conversationId: string,
    changes: SyncChange[],
    nextCursor: string,
    syncedAt?: string,
  ): Promise<void>
  replaceSnapshot(
    ownerId: string,
    conversationId: string,
    messages: CanonicalMessage[],
    nextCursor: string,
    syncedAt?: string,
  ): Promise<void>
  commitCursor(
    ownerId: string,
    conversationId: string,
    nextCursor: string,
    syncedAt?: string,
  ): Promise<void>
}

export interface MessageCache {
  backlog?: BacklogCache
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
  lastDeliveredMutationId: string | null
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  lastSyncedAt: string | null
  isStale: boolean
  loadMore: () => Promise<void>
  retry: () => Promise<void>
  send: (text: string, attachment?: Attachment) => Promise<ChatSendResult>
  clearError: () => void
}

export type ChatController = UseChatResult
