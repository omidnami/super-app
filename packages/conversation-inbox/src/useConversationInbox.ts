import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Conversation,
  ConversationListQuery,
  ConversationPage,
} from '@superapp/chat-contracts'
import type { ConversationInboxOptions, InboxDataSource, InboxFilters } from './types'

const DEFAULT_ERROR = 'دریافت گفتگوها ناموفق بود. دوباره تلاش کنید.'

function mergeConversations(current: Conversation[], incoming: Conversation[]) {
  const byId = new Map(current.map((conversation) => [conversation.id, conversation]))
  for (const conversation of incoming) {
    const existing = byId.get(conversation.id)
    if (!existing || Date.parse(conversation.updated_at) >= Date.parse(existing.updated_at)) {
      byId.set(conversation.id, conversation)
    }
  }
  return Array.from(byId.values())
}

export function useConversationInbox({
  api,
  ownerId,
  accessToken,
  cache,
  pageSize = 30,
  searchDebounceMs = 250,
}: ConversationInboxOptions) {
  const [items, setItems] = useState<Conversation[]>([])
  const [filters, setFiltersState] = useState<InboxFilters>({})
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [dataSource, setDataSource] = useState<InboxDataSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const generation = useRef(0)
  const loadingMore = useRef(false)
  const abortController = useRef<AbortController | null>(null)

  const query = useMemo<ConversationListQuery>(
    () => ({
      ...filters,
      search: filters.search?.trim() || undefined,
      limit: pageSize,
    }),
    [filters, pageSize],
  )

  const fetchPage = useCallback(
    async (
      pageQuery: ConversationListQuery,
    ): Promise<{ page: ConversationPage; source: InboxDataSource }> => {
      const signal = abortController.current?.signal
      try {
        const page = await api.list(pageQuery, { accessToken, signal })
        if (signal?.aborted) throw new Error('Request aborted')
        if (cache) {
          try {
            await cache.save(ownerId, pageQuery, page)
          } catch {
            // A cache write failure must not hide a successful server response.
          }
        }
        return { page, source: 'remote' }
      } catch (requestError) {
        if (signal?.aborted || !cache) throw requestError
        const page = await cache.list(ownerId, pageQuery)
        return { page, source: 'cache' }
      }
    },
    [accessToken, api, cache, ownerId],
  )

  const loadFirstPage = useCallback(
    async (refreshing = false) => {
      abortController.current?.abort()
      const controller = new AbortController()
      abortController.current = controller
      const requestGeneration = ++generation.current
      setStatus('loading')
      setIsRefreshing(refreshing)
      setError(null)

      try {
        const { page, source } = await fetchPage(query)
        if (requestGeneration !== generation.current) return
        setItems(page.items)
        setNextCursor(page.next_cursor)
        setHasMore(Boolean(page.has_more && page.next_cursor))
        setDataSource(source)
        setStatus('ready')
      } catch {
        if (requestGeneration !== generation.current) return
        setItems([])
        setNextCursor(null)
        setHasMore(false)
        setDataSource(null)
        setError(DEFAULT_ERROR)
        setStatus('error')
      } finally {
        if (requestGeneration === generation.current) setIsRefreshing(false)
      }
    },
    [fetchPage, query],
  )

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        void loadFirstPage()
      },
      filters.search ? searchDebounceMs : 0,
    )

    return () => {
      clearTimeout(timeout)
      abortController.current?.abort()
      generation.current += 1
    }
  }, [filters.search, loadFirstPage, searchDebounceMs])

  useEffect(
    () => () => {
      abortController.current?.abort()
    },
    [],
  )

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || loadingMore.current || status === 'loading') return
    loadingMore.current = true
    const requestGeneration = generation.current
    setIsLoadingMore(true)
    setError(null)

    try {
      const { page, source } = await fetchPage({ ...query, cursor: nextCursor })
      if (requestGeneration !== generation.current) return
      setItems((current) => mergeConversations(current, page.items))
      setNextCursor(page.next_cursor)
      setHasMore(Boolean(page.has_more && page.next_cursor))
      setDataSource(source)
      setStatus('ready')
    } catch {
      if (requestGeneration === generation.current) setError(DEFAULT_ERROR)
    } finally {
      loadingMore.current = false
      if (requestGeneration === generation.current) setIsLoadingMore(false)
    }
  }, [fetchPage, hasMore, nextCursor, query, status])

  const setFilters = useCallback((patch: Partial<InboxFilters>) => {
    setFiltersState((current) => ({ ...current, ...patch }))
  }, [])

  const clearFilters = useCallback(() => setFiltersState({}), [])

  return {
    items,
    filters,
    status,
    dataSource,
    error,
    nextCursor,
    hasMore,
    isRefreshing,
    isLoadingMore,
    setFilters,
    clearFilters,
    refresh: () => loadFirstPage(true),
    retry: () => loadFirstPage(),
    loadMore,
  }
}

export type ConversationInboxController = ReturnType<typeof useConversationInbox>
