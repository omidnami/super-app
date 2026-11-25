import type { ReactNode } from 'react'
import type { ServiceSession } from '@superapp/auth'
import type { ConnectionTicket, HubMessage } from '@superapp/chat-contracts'

export type HubConnectionState =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'expired' | 'error'

export interface HubAck {
  status: boolean
  message?: string
  code?: string
}

export type HubEvent =
  | { type: 'connect' }
  | { type: 'authenticated'; payload: { project_id?: string; role?: string } }
  | { type: 'disconnect'; reason?: string }
  | { type: 'connect_error'; error: string }
  | { type: 'chat'; message: HubMessage }
  | { type: 'chat_error'; error: HubAck }

export interface HubTransport {
  connect(options: { url: string; connectionToken: string }): Promise<void>
  disconnect(): void
  send(message: HubMessage): Promise<HubAck>
  subscribe(listener: (event: HubEvent) => void): () => void
}

export interface TicketAdapter {
  create(session: ServiceSession): Promise<ConnectionTicket>
}

export interface HubConnectionContextValue {
  state: HubConnectionState
  isConnected: boolean
  error: string | null
  ticketExpiresAt: string | null
  bufferedCount: number
  connect: () => Promise<void>
  disconnect: () => void
  retry: () => Promise<void>
  sendMessage: (message: HubMessage) => Promise<HubAck>
  subscribe: (listener: (message: HubMessage) => void) => () => void
  startBuffering: () => void
  stopBuffering: () => HubMessage[]
}

export interface HubConnectionProviderProps {
  session: ServiceSession | null
  ticketAdapter: TicketAdapter
  transport: HubTransport
  children: ReactNode
}
