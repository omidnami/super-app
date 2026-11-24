import type { EntityId, ISODateTime } from './common'
import type { SupportLevel } from './auth'

export type ChatSource =
  'bale' | 'chat' | 'rubika' | 'telegram' | 'whatsapp' | 'instagram' | 'eitaa'

export interface ConnectionTicketClaims {
  iss: 'planet'
  aud: 'support-hub'
  sub: EntityId
  project_id: EntityId
  support_level: SupportLevel
  allowed_sources: ChatSource[]
  allowed_conversations?: EntityId[]
  iat: number
  exp: number
  jti: string
}

export interface ConnectionTicket {
  hub_url: string
  connection_token: string
  expires_at: ISODateTime
  project_id: EntityId
  operator_id: EntityId
  support_level: SupportLevel
  allowed_sources: ChatSource[]
}

export interface RefreshConnectionTicketRequest {
  ticket_id?: string
}
