import type { ServiceSession } from '@superapp/auth'
import type { ConnectionTicket, HubMessage } from '@superapp/chat-contracts'
import type { HubAck, HubEvent, HubTransport, TicketAdapter } from './types'

export class TicketAdapterError extends Error {
  readonly status: number

  constructor(message: string, status = 401) {
    super(message)
    this.name = 'TicketAdapterError'
    this.status = status
  }
}

export function createMockTicketAdapter(): TicketAdapter {
  let counter = 1
  return {
    async create(session: ServiceSession) {
      if (
        session.service !== 'messaging' ||
        !session.accessToken.startsWith('mock_messaging_access_')
      ) {
        throw new TicketAdapterError('نشست سرویس پیام‌رسان معتبر نیست.')
      }
      const ticket: ConnectionTicket = {
        hub_url: 'wss://mock-hub.superapp.local',
        connection_token: `mock_ticket_${String(counter++).padStart(4, '0')}`,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        project_id: session.context.projectId,
        operator_id: session.context.operatorId,
        support_level: 'level_1',
        allowed_sources: ['bale', 'chat'],
      }
      return ticket
    },
  }
}

export function createMockHubTransport() {
  const listeners = new Set<(event: HubEvent) => void>()
  let connected = false
  let failNext = false

  const emit = (event: HubEvent) => listeners.forEach((listener) => listener(event))
  const transport: HubTransport = {
    async connect({ connectionToken }) {
      if (failNext) {
        failNext = false
        emit({ type: 'connect_error', error: 'Mock network error' })
        throw new Error('Mock network error')
      }
      if (!connectionToken.startsWith('mock_ticket_')) {
        emit({ type: 'connect_error', error: 'Invalid mock ticket' })
        throw new Error('Invalid mock ticket')
      }
      connected = true
      emit({ type: 'connect' })
      emit({ type: 'authenticated', payload: { project_id: 'prj_12', role: 'operator' } })
    },
    disconnect() {
      if (!connected) return
      connected = false
      emit({ type: 'disconnect', reason: 'io client disconnect' })
    },
    async send(message: HubMessage): Promise<HubAck> {
      if (!connected) return { status: false, code: 'DISCONNECTED', message: 'Hub is disconnected' }
      emit({ type: 'chat', message })
      return { status: true }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  return {
    transport,
    simulateIncoming(message: HubMessage) {
      if (connected) emit({ type: 'chat', message })
    },
    simulateDisconnect() {
      if (!connected) return
      connected = false
      emit({ type: 'disconnect', reason: 'transport close' })
    },
    failNextConnect() {
      failNext = true
    },
  }
}
