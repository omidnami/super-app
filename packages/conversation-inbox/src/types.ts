import type {
  Conversation,
  ConversationListQuery,
  ConversationPage,
} from '@superapp/chat-contracts'

export type InboxFilters = Omit<ConversationListQuery, 'cursor' | 'limit'>
export type InboxDataSource = 'remote' | 'cache'

export interface ConversationCache {
  list(ownerId: string, query: ConversationListQuery): Promise<ConversationPage>
  save(
    ownerId: string,
    query: ConversationListQuery,
    page: ConversationPage,
    syncedAt?: string,
  ): Promise<void>
}

export interface ConversationInboxOptions {
  api: import('@superapp/api-client').ConversationApi
  ownerId: string
  accessToken?: string
  cache?: ConversationCache
  pageSize?: number
  searchDebounceMs?: number
}

export interface ConversationInboxState {
  items: Conversation[]
  filters: InboxFilters
  status: 'loading' | 'ready' | 'error'
  dataSource: InboxDataSource | null
  error: string | null
  nextCursor: string | null
  hasMore: boolean
  isRefreshing: boolean
  isLoadingMore: boolean
}
