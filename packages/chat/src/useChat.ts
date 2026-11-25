import { useCallback, useEffect, useRef, useState } from 'react'
import { PlanetApiError } from '@superapp/api-client'
import type {
  CanonicalMessage,
  DeliveryStatus,
  MessageListQuery,
  Paginated,
} from '@superapp/chat-contracts'
import { toHubMessage } from '@superapp/chat-contracts'
import { useHubConnection, type HubAck } from '@superapp/hub-client'
import {
  createOptimisticMessage,
  generateClientMutationId,
  hubMessageSignature,
  mergeCanonicalMessages,
  normalizeHubMessage,
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

  const messagesRef = useRef<CanonicalMessage[]>([])
  const conversationRef = useRef(conversation)
  const historyGenerationRef = useRef(0)
  const scopeGenerationRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const loadingMoreRef = useRef(false)
  const initialLoadingRef = useRef(false)
  const bufferedEventsRef = useRef<CanonicalMessage[]>([])
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
        const page = await api.listMessages(conversation.id, query, { accessToken, signal })
        if (isStale()) throw ABORTED
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
        const page = await cache.listMessages(ownerId, conversation.id, query)
        if (isStale()) throw ABORTED
        return { page, source: 'cache' }
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
        setActiveSendCount(0)
        updateMessages(() => [])
      }
      loadingMoreRef.current = false
      bufferedEventsRef.current = []
      initialLoadingRef.current = true
      setIsLoadingMore(false)
      setStatus('loading')
      setError(null)
      setDataSource(null)
      setNextCursor(null)
      setHasMore(false)

      try {
        const { page, source } = await fetchPage(
          { limit: pageSize },
          requestGeneration,
          controller.signal,
        )
        if (requestGeneration !== historyGenerationRef.current || controller.signal.aborted) return

        initialLoadingRef.current = false
        const buffered = bufferedEventsRef.current
        bufferedEventsRef.current = []
        let next = mergeCanonicalMessages(messagesRef.current, page.items)
        for (const event of buffered) next = mergeCanonicalMessages(next, [event])
        updateMessages(() => next)
        void persistCanonical(conversation.id, buffered)
        setNextCursor(page.next_cursor)
        setHasMore(Boolean(page.has_more && page.next_cursor))
        setDataSource(source)
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
        bufferedEventsRef.current = []
        updateMessages(() => [])
        setNextCursor(null)
        setHasMore(false)
        setDataSource(null)
        setError(historyErrorMessage(requestError))
        setStatus('error')
      }
    },
    [conversation.id, fetchPage, pageSize, persistCanonical, updateMessages],
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
    }
  }, [loadFirstPage, scopeKey])

  useEffect(
    () =>
      subscribe((message) => {
        const canonical = normalizeHubMessage(message, conversationRef.current, senderId)
        if (!canonical || localSignaturesRef.current.has(hubMessageSignature(message))) return
        if (initialLoadingRef.current) {
          bufferedEventsRef.current.push(canonical)
          return
        }
        updateMessages((current) => mergeCanonicalMessages(current, [canonical]))
        void persistCanonical(conversationRef.current.id, [canonical])
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
      updateMessages((current) => mergeCanonicalMessages(current, page.items))
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
  }, [fetchPage, hasMore, nextCursor, pageSize, status, updateMessages])

  const retry = useCallback(async () => {
    await loadFirstPage(false)
  }, [loadFirstPage])

  const clearError = useCallback(() => setError(null), [])

  const send = useCallback(
    async (text: string): Promise<ChatSendResult> => {
      if (!text.trim()) {
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
      )
      const wireMessage = toHubMessage(optimistic, conversation)
      localSignaturesRef.current.add(hubMessageSignature(wireMessage))
      setError(null)
      setSendActive(clientMutationId, true)
      updateMessages((current) => mergeCanonicalMessages(current, [optimistic]))

      const isCurrent = () => sendGeneration === scopeGenerationRef.current
      const applyAck = (ack: HubAck) => {
        if (!isCurrent()) return
        setSendActive(clientMutationId, false)
        if (ack.status) {
          if (ack.canonical) {
            const canonical = ack.canonical
            void persistCanonical(conversation.id, [canonical])
            updateMessages((current) =>
              mergeCanonicalMessages(
                current.filter(
                  (message) =>
                    message.id !== optimistic.id && message.client_mutation_id !== clientMutationId,
                ),
                [canonical],
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
        if (!isCurrent()) return { ok: true }
        setSendActive(clientMutationId, false)
        updateDeliveryStatus(optimistic.id, 'unknown')
        setError(DEFAULT_SEND_ERROR)
        return { ok: true }
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
      return { ok: true }
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
    loadMore,
    retry,
    send,
    clearError,
  }
}
