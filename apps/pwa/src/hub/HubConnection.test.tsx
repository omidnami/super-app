import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { describe, expect, it } from 'vitest'
import type { ServiceSession } from '@superapp/auth'
import type { ConnectionTicket, HubMessage } from '@superapp/chat-contracts'
import {
  createMockHubTransport,
  createMockTicketAdapter,
  HubConnectionProvider,
  useHubConnection,
} from '@superapp/hub-client'
import type { TicketAdapter } from '@superapp/hub-client'

const session: ServiceSession = {
  accessToken: 'mock_messaging_access_op_42',
  refreshToken: 'mock_messaging_refresh_op_42',
  expiresAt: Date.now() + 900000,
  service: 'messaging',
  context: { operatorId: 'op_42', projectId: 'prj_12', permissions: ['chat.read', 'chat.write'] },
}

const incomingMessage: HubMessage = {
  user_id: '501',
  sender: 'client',
  text: 'سلام از مشتری',
  file: null,
  robot_id: '987654',
  timestamp: Date.now(),
  source: 'bale',
}

function Probe() {
  const { state, error, bufferedCount, sendMessage, subscribe, startBuffering, stopBuffering } =
    useHubConnection()
  const [lastMessage, setLastMessage] = useState('')
  useEffect(() => subscribe((message) => setLastMessage(message.text)), [subscribe])
  const [bufferResult, setBufferResult] = useState(0)
  const [ack, setAck] = useState('')

  return (
    <div>
      <span data-testid="state">{state}</span>
      {error ? <span data-testid="error">{error}</span> : null}
      <span data-testid="message">{lastMessage}</span>
      <span data-testid="buffered">{bufferedCount}</span>
      <span data-testid="buffer-result">{bufferResult}</span>
      <span data-testid="ack">{ack}</span>
      <button
        type="button"
        onClick={() =>
          void sendMessage({ ...incomingMessage, sender: 'operator', text: 'پاسخ اپراتور' }).then(
            (result) => setAck(result.status ? 'sent' : 'failed'),
          )
        }
      >
        send
      </button>
      <button type="button" onClick={startBuffering}>
        buffer-start
      </button>
      <button type="button" onClick={() => setBufferResult(stopBuffering().length)}>
        buffer-stop
      </button>
    </div>
  )
}

describe('Hub connection', () => {
  it('connects with a mock ticket and exchanges live messages', async () => {
    const hub = createMockHubTransport()
    render(
      <HubConnectionProvider
        session={session}
        ticketAdapter={createMockTicketAdapter()}
        transport={hub.transport}
      >
        <Probe />
      </HubConnectionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'))
    fireEvent.click(screen.getByRole('button', { name: 'send' }))
    await waitFor(() => expect(screen.getByTestId('ack')).toHaveTextContent('sent'))
    expect(screen.getByTestId('message')).toHaveTextContent('پاسخ اپراتور')
  })

  it('reconnects after a transport disconnect', async () => {
    const hub = createMockHubTransport()
    render(
      <HubConnectionProvider
        session={session}
        ticketAdapter={createMockTicketAdapter()}
        transport={hub.transport}
      >
        <Probe />
      </HubConnectionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'))
    await act(async () => {
      hub.simulateDisconnect()
    })
    expect(screen.getByTestId('state')).toHaveTextContent('reconnecting')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'), {
      timeout: 4000,
    })
  })

  it('buffers live events during backlog reconciliation', async () => {
    const hub = createMockHubTransport()
    render(
      <HubConnectionProvider
        session={session}
        ticketAdapter={createMockTicketAdapter()}
        transport={hub.transport}
      >
        <Probe />
      </HubConnectionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'))
    fireEvent.click(screen.getByRole('button', { name: 'buffer-start' }))
    await act(async () => {
      hub.simulateIncoming(incomingMessage)
      hub.simulateIncoming({ ...incomingMessage, text: 'پیام دوم' })
    })
    expect(screen.getByTestId('buffered')).toHaveTextContent('2')
    fireEvent.click(screen.getByRole('button', { name: 'buffer-stop' }))
    expect(screen.getByTestId('buffer-result')).toHaveTextContent('2')
  })

  it('refreshes an expiring ticket without losing the connection lifecycle', async () => {
    let calls = 0
    const ticketAdapter: TicketAdapter = {
      async create(): Promise<ConnectionTicket> {
        calls += 1
        return {
          hub_url: 'wss://mock-hub.superapp.local',
          connection_token: `mock_ticket_${calls}`,
          expires_at: new Date(Date.now() + (calls === 1 ? 200 : 300000)).toISOString(),
          project_id: 'prj_12',
          operator_id: 'op_42',
          support_level: 'level_1',
          allowed_sources: ['bale', 'chat'],
        }
      },
    }
    const hub = createMockHubTransport()
    render(
      <HubConnectionProvider
        session={session}
        ticketAdapter={ticketAdapter}
        transport={hub.transport}
      >
        <Probe />
      </HubConnectionProvider>,
    )
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'))
  })

  it('surfaces a Hub connection error and then recovers', async () => {
    const hub = createMockHubTransport()
    hub.failNextConnect()
    render(
      <HubConnectionProvider
        session={session}
        ticketAdapter={createMockTicketAdapter()}
        transport={hub.transport}
      >
        <Probe />
      </HubConnectionProvider>,
    )
    expect(await screen.findByTestId('error')).toHaveTextContent('Mock network error')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'), {
      timeout: 5000,
    })
  })
})
