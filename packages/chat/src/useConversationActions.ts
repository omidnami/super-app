import { useCallback, useEffect, useRef, useState } from 'react'
import { PlanetApiError } from '@superapp/api-client'
import type { Conversation, ConversationStatus, SupportLevel } from '@superapp/chat-contracts'
import type {
  ConversationAction,
  UseConversationActionsOptions,
  UseConversationActionsResult,
} from './types'

const LEVEL_RANK: Record<SupportLevel, number> = { level_1: 1, level_2: 2, level_3: 3 }

function actionErrorMessage(error: unknown) {
  if (error instanceof PlanetApiError) {
    if (error.status === 403) return 'اجازه انجام این عملیات را ندارید. (403)'
    if (error.status === 409) return 'وضعیت گفتگو تغییر کرده است. صفحه را تازه کنید. (409)'
    if (error.status === 404) return 'گفتگو پیدا نشد. (404)'
    return error.message
  }
  return error instanceof Error ? error.message : 'انجام عملیات ناموفق بود.'
}

export function useConversationActions({
  api,
  conversation,
  accessToken,
  permissions = [],
  operatorLevel = 'level_3',
  onConversationChange,
}: UseConversationActionsOptions): UseConversationActionsResult {
  const [current, setCurrent] = useState(conversation)
  const [activeAction, setActiveAction] = useState<ConversationAction | null>(null)
  const [status, setActionStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const currentRef = useRef(conversation)
  const callbackRef = useRef(onConversationChange)
  const savingRef = useRef(false)

  useEffect(() => {
    currentRef.current = conversation
    // The server conversation prop is authoritative after an external refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(conversation)
  }, [conversation])

  useEffect(() => {
    callbackRef.current = onConversationChange
  }, [onConversationChange])

  const levelAllowed = LEVEL_RANK[conversation.support_level] <= LEVEL_RANK[operatorLevel]
  const canAssign =
    levelAllowed && permissions.includes('chat.assign') && current.status !== 'closed'
  const canEscalate =
    levelAllowed &&
    permissions.includes('chat.escalate') &&
    current.status !== 'closed' &&
    LEVEL_RANK[current.support_level] < LEVEL_RANK.level_3
  const canChangeStatus = levelAllowed && permissions.includes('chat.assign')

  const execute = useCallback(
    async (
      action: ConversationAction,
      optimistic: Conversation,
      request: () => Promise<Conversation>,
    ): Promise<boolean> => {
      if (savingRef.current) return false
      savingRef.current = true
      const previous = currentRef.current
      setActiveAction(action)
      setActionStatus('saving')
      setError(null)
      currentRef.current = optimistic
      setCurrent(optimistic)
      callbackRef.current?.(optimistic)

      try {
        const serverConversation = await request()
        currentRef.current = serverConversation
        setCurrent(serverConversation)
        callbackRef.current?.(serverConversation)
        setActionStatus('success')
        return true
      } catch (caught) {
        currentRef.current = previous
        setCurrent(previous)
        callbackRef.current?.(previous)
        setError(actionErrorMessage(caught))
        setActionStatus('error')
        if (caught instanceof PlanetApiError && caught.status === 409 && api.get) {
          try {
            const refreshed = await api.get(previous.id, { accessToken })
            if (refreshed) {
              currentRef.current = refreshed
              setCurrent(refreshed)
              callbackRef.current?.(refreshed)
            }
          } catch {
            // The rolled-back conversation remains visible when refresh fails.
          }
        }
        return false
      } finally {
        savingRef.current = false
        setActiveAction(null)
      }
    },
    [accessToken, api],
  )

  const assign = useCallback(
    (operatorId: string) => {
      if (!canAssign || !operatorId.trim()) {
        setError('تخصیص این گفتگو برای شما مجاز نیست.')
        setActionStatus('error')
        return Promise.resolve(false)
      }
      if (!api.assign) {
        setError('API تخصیص گفتگو در دسترس نیست.')
        setActionStatus('error')
        return Promise.resolve(false)
      }
      const previous = currentRef.current
      const optimistic: Conversation = {
        ...previous,
        assignee:
          previous.assignee?.id === operatorId
            ? previous.assignee
            : { id: operatorId, name: operatorId },
        status: 'assigned',
        updated_at: new Date().toISOString(),
      }
      return execute('assign', optimistic, () =>
        api.assign!(previous.id, { operator_id: operatorId }, { accessToken }),
      )
    },
    [accessToken, api, canAssign, execute],
  )

  const escalate = useCallback(
    (level: SupportLevel, reason?: string) => {
      if (!canEscalate || LEVEL_RANK[level] <= LEVEL_RANK[currentRef.current.support_level]) {
        setError('ارجاع این گفتگو برای شما مجاز نیست.')
        setActionStatus('error')
        return Promise.resolve(false)
      }
      if (!api.escalate) {
        setError('API ارجاع گفتگو در دسترس نیست.')
        setActionStatus('error')
        return Promise.resolve(false)
      }
      const previous = currentRef.current
      const optimistic: Conversation = {
        ...previous,
        support_level: level,
        status: 'escalated',
        updated_at: new Date().toISOString(),
      }
      return execute('escalate', optimistic, () =>
        api.escalate!(previous.id, { support_level: level, reason }, { accessToken }),
      )
    },
    [accessToken, api, canEscalate, execute],
  )

  const setStatus = useCallback(
    (nextStatus: ConversationStatus) => {
      if (!canChangeStatus) {
        setError('تغییر وضعیت این گفتگو برای شما مجاز نیست.')
        setActionStatus('error')
        return Promise.resolve(false)
      }
      if (!api.updateStatus) {
        setError('API تغییر وضعیت گفتگو در دسترس نیست.')
        setActionStatus('error')
        return Promise.resolve(false)
      }
      const previous = currentRef.current
      const optimistic: Conversation = {
        ...previous,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      }
      return execute('status', optimistic, () =>
        api.updateStatus!(previous.id, { status: nextStatus }, { accessToken }),
      )
    },
    [accessToken, api, canChangeStatus, execute],
  )

  return {
    conversation: current,
    activeAction,
    status,
    error,
    canAssign,
    canEscalate,
    canChangeStatus,
    assign,
    escalate,
    setStatus,
    clearError: () => setError(null),
  }
}
