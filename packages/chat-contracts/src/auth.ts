import type { EntityId, ISODateTime } from './common'

export type ServiceId = 'messaging' | 'account'
export type SupportLevel = 'level_1' | 'level_2' | 'level_3'

export interface ServiceSessionRequest {
  operator_id: EntityId
  project_id: EntityId
  access_code: string
}

export interface ServiceSession {
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_in: number
  service: ServiceId
  context: ServiceAuthContext
}

export interface ServiceAuthContext {
  operator_id: EntityId
  operator_name: string
  project_id: EntityId
  project_name: string
  support_level?: SupportLevel
  permissions: string[]
}

export interface MessagingAuthContext extends ServiceAuthContext {
  support_level: SupportLevel
  permissions: Array<'chat.read' | 'chat.write' | 'chat.assign' | 'chat.escalate'>
}

export interface AccountAuthContext extends ServiceAuthContext {
  permissions: Array<'shop.read' | 'accounting.read' | 'account.settings.read'>
}

export interface RefreshSessionRequest {
  refresh_token: string
}

export interface LogoutRequest {
  refresh_token?: string
}

export interface SessionRevoked {
  revoked: true
  revoked_at: ISODateTime
}
