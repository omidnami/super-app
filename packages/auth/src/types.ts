import type { ReactNode } from 'react'

export type ServiceId = 'messaging' | 'account'
export type AuthStatus = 'disconnected' | 'connecting' | 'connected' | 'expired' | 'error'

export interface ServiceAuthContext {
  operatorId: string
  projectId: string
  permissions: string[]
}

export interface ServiceSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  service: ServiceId
  context: ServiceAuthContext
}

export interface AuthError {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NETWORK_ERROR' | 'UNKNOWN'
  message: string
  status?: number
}

export interface AuthAdapter {
  connect(service: ServiceId, credentials: Record<string, string>): Promise<ServiceSession>
  refresh(service: ServiceId, session: ServiceSession): Promise<ServiceSession>
  validate(service: ServiceId, session: ServiceSession): Promise<boolean> | boolean
  logout(service: ServiceId, session: ServiceSession): Promise<void>
  expire?(service: ServiceId, session: ServiceSession): Promise<ServiceSession>
}

export interface ServiceSessionContextValue {
  service: ServiceId
  status: AuthStatus
  session: ServiceSession | null
  error: AuthError | null
  isConnected: boolean
  isHydrated: boolean
  connect: (credentials?: Record<string, string>) => Promise<void>
  disconnect: () => Promise<void>
  refresh: () => Promise<void>
  expire: () => Promise<void>
  clearError: () => void
}

export interface ServiceSessionProviderProps {
  service: ServiceId
  storage: import('@superapp/storage').StorageAdapter
  adapter: AuthAdapter
  children: ReactNode
}
