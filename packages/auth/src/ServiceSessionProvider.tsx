import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type {
  AuthError,
  ServiceId,
  ServiceSession,
  ServiceSessionContextValue,
  ServiceSessionProviderProps,
} from './types'

const ServiceSessionContext = createContext<ServiceSessionContextValue | null>(null)

export function authStorageKey(service: ServiceId) {
  return `superapp.auth.${service}.v1`
}

function toAuthError(error: unknown): AuthError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const candidate = error as { code: AuthError['code']; message: string; status?: number }
    return { code: candidate.code, message: candidate.message, status: candidate.status }
  }
  return { code: 'NETWORK_ERROR', message: 'ارتباط با سرویس برقرار نشد.' }
}

export function ServiceSessionProvider({
  service,
  storage,
  adapter,
  children,
}: ServiceSessionProviderProps) {
  const [session, setSession] = useState<ServiceSession | null>(null)
  const [status, setStatus] = useState<ServiceSessionContextValue['status']>('disconnected')
  const [error, setError] = useState<AuthError | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    let active = true
    const hydrate = async () => {
      try {
        const stored = await storage.getItem(authStorageKey(service))
        if (!stored) return
        const parsed = JSON.parse(stored) as ServiceSession
        if (parsed.service !== service) return
        const valid = await adapter.validate(service, parsed)
        if (!active) return
        if (valid) {
          setSession(parsed)
          setStatus('connected')
        } else {
          setStatus('expired')
        }
      } catch {
        if (active) setStatus('disconnected')
      } finally {
        if (active) setIsHydrated(true)
      }
    }
    void hydrate()
    return () => {
      active = false
    }
  }, [adapter, service, storage])

  const persist = async (nextSession: ServiceSession) => {
    setSession(nextSession)
    await storage.setItem(authStorageKey(service), JSON.stringify(nextSession))
  }

  const connect = async (
    credentials: Record<string, string> = {
      operator_id: 'op_42',
      project_id: 'prj_12',
      access_code: 'demo',
    },
  ) => {
    setStatus('connecting')
    setError(null)
    try {
      const nextSession = await adapter.connect(service, credentials)
      await persist(nextSession)
      setStatus('connected')
    } catch (connectError) {
      setError(toAuthError(connectError))
      setStatus('error')
    }
  }

  const disconnect = async () => {
    try {
      if (session) await adapter.logout(service, session)
    } finally {
      await storage.removeItem(authStorageKey(service))
      setSession(null)
      setError(null)
      setStatus('disconnected')
    }
  }

  const refresh = async () => {
    if (!session) return
    setStatus('connecting')
    setError(null)
    try {
      const nextSession = await adapter.refresh(service, session)
      await persist(nextSession)
      setStatus('connected')
    } catch (refreshError) {
      setError(toAuthError(refreshError))
      setStatus('expired')
    }
  }

  const expire = async () => {
    if (!session) return
    try {
      const nextSession = adapter.expire
        ? await adapter.expire(service, session)
        : { ...session, expiresAt: Date.now() - 1000 }
      await persist(nextSession)
      setStatus('expired')
    } catch (expireError) {
      setError(toAuthError(expireError))
      setStatus('error')
    }
  }

  const value = useMemo<ServiceSessionContextValue>(
    () => ({
      service,
      status,
      session,
      error,
      isConnected: status === 'connected',
      isHydrated,
      connect,
      disconnect,
      refresh,
      expire,
      clearError: () => setError(null),
    }),
    // Methods intentionally close over the latest session and adapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [error, isHydrated, service, session, status],
  )

  return <ServiceSessionContext.Provider value={value}>{children}</ServiceSessionContext.Provider>
}

export function useServiceSession() {
  const context = useContext(ServiceSessionContext)
  if (!context) throw new Error('useServiceSession must be used inside ServiceSessionProvider')
  return context
}

export function ServiceAuthBoundary({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { isConnected, isHydrated } = useServiceSession()
  if (!isHydrated) return fallback ?? null
  return isConnected ? children : (fallback ?? null)
}
