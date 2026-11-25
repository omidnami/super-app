import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ServiceSession } from '@superapp/auth'
import type { Attachment, CanonicalMessage, Conversation } from '@superapp/chat-contracts'
import type { ConversationApi } from '@superapp/api-client'
import {
  createMockHubTransport,
  createMockTicketAdapter,
  HubConnectionProvider,
  type HubAck,
} from '@superapp/hub-client'
import { ChatScreen } from '@superapp/ui/web'
import { AppThemeProvider } from '../theme/AppThemeProvider'

const session: ServiceSession = {
  accessToken: 'mock_messaging_access_op_42',
  refreshToken: 'mock_messaging_refresh_op_42',
  expiresAt: Date.now() + 900000,
  service: 'messaging',
  context: { operatorId: 'op_42', projectId: 'prj_12', permissions: ['chat.read', 'chat.write'] },
}

const conversation: Conversation = {
  id: 'conv_1',
  project_id: 'prj_12',
  source: 'bale',
  robot_id: 'robot_1',
  chat_id: 'chat_1',
  customer: { id: 'customer_1', display_name: 'مشتری', initials: 'م' },
  support_level: 'level_1',
  status: 'open',
  assignee: null,
  last_message: '',
  last_message_at: null,
  unread_count: 0,
  created_at: '2026-11-25T09:00:00.000Z',
  updated_at: '2026-11-25T09:00:00.000Z',
  deleted_at: null,
}

const attachment: Attachment = {
  id: 'att_1',
  provider: 'planet',
  type: 'photo',
  file_name: 'photo.png',
  mime_type: 'image/png',
  file_size: 5,
  duration: null,
  url: null,
  created_at: '2026-11-25T10:00:00.000Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('ChatScreen late ACK reconciliation', () => {
  it('clears a retained uploaded attachment when a timed-out send is confirmed later', async () => {
    const acknowledgement = deferred<HubAck>()
    const hub = createMockHubTransport()
    const send = vi.spyOn(hub.transport, 'send').mockReturnValue(acknowledgement.promise)
    const api: ConversationApi = {
      media: {
        uploadAttachment: vi.fn(async () => attachment),
        getAttachment: vi.fn(async () => attachment),
        getAttachmentContent: vi.fn(async () => ({
          attachment,
          blob: new Blob(['image'], { type: 'image/png' }),
        })),
      },
      list: vi.fn(),
      get: vi.fn(),
      listMessages: vi.fn(async () => ({
        items: [],
        next_cursor: null,
        has_more: false,
        conversation,
      })),
    }

    render(
      <AppThemeProvider>
        <HubConnectionProvider
          session={session}
          ticketAdapter={createMockTicketAdapter()}
          transport={hub.transport}
        >
          <ChatScreen
            conversation={conversation}
            api={api}
            ownerId="scope_1"
            operatorId="op_42"
            sendTimeoutMs={10}
            onBack={() => undefined}
          />
        </HubConnectionProvider>
      </AppThemeProvider>,
    )

    fireEvent.change(screen.getByLabelText('انتخاب فایل'), {
      target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.change(screen.getByLabelText('متن پیام'), {
      target: { value: 'توضیح تصویر' },
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'ارسال' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'ارسال' }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('نامشخص')).toBeInTheDocument()
    expect(screen.getByLabelText('متن پیام')).toHaveValue('توضیح تصویر')
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeEnabled()

    const context = send.mock.calls[0]![1]!
    const canonical: CanonicalMessage = {
      id: 'msg_1',
      conversation_id: conversation.id,
      client_mutation_id: context.clientMutationId,
      sender: 'operator',
      sender_id: 'op_42',
      text: 'توضیح تصویر',
      attachment,
      sent_at: context.sentAt!,
      created_at: context.sentAt!,
      updated_at: context.sentAt!,
      deleted_at: null,
      delivery_status: 'sent',
    }
    act(() => acknowledgement.resolve({ status: true, canonical }))

    await waitFor(() => expect(screen.getByLabelText('متن پیام')).toHaveValue(''))
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeDisabled()
    expect(screen.getByLabelText('شما: توضیح تصویر')).toBeInTheDocument()
  })
})
