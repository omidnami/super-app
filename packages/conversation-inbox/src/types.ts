import type {
  Conversation,
  ConversationListQuery,
  ConversationPage,
  OperatorSummary,
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
    completeSnapshot?: Conversation[],
  ): Promise<void>
  clear?(ownerId: string): Promise<void>
}

export function createConversationCacheScope(operatorId: string, projectId: string) {
  return JSON.stringify([operatorId, projectId])
}

export function parseConversationCacheScope(scope: string) {
  const parsed: unknown = JSON.parse(scope)
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== 'string' ||
    typeof parsed[1] !== 'string' ||
    !parsed[0] ||
    !parsed[1]
  ) {
    throw new Error('Invalid conversation cache scope')
  }
  return { operatorId: parsed[0], projectId: parsed[1] }
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
  operators: OperatorSummary[]
  filters: InboxFilters
  status: 'loading' | 'ready' | 'error'
  dataSource: InboxDataSource | null
  error: string | null
  nextCursor: string | null
  hasMore: boolean
  isRefreshing: boolean
  isLoadingMore: boolean
}
