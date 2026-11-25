import { useCallback, useEffect, useRef, useState } from 'react'
import { PlanetApiError } from '@superapp/api-client'
import type {
  Attachment,
  CanonicalMessage,
  Conversation,
  DeliveryStatus,
  MessageListQuery,
  Paginated,
  SyncChange,
} from '@superapp/chat-contracts'
import { toHubMessage } from '@superapp/chat-contracts'
import { useHubConnection, type HubAck } from '@superapp/hub-client'
import { reconcileBacklog } from './backlog'
import {
  createOptimisticMessage,
  generateClientMutationId,
  hubMessageSignature,
  mergeCanonicalMessages,
  normalizeHubMessage,
  sanitizeAttachment,
} from './messages'
import type {
  ChatDataSource,
  ChatSendResult,
  ChatStatus,
  UseChatOptions,
  UseChatResult,
} from './types'

const ABORTED = Symbol('aborted')
const DEFAULT_HISTORY_ERROR = 'دریافت پیام‌ها ناموفق بود. دوباره تلاش کنید.'
const DEFAULT_SEND_ERROR = 'ارسال پیام ناموفق بود. دوباره تلاش کنید.'
const SEND_TIMEOUT_ERROR = 'دریافت تأییدیه ارسال پیام ناموفق بود.'

function historyErrorMessage(error: unknown) {
  if (error instanceof PlanetApiError) {
    if (error.status === 401) return 'نشست پیام‌رسان منقضی شده است. دوباره متصل شوید.'
    if (error.status === 403) return 'دسترسی به این گفتگو مجاز نیست.'
    return error.message
  }
  return DEFAULT_HISTORY_ERROR
}

function applySyncChanges(
  current: CanonicalMessage[],
  changes: SyncChange[],
  conversation: Conversation,
) {
  let next = current
  for (const change of changes) {
    if (change.entity !== 'message') continue
    if (change.op === 'delete') {
      next = next.filter((message) => message.id !== change.id)
      continue
    }
    if (!change.data) continue
    const message = change.data as CanonicalMessage
    if (message.conversation_id !== conversation.id) continue
    next = mergeCanonicalMessages(
      next,
      [{ ...message, attachment: sanitizeAttachment(message.attachment) }],
      conversation,
    )
  }
  return next
}

function isAbortError(error: unknown) {
  return (
    error === ABORTED ||
    (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
  )
}

export function useChat({
  api,
  conversation,
  ownerId,
  operatorId,
  accessToken,
  cache,
  isOnline = true,
  pageSize = 30,
  sendTimeoutMs = 10000,
}: UseChatOptions): UseChatResult {
  const { isConnected, sendMessage: sendHubMessage, subscribe } = useHubConnection()
  const senderId = operatorId || ownerId
  const [messages, setMessages] = useState<CanonicalMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<ChatDataSource | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeSendCount, setActiveSendCount] = useState(0)
  const [lastDeliveredMutationId, setLastDeliveredMutationId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const messagesRef = useRef<CanonicalMessage[]>([])
  const conversationRef = useRef(conversation)
  const historyGenerationRef = useRef(0)
  const scopeGenerationRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const loadingMoreRef = useRef(false)
  const initialLoadingRef = useRef(false)
  const bufferedEventsRef = useRef<CanonicalMessage[]>([])
  const backlogCursorRef = useRef<string | null>(null)
  const wasConnectedRef = useRef(isConnected)
  const hasSeenConnectionRef = useRef(isConnected)
  const localSignaturesRef = useRef(new Set<string>())
  const activeSendsRef = useRef(new Set<string>())
  const scopeKey = JSON.stringify([
    ownerId,
    conversation.id,
    conversation.project_id,
    conversation.source,
    conversation.robot_id,
    conversation.chat_id,
  ])

  useEffect(() => {
    conversationRef.current = conversation
  }, [conversation])

  const updateMessages = useCallback(
    (update: (current: CanonicalMessage[]) => CanonicalMessage[]) => {
      const next = update(messagesRef.current)
      messagesRef.current = next
      setMessages(next)
    },
    [],
  )

  const persistCanonical = useCallback(
    async (conversationId: string, items: CanonicalMessage[]) => {
      if (!cache || items.length === 0) return
      try {
        await cache.saveMessages(ownerId, conversationId, items)
      } catch {
        // Live delivery must not disappear because the local cache is unavailable.
      }
    },
    [cache, ownerId],
  )

  const setSendActive = useCallback((clientMutationId: string, active: boolean) => {
    const hadMutation = activeSendsRef.current.has(clientMutationId)
    if (active) activeSendsRef.current.add(clientMutationId)
    else activeSendsRef.current.delete(clientMutationId)
    if (hadMutation !== active) setActiveSendCount(activeSendsRef.current.size)
  }, [])

  const updateDeliveryStatus = useCallback(
    (optimisticId: string, deliveryStatus: DeliveryStatus) => {
      updateMessages((current) =>
        current.map((message) =>
          message.id === optimisticId
            ? { ...message, delivery_status: deliveryStatus, updated_at: new Date().toISOString() }
            : message,
        ),
      )
    },
    [updateMessages],
  )

  const fetchPage = useCallback(
    async (
      query: MessageListQuery,
      requestGeneration: number,
      signal: AbortSignal,
    ): Promise<{ page: Paginated<CanonicalMessage>; source: ChatDataSource }> => {
      const isStale = () => requestGeneration !== historyGenerationRef.current || signal.aborted
      try {
        const remotePage = await api.listMessages(conversation.id, query, { accessToken, signal })
        if (isStale()) throw ABORTED
        const page = {
          ...remotePage,
          items: remotePage.items.map((message) => ({
            ...message,
            attachment: sanitizeAttachment(message.attachment),
          })),
        }
        if (cache) {
          try {
            await cache.saveMessages(ownerId, conversation.id, page.items, undefined)
          } catch {
            // A cache write failure must not hide a successful server response.
          }
        }
        return { page, source: 'remote' }
      } catch (requestError) {
        if (
          isStale() ||
          isAbortError(requestError) ||
          !cache ||
          requestError instanceof PlanetApiError
        ) {
          throw requestError
        }
        const cached = await cache.listMessages(ownerId, conversation.id, query)
        if (isStale()) throw ABORTED
        return {
          page: {
            ...cached,
            items: cached.items.map((message) => ({
              ...message,
              attachment: sanitizeAttachment(message.attachment),
            })),
          },
          source: 'cache',
        }
      }
    },
    [accessToken, api, cache, conversation.id, ownerId],
  )

  const loadFirstPage = useCallback(
    async (reset: boolean) => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      const requestGeneration = ++historyGenerationRef.current
      if (reset) {
        scopeGenerationRef.current += 1
        activeSendsRef.current.clear()
        localSignaturesRef.current.clear()
        backlogCursorRef.current = null
        setActiveSendCount(0)
        setLastDeliveredMutationId(null)
        setLastSyncedAt(null)
        updateMessages(() => [])
      }
      loadingMoreRef.current = false
      bufferedEventsRef.current = []
      initialLoadingRef.current = true
      setIsLoadingMore(false)
      setStatus('loading')
      setSyncStatus('syncing')
      setError(null)
      setDataSource(null)
      setNextCursor(null)
      setHasMore(false)

      try {
        const backlog = await reconcileBacklog({
          api,
          conversation,
          ownerId,
          accessToken,
          cache: cache?.backlog,
          cursor: backlogCursorRef.current,
          signal: controller.signal,
        })
        if (requestGeneration !== historyGenerationRef.current || controller.signal.aborted) return
        backlogCursorRef.current = backlog.cursor
        if (backlog.lastSyncedAt) setLastSyncedAt(backlog.lastSyncedAt)

        const { page, source } = await fetchPage(
          { limit: pageSize },
          requestGeneration,
          controller.signal,
        )
        if (requestGeneration !== historyGenerationRef.current || controller.signal.aborted) return

        initialLoadingRef.current = false
        const buffered = bufferedEventsRef.current
        bufferedEventsRef.current = []
        let next = backlog.snapshot
          ? mergeCanonicalMessages([], backlog.snapshot, conversation)
          : messagesRef.current
        next = applySyncChanges(next, backlog.changes, conversation)
        next = mergeCanonicalMessages(next, page.items, conversation)
        for (const event of buffered) next = mergeCanonicalMessages(next, [event], conversation)
        updateMessages(() => next)
        const bufferedToStore = buffered.filter((event) =>
          next.some((message) => message.id === event.id),
        )
        void persistCanonical(conversation.id, bufferedToStore)
        setNextCursor(page.next_cursor)
        setHasMore(Boolean(page.has_more && page.next_cursor))
        setDataSource(source)
        setSyncStatus(source === 'remote' ? 'success' : 'error')
        setStatus('ready')
      } catch (requestError) {
        if (
          requestGeneration !== historyGenerationRef.current ||
          controller.signal.aborted ||
          isAbortError(requestError)
        ) {
          return
        }
        initialLoadingRef.current = false
        const buffered = bufferedEventsRef.current
        bufferedEventsRef.current = []
        const authError =
          requestError instanceof PlanetApiError &&
          (requestError.status === 401 || requestError.status === 403)
        if (cache?.backlog) {
          try {
            const state = await cache.backlog.getState(ownerId, conversation.id)
            const syncedAt = state?.lastSyncedAt || state?.last_synced_at
            if (syncedAt) setLastSyncedAt(syncedAt)
          } catch {
            // The last known sync time is optional when the cache cannot be read.
          }
        }
        if (cache && !authError) {
          try {
            const cached = await cache.listMessages(ownerId, conversation.id, { limit: pageSize })
            if (requestGeneration !== historyGenerationRef.current || controller.signal.aborted)
              return
            let next = cached.items.map((message) => ({
              ...message,
              attachment: sanitizeAttachment(message.attachment),
            }))
            for (const event of buffered) {
              next = mergeCanonicalMessages(next, [event], conversation)
            }
            updateMessages(() => next)
            setNextCursor(cached.next_cursor)
            setHasMore(Boolean(cached.has_more && cached.next_cursor))
            setDataSource('cache')
            setSyncStatus('error')
            setStatus('ready')
            setError('ارتباط با Planet برقرار نشد؛ تاریخچه آفلاین نمایش داده می‌شود.')
            return
          } catch {
            // Fall through to the error state when no readable cache exists.
          }
        }
        updateMessages(() => [])
        setNextCursor(null)
        setHasMore(false)
        setDataSource(null)
        setSyncStatus('error')
        setError(historyErrorMessage(requestError))
        setStatus('error')
      }
    },
    [
      accessToken,
      api,
      cache,
      conversation,
      fetchPage,
      ownerId,
      pageSize,
      persistCanonical,
      updateMessages,
    ],
  )

  useEffect(() => {
    initialLoadingRef.current = true
    const timeout = window.setTimeout(() => {
      void loadFirstPage(true)
    }, 0)
    return () => {
      window.clearTimeout(timeout)
      abortControllerRef.current?.abort()
      historyGenerationRef.current += 1
      scopeGenerationRef.current += 1
      initialLoadingRef.current = false
      bufferedEventsRef.current = []
      backlogCursorRef.current = null
    }
  }, [loadFirstPage, scopeKey])

  useEffect(() => {
    const firstConnection = !hasSeenConnectionRef.current
    if (isConnected) hasSeenConnectionRef.current = true
    if (isConnected && !wasConnectedRef.current && !firstConnection) {
      void loadFirstPage(false)
    }
    wasConnectedRef.current = isConnected
  }, [isConnected, loadFirstPage])

  useEffect(
    () =>
      subscribe((message) => {
        const canonical = normalizeHubMessage(message, conversationRef.current, senderId)
        if (!canonical || localSignaturesRef.current.has(hubMessageSignature(message))) return
        if (initialLoadingRef.current) {
          bufferedEventsRef.current.push(canonical)
          return
        }
        const merged = mergeCanonicalMessages(
          messagesRef.current,
          [canonical],
          conversationRef.current,
        )
        updateMessages(() => merged)
        if (merged.some((message) => message.id === canonical.id)) {
          void persistCanonical(conversationRef.current.id, [canonical])
        }
      }),
    [ownerId, persistCanonical, senderId, subscribe, updateMessages],
  )

  const loadMore = useCallback(async () => {
    if (!nextCursor || !hasMore || loadingMoreRef.current || status === 'loading') return
    const controller = abortControllerRef.current
    if (!controller || controller.signal.aborted) return
    const requestGeneration = historyGenerationRef.current
    loadingMoreRef.current = true
    setIsLoadingMore(true)
    setError(null)

    try {
      const { page, source } = await fetchPage(
        { cursor: nextCursor, limit: pageSize },
        requestGeneration,
        controller.signal,
      )
      if (requestGeneration !== historyGenerationRef.current || controller.signal.aborted) return
      updateMessages((current) => mergeCanonicalMessages(current, page.items, conversation))
      setNextCursor(page.next_cursor)
      setHasMore(Boolean(page.has_more && page.next_cursor))
      setDataSource(source)
      setStatus('ready')
    } catch (requestError) {
      if (
        requestGeneration === historyGenerationRef.current &&
        !controller.signal.aborted &&
        !isAbortError(requestError)
      ) {
        setError(historyErrorMessage(requestError))
      }
    } finally {
      if (requestGeneration === historyGenerationRef.current) {
        loadingMoreRef.current = false
        setIsLoadingMore(false)
      }
    }
  }, [conversation, fetchPage, hasMore, nextCursor, pageSize, status, updateMessages])

  const retry = useCallback(async () => {
    await loadFirstPage(false)
  }, [loadFirstPage])

  const clearError = useCallback(() => setError(null), [])

  const send = useCallback(
    async (text: string, attachment?: Attachment): Promise<ChatSendResult> => {
      if (!text.trim() && !attachment) {
        const message = 'متن پیام نمی‌تواند خالی باشد.'
        setError(message)
        return { ok: false, code: 'EMPTY' }
      }
      if (text.length > 4000) {
        const message = 'متن پیام نمی‌تواند بیشتر از ۴۰۰۰ نویسه باشد.'
        setError(message)
        return { ok: false, code: 'TOO_LONG' }
      }
      if (!isOnline) {
        const message = 'ارتباط اینترنت برقار نیست.'
        setError(message)
        return { ok: false, code: 'OFFLINE' }
      }
      if (!isConnected) {
        const message = 'ارتباط با Hub برقار نیست.'
        setError(message)
        return { ok: false, code: 'DISCONNECTED' }
      }

      const sendGeneration = scopeGenerationRef.current
      const clientMutationId = generateClientMutationId()
      const sentAt = new Date().toISOString()
      const optimistic = createOptimisticMessage(
        conversation,
        senderId,
        text,
        clientMutationId,
        sentAt,
        attachment || null,
      )
      const wireMessage = toHubMessage(optimistic, conversation)
      localSignaturesRef.current.add(hubMessageSignature(wireMessage))
      setError(null)
      setSendActive(clientMutationId, true)
      updateMessages((current) => mergeCanonicalMessages(current, [optimistic], conversation))

      const isCurrent = () => sendGeneration === scopeGenerationRef.current
      const applyAck = (ack: HubAck) => {
        if (!isCurrent()) return
        setSendActive(clientMutationId, false)
        if (ack.status) {
          setLastDeliveredMutationId(clientMutationId)
          if (ack.canonical) {
            const canonical = {
              ...ack.canonical,
              attachment: sanitizeAttachment(ack.canonical.attachment),
            }
            void persistCanonical(conversation.id, [canonical])
            updateMessages((current) =>
              mergeCanonicalMessages(
                current.filter(
                  (message) =>
                    message.id !== optimistic.id && message.client_mutation_id !== clientMutationId,
                ),
                [canonical],
                conversation,
              ),
            )
          } else {
            updateDeliveryStatus(optimistic.id, 'sent')
          }
          setError(null)
          return
        }

        const deliveryStatus: DeliveryStatus = ack.code === 'TIMEOUT' ? 'unknown' : 'failed'
        updateDeliveryStatus(optimistic.id, deliveryStatus)
        setError(
          ack.message ||
            (deliveryStatus === 'unknown' ? SEND_TIMEOUT_ERROR : 'ارسال پیام توسط Hub رد شد.'),
        )
      }

      let requestSettled = false
      let timeoutId: number | undefined
      let request: Promise<void>
      try {
        request = sendHubMessage(wireMessage, {
          clientMutationId,
          conversationId: conversation.id,
          senderId,
          sentAt,
        }).then(
          (ack) => {
            requestSettled = true
            if (timeoutId !== undefined) window.clearTimeout(timeoutId)
            applyAck(ack)
          },
          () => {
            requestSettled = true
            if (timeoutId !== undefined) window.clearTimeout(timeoutId)
            if (!isCurrent()) return
            setSendActive(clientMutationId, false)
            updateDeliveryStatus(optimistic.id, 'unknown')
            setError(DEFAULT_SEND_ERROR)
          },
        )
      } catch {
        if (!isCurrent()) {
          return { ok: true, deliveryStatus: 'unknown', clientMutationId }
        }
        setSendActive(clientMutationId, false)
        updateDeliveryStatus(optimistic.id, 'unknown')
        setError(DEFAULT_SEND_ERROR)
        return { ok: true, deliveryStatus: 'unknown', clientMutationId }
      }

      const timeout = new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(() => {
          if (requestSettled) return
          if (!isCurrent()) {
            resolve()
            return
          }
          applyAck({ status: false, code: 'TIMEOUT', message: SEND_TIMEOUT_ERROR })
          resolve()
        }, sendTimeoutMs)
      })
      await Promise.race([request, timeout])
      const deliveryStatus =
        messagesRef.current.find((message) => message.client_mutation_id === clientMutationId)
          ?.delivery_status || 'unknown'
      return { ok: true, deliveryStatus, clientMutationId }
    },
    [
      conversation,
      isConnected,
      isOnline,
      persistCanonical,
      sendHubMessage,
      senderId,
      sendTimeoutMs,
      setSendActive,
      updateDeliveryStatus,
      updateMessages,
    ],
  )

  return {
    messages,
    status,
    error,
    dataSource,
    nextCursor,
    hasMore,
    isLoadingMore,
    isSending: activeSendCount > 0,
    isOffline: !isOnline || !isConnected,
    lastDeliveredMutationId,
    syncStatus,
    lastSyncedAt,
    isStale: dataSource === 'cache' || syncStatus === 'error',
    loadMore,
    retry,
    send,
    clearError,
  }
}
