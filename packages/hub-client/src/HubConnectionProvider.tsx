import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { HubMessage } from '@superapp/chat-contracts'
import type {
  HubConnectionContextValue,
  HubConnectionProviderProps,
  HubConnectionState,
  HubSendContext,
} from './types'

const HubConnectionContext = createContext<HubConnectionContextValue | null>(null)
const MAX_RECONNECT_ATTEMPTS = 5

export function HubConnectionProvider({
  session,
  ticketAdapter,
  transport,
  children,
}: HubConnectionProviderProps) {
  const [state, setState] = useState<HubConnectionState>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [ticketExpiresAt, setTicketExpiresAt] = useState<string | null>(null)
  const [bufferedCount, setBufferedCount] = useState(0)

  const stateRef = useRef<HubConnectionState>('disconnected')
  const attemptRef = useRef(0)
  const reconnectTimerRef = useRef<number | null>(null)
  const ticketTimerRef = useRef<number | null>(null)
  const intentionalRef = useRef(false)
  const refreshingTicketRef = useRef(false)
  const bufferingRef = useRef(false)
  const bufferRef = useRef<HubMessage[]>([])
  const listenersRef = useRef(new Set<(message: HubMessage) => void>())
  const connectRef = useRef<() => Promise<void>>(async () => {})
  const scheduleReconnectRef = useRef<() => void>(() => {})

  const updateState = useCallback((nextState: HubConnectionState) => {
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current)
    if (ticketTimerRef.current) window.clearTimeout(ticketTimerRef.current)
    reconnectTimerRef.current = null
    ticketTimerRef.current = null
  }, [])

  const scheduleTicketExpiry = useCallback(
    (expiresAt: string) => {
      if (ticketTimerRef.current) window.clearTimeout(ticketTimerRef.current)
      const delay = Math.max(50, Date.parse(expiresAt) - Date.now() - 5000)
      ticketTimerRef.current = window.setTimeout(() => {
        refreshingTicketRef.current = true
        updateState('expired')
        transport.disconnect()
        void connectRef.current()
      }, delay)
    },
    [transport, updateState],
  )

  const connect = useCallback(async () => {
    if (!session || session.service !== 'messaging') return
    clearTimers()
    intentionalRef.current = false
    updateState('connecting')
    setError(null)
    try {
      const ticket = await ticketAdapter.create(session)
      setTicketExpiresAt(ticket.expires_at)
      scheduleTicketExpiry(ticket.expires_at)
      await transport.connect({ url: ticket.hub_url, connectionToken: ticket.connection_token })
    } catch (connectError) {
      refreshingTicketRef.current = false
      const message =
        connectError instanceof Error ? connectError.message : 'ارتباط با Hub برقرار نشد.'
      setError(message)
      scheduleReconnectRef.current()
    }
  }, [clearTimers, session, scheduleTicketExpiry, ticketAdapter, transport, updateState])

  const scheduleReconnect = useCallback(() => {
    if (!session || intentionalRef.current || refreshingTicketRef.current) return
    if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      updateState('error')
      return
    }
    updateState('reconnecting')
    const delay = Math.min(1000 * 2 ** attemptRef.current, 10000)
    attemptRef.current += 1
    reconnectTimerRef.current = window.setTimeout(() => {
      void connectRef.current()
    }, delay)
  }, [session, updateState])

  useEffect(() => {
    connectRef.current = connect
    scheduleReconnectRef.current = scheduleReconnect
  }, [connect, scheduleReconnect])

  useEffect(() => {
    return transport.subscribe((event) => {
      switch (event.type) {
        case 'connect':
          if (stateRef.current !== 'connected') updateState('connecting')
          break
        case 'authenticated':
          attemptRef.current = 0
          refreshingTicketRef.current = false
          updateState('connected')
          setError(null)
          break
        case 'disconnect':
          if (!intentionalRef.current && !refreshingTicketRef.current)
            scheduleReconnectRef.current()
          break
        case 'connect_error':
          setError(event.error)
          scheduleReconnectRef.current()
          break
        case 'chat':
          if (bufferingRef.current) {
            bufferRef.current.push(event.message)
            setBufferedCount(bufferRef.current.length)
          } else {
            listenersRef.current.forEach((listener) => listener(event.message))
          }
          break
        case 'chat_error':
          setError(event.error.message || 'ارسال پیام توسط Hub رد شد.')
          break
      }
    })
  }, [transport, updateState])

  useEffect(() => {
    if (!session || session.service !== 'messaging') {
      intentionalRef.current = true
      clearTimers()
      transport.disconnect()
      queueMicrotask(() => updateState('disconnected'))
      return
    }
    void connectRef.current()
    return () => {
      intentionalRef.current = true
      clearTimers()
      transport.disconnect()
    }
  }, [clearTimers, session, transport, updateState])

  const disconnect = useCallback(() => {
    intentionalRef.current = true
    clearTimers()
    transport.disconnect()
    updateState('disconnected')
    setError(null)
  }, [clearTimers, transport, updateState])

  const retry = useCallback(async () => {
    attemptRef.current = 0
    intentionalRef.current = false
    await connectRef.current()
  }, [])

  const sendMessage = useCallback(
    async (message: HubMessage, context?: HubSendContext) => {
      if (stateRef.current !== 'connected') {
        return { status: false, code: 'DISCONNECTED', message: 'Hub is disconnected' }
      }
      return transport.send(message, context)
    },
    [transport],
  )

  const subscribe = useCallback((listener: (message: HubMessage) => void) => {
    listenersRef.current.add(listener)
    return () => listenersRef.current.delete(listener)
  }, [])

  const startBuffering = useCallback(() => {
    bufferRef.current = []
    bufferingRef.current = true
    setBufferedCount(0)
  }, [])

  const stopBuffering = useCallback(() => {
    bufferingRef.current = false
    const buffered = [...bufferRef.current]
    bufferRef.current = []
    setBufferedCount(0)
    return buffered
  }, [])

  const value = useMemo<HubConnectionContextValue>(
    () => ({
      state,
      isConnected: state === 'connected',
      error,
      ticketExpiresAt,
      bufferedCount,
      connect,
      disconnect,
      retry,
      sendMessage,
      subscribe,
      startBuffering,
      stopBuffering,
    }),
    [
      bufferedCount,
      connect,
      disconnect,
      error,
      retry,
      sendMessage,
      state,
      subscribe,
      startBuffering,
      stopBuffering,
      ticketExpiresAt,
    ],
  )

  return <HubConnectionContext.Provider value={value}>{children}</HubConnectionContext.Provider>
}

export function useHubConnection() {
  const context = useContext(HubConnectionContext)
  if (!context) throw new Error('useHubConnection must be used inside HubConnectionProvider')
  return context
}
