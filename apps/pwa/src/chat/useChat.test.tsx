import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ServiceSession } from '@superapp/auth'
import type {
  Attachment,
  CanonicalMessage,
  Conversation,
  HubMessage,
  MessagePage,
  Paginated,
} from '@superapp/chat-contracts'
import { PlanetApiError, type ConversationApi } from '@superapp/api-client'
import {
  createMockHubTransport,
  createMockTicketAdapter,
  HubConnectionProvider,
  type HubAck,
} from '@superapp/hub-client'
import {
  createOptimisticMessage,
  generateClientMutationId,
  hubMessageSignature,
  mergeCanonicalMessages,
  normalizeHubMessage,
  useChat,
  type ChatSendResult,
  type MessageCache,
  type UseChatOptions,
  type UseChatResult,
} from '../../../../packages/chat/src'

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
  customer: { id: 'customer_1', display_name: 'مشتری اول', initials: 'م' },
  support_level: 'level_1',
  status: 'open',
  assignee: { id: 'op_42', name: 'اپراتور اول' },
  last_message: '',
  last_message_at: null,
  unread_count: 0,
  created_at: '2026-11-25T09:00:00.000Z',
  updated_at: '2026-11-25T09:00:00.000Z',
  deleted_at: null,
}

function canonicalMessage(id: string, overrides: Partial<CanonicalMessage> = {}): CanonicalMessage {
  const sentAt = overrides.sent_at || '2026-11-25T10:00:00.000Z'
  return {
    id,
    conversation_id: conversation.id,
    client_mutation_id: null,
    sender: 'client',
    sender_id: 'customer_1',
    text: `پیام ${id}`,
    attachment: null,
    sent_at: sentAt,
    created_at: sentAt,
    updated_at: sentAt,
    deleted_at: null,
    delivery_status: 'sent',
    ...overrides,
  }
}

function messagePage(items: CanonicalMessage[], nextCursor: string | null = null): MessagePage {
  return {
    items,
    next_cursor: nextCursor,
    has_more: Boolean(nextCursor),
    conversation,
  }
}

function cachedPage(
  items: CanonicalMessage[],
  nextCursor: string | null = null,
): Paginated<CanonicalMessage> {
  return { items, next_cursor: nextCursor, has_more: Boolean(nextCursor) }
}

function apiWithListMessages(list: ConversationApi['listMessages']): ConversationApi {
  return {
    async list() {
      throw new Error('Not used in chat tests')
    },
    async get() {
      throw new Error('Not used in chat tests')
    },
    listMessages: list,
  }
}

function createCache(): MessageCache {
  return {
    listMessages: vi.fn<MessageCache['listMessages']>(async () => cachedPage([])),
    saveMessages: vi.fn<MessageCache['saveMessages']>(async () => undefined),
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

type RenderChatOptions = Partial<UseChatOptions> & {
  hub?: ReturnType<typeof createMockHubTransport>
  session?: ServiceSession | null
}

function renderChat({
  hub = createMockHubTransport(),
  session: activeSession = session,
  ...options
}: RenderChatOptions = {}) {
  const configuration: UseChatOptions = {
    api: options.api || apiWithListMessages(async () => messagePage([])),
    conversation: options.conversation || conversation,
    ownerId: options.ownerId || 'op_42',
    operatorId: options.operatorId,
    accessToken: options.accessToken,
    cache: options.cache,
    isOnline: options.isOnline,
    pageSize: options.pageSize,
    sendTimeoutMs: options.sendTimeoutMs,
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <HubConnectionProvider
      session={activeSession}
      ticketAdapter={createMockTicketAdapter()}
      transport={hub.transport}
    >
      {children}
    </HubConnectionProvider>
  )
  return {
    hub,
    ...renderHook(() => useChat(configuration), { wrapper }),
  }
}

async function waitForReady(result: { current: UseChatResult }, requireConnection = true) {
  await waitFor(() => {
    expect(result.current.status).toBe('ready')
    if (requireConnection) expect(result.current.isOffline).toBe(false)
  })
}

const incomingMessage: HubMessage = {
  user_id: conversation.chat_id,
  sender: 'client',
  text: 'سلام از مشتری',
  file: null,
  robot_id: conversation.robot_id,
  timestamp: Date.parse('2026-11-25T10:01:00.000Z'),
  source: conversation.source,
}

describe('useChat sends', () => {
  it('sends attachment-only messages without changing the seven-field Hub contract', async () => {
    const attachment: Attachment = {
      id: 'att_1',
      provider: 'planet',
      type: 'photo',
      file_name: 'photo.jpg',
      mime_type: 'image/jpeg',
      file_size: 1024,
      duration: null,
      url: 'https://temporary-provider.example/file',
      download_url: 'https://temporary-provider.example/download',
      created_at: '2026-11-25T10:00:00.000Z',
    } as Attachment
    const hub = createMockHubTransport()
    const send = vi.spyOn(hub.transport, 'send')
    const { result } = renderChat({ hub })
    await waitForReady(result)

    await act(async () => {
      await result.current.send('', attachment)
    })

    const [wireMessage] = send.mock.calls[0]!
    expect(Object.keys(wireMessage)).toHaveLength(7)
    expect(wireMessage.file).toMatchObject({ id: attachment.id, url: null })
    expect(wireMessage.file).not.toHaveProperty('download_url')
    expect(result.current.messages[0]).toMatchObject({
      text: '',
      attachment: { id: attachment.id, url: null },
      delivery_status: 'sent',
    })
    expect(result.current.messages[0]?.attachment).not.toHaveProperty('download_url')

    send.mockResolvedValueOnce({ status: false, code: 'REJECTED', message: 'rejected' })
    await act(async () => {
      await result.current.send('', attachment)
    })
    expect(result.current.messages[1]?.delivery_status).toBe('failed')
  })

  it('replaces an optimistic message with the ACK canonical message and keeps context local', async () => {
    const cache = createCache()
    const { hub, result } = renderChat({ cache })
    await waitForReady(result)
    const acknowledgement = deferred<HubAck>()
    const send = vi.spyOn(hub.transport, 'send').mockReturnValue(acknowledgement.promise)
    let sending!: ReturnType<UseChatResult['send']>

    act(() => {
      sending = result.current.send('پاسخ اپراتور')
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({
      text: 'پاسخ اپراتور',
      delivery_status: 'pending',
    })
    expect(result.current.isSending).toBe(true)
    const [wireMessage, context] = send.mock.calls[0]!
    expect(context).toMatchObject({
      conversationId: conversation.id,
      senderId: 'op_42',
      sentAt: expect.any(String),
      clientMutationId: expect.any(String),
    })
    expect(wireMessage).toEqual({
      user_id: conversation.chat_id,
      sender: 'operator',
      text: 'پاسخ اپراتور',
      file: null,
      robot_id: conversation.robot_id,
      timestamp: Date.parse(context!.sentAt!),
      source: conversation.source,
    })
    expect(Object.keys(wireMessage)).toHaveLength(7)

    const canonical = canonicalMessage('canonical_1', {
      client_mutation_id: context!.clientMutationId!,
      sender: 'operator',
      sender_id: 'op_42',
      text: 'پاسخ اپراتور',
      sent_at: context!.sentAt,
    })
    await act(async () => {
      acknowledgement.resolve({ status: true, canonical })
      await sending
    })

    expect(result.current.messages).toEqual([canonical])
    expect(cache.saveMessages).toHaveBeenLastCalledWith('op_42', conversation.id, [canonical])
    expect(await sending).toEqual({ ok: true, deliveryStatus: 'sent' })
    expect(result.current.isSending).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('uses the operator id rather than the opaque cache scope as the sender id', async () => {
    const { result } = renderChat({
      ownerId: JSON.stringify(['op_42', 'prj_12']),
      operatorId: 'op_42',
    })
    await waitForReady(result)

    await act(async () => {
      await result.current.send('پیام با Scope جداگانه')
    })

    expect(result.current.messages[0]?.sender_id).toBe('op_42')
  })

  it('marks a timed-out send unknown without automatically retrying it', async () => {
    const { hub, result } = renderChat({ sendTimeoutMs: 10 })
    await waitForReady(result)
    const send = vi.spyOn(hub.transport, 'send').mockReturnValue(new Promise<HubAck>(() => {}))

    await act(async () => {
      await result.current.send('بدون تأییدیه')
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]?.delivery_status).toBe('unknown')
    expect(result.current.isSending).toBe(false)
    expect(result.current.error).toBeTruthy()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('reconciles a timed-out message when its ACK arrives late', async () => {
    const { hub, result } = renderChat({ sendTimeoutMs: 10 })
    await waitForReady(result)
    const acknowledgement = deferred<HubAck>()
    const send = vi.spyOn(hub.transport, 'send').mockReturnValue(acknowledgement.promise)

    await act(async () => {
      await result.current.send('تأییدیه دیرنگ')
    })
    expect(result.current.messages[0]?.delivery_status).toBe('unknown')
    const context = send.mock.calls[0]![1]!
    const canonical = canonicalMessage('canonical_late', {
      client_mutation_id: context.clientMutationId,
      sender: 'operator',
      sender_id: 'op_42',
      text: 'تأییدیه دیرنگ',
      sent_at: context.sentAt,
    })

    act(() => acknowledgement.resolve({ status: true, canonical }))
    await waitFor(() => expect(result.current.messages).toEqual([canonical]))
    expect(result.current.error).toBeNull()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('marks a thrown network failure unknown and an explicit Hub rejection failed', async () => {
    const { hub, result } = renderChat()
    await waitForReady(result)
    const send = vi
      .spyOn(hub.transport, 'send')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ status: false, code: 'REJECTED', message: 'rejected' })
      .mockResolvedValueOnce({ status: true })

    await act(async () => {
      await result.current.send('خطای شبکه')
    })
    expect(result.current.messages[0]?.delivery_status).toBe('unknown')

    await act(async () => {
      await result.current.send('رد صریح')
    })
    expect(result.current.messages[1]?.delivery_status).toBe('failed')
    expect(result.current.error).toBe('rejected')

    let sendResult!: ChatSendResult
    await act(async () => {
      sendResult = await result.current.send('تأییدیه بدون canonical')
    })
    expect(sendResult).toEqual({ ok: true, deliveryStatus: 'sent' })
    expect(result.current.messages[2]?.delivery_status).toBe('sent')
    expect(result.current.error).toBeNull()
    expect(send).toHaveBeenCalledTimes(3)
  })

  it.each([
    { name: 'offline', isOnline: false, activeSession: session },
    { name: 'disconnected', isOnline: true, activeSession: null },
  ])('does not add or send a message while $name', async ({ isOnline, activeSession }) => {
    const hub = createMockHubTransport()
    const send = vi.spyOn(hub.transport, 'send')
    const { result } = renderChat({ hub, session: activeSession, isOnline })
    await waitForReady(result, false)

    expect(result.current.isOffline).toBe(true)
    let sendResult!: ChatSendResult
    await act(async () => {
      sendResult = await result.current.send('نادرست')
    })
    expect(sendResult).toEqual({
      ok: false,
      code: activeSession ? 'OFFLINE' : 'DISCONNECTED',
    })
    expect(result.current.messages).toEqual([])
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    { text: '', code: 'EMPTY' },
    { text: '   ', code: 'EMPTY' },
    { text: 'x'.repeat(4001), code: 'TOO_LONG' },
  ])('rejects invalid text with $code without adding a message', async ({ text, code }) => {
    const { hub, result } = renderChat()
    await waitForReady(result)
    const send = vi.spyOn(hub.transport, 'send')
    let sendResult!: Awaited<ReturnType<UseChatResult['send']>>

    await act(async () => {
      sendResult = await result.current.send(text)
    })
    expect(sendResult).toEqual({ ok: false, code })
    expect(result.current.messages).toEqual([])
    expect(send).not.toHaveBeenCalled()
  })
})

describe('useChat history and live events', () => {
  it('loads cursor pages, merges them, and caches each canonical page', async () => {
    const first = canonicalMessage('message_1')
    const second = canonicalMessage('message_2', { sent_at: '2026-11-25T10:02:00.000Z' })
    const listMessages = vi.fn<ConversationApi['listMessages']>(async (_id, query) =>
      query?.cursor ? messagePage([second]) : messagePage([first], 'cursor_1'),
    )
    const cache = createCache()
    const { result } = renderChat({
      api: apiWithListMessages(listMessages),
      cache,
      pageSize: 1,
      accessToken: 'messaging_token',
    })

    await waitForReady(result)
    expect(result.current.messages).toEqual([first])
    expect(result.current.nextCursor).toBe('cursor_1')
    expect(result.current.hasMore).toBe(true)
    expect(result.current.dataSource).toBe('remote')
    expect(listMessages).toHaveBeenCalledWith(
      conversation.id,
      { limit: 1 },
      expect.objectContaining({ accessToken: 'messaging_token' }),
    )
    expect(cache.saveMessages).toHaveBeenCalledWith('op_42', conversation.id, [first], undefined)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.messages).toEqual([first, second])
    expect(result.current.nextCursor).toBeNull()
    expect(result.current.hasMore).toBe(false)
    expect(result.current.isLoadingMore).toBe(false)
    expect(listMessages).toHaveBeenLastCalledWith(
      conversation.id,
      { cursor: 'cursor_1', limit: 1 },
      expect.any(Object),
    )
    expect(cache.saveMessages).toHaveBeenLastCalledWith(
      'op_42',
      conversation.id,
      [second],
      undefined,
    )
  })

  it('buffers matching Hub events during initial history loading', async () => {
    const history = deferred<MessagePage>()
    const listMessages = vi.fn<ConversationApi['listMessages']>(() => history.promise)
    const { hub, result } = renderChat({ api: apiWithListMessages(listMessages) })
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.isOffline).toBe(false))

    act(() => hub.simulateIncoming(incomingMessage))
    const historical = canonicalMessage('historical')
    act(() => history.resolve(messagePage([historical])))
    await waitForReady(result)

    expect(result.current.messages.map((message) => message.text)).toEqual([
      historical.text,
      incomingMessage.text,
    ])
  })

  it('deduplicates a buffered live event when the same canonical message exists in history', async () => {
    const history = deferred<MessagePage>()
    const cache = createCache()
    const { hub, result } = renderChat({
      api: apiWithListMessages(() => history.promise),
      cache,
    })
    await waitFor(() => expect(result.current.status).toBe('loading'))
    act(() => hub.simulateIncoming(incomingMessage))
    const canonical = canonicalMessage('canonical_overlap', {
      text: incomingMessage.text,
      sent_at: new Date(incomingMessage.timestamp).toISOString(),
    })
    act(() => history.resolve(messagePage([canonical])))
    await waitForReady(result)

    expect(result.current.messages).toEqual([canonical])
    expect(cache.saveMessages).toHaveBeenCalledWith(
      'op_42',
      conversation.id,
      [canonical],
      undefined,
    )
    expect(cache.saveMessages).not.toHaveBeenCalledWith(
      'op_42',
      conversation.id,
      [expect.objectContaining({ id: expect.stringMatching(/^hub_/) })],
      undefined,
    )
  })

  it('deduplicates live events and ignores another source, robot, or chat', async () => {
    const cache = createCache()
    const { hub, result } = renderChat({ cache })
    await waitForReady(result)

    act(() => {
      hub.simulateIncoming(incomingMessage)
      hub.simulateIncoming(incomingMessage)
      hub.simulateIncoming({ ...incomingMessage, source: 'chat', text: 'منبع دیگر' })
      hub.simulateIncoming({ ...incomingMessage, robot_id: 'robot_2', text: 'ربات دیگر' })
      hub.simulateIncoming({ ...incomingMessage, user_id: 'chat_2', text: 'گفتگوی دیگر' })
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]?.text).toBe(incomingMessage.text)
    expect(cache.saveMessages).toHaveBeenLastCalledWith('op_42', conversation.id, [
      result.current.messages[0],
    ])
  })

  it('falls back to the owner-scoped cache on a network-like error', async () => {
    const cached = canonicalMessage('cached')
    const cache = createCache()
    vi.mocked(cache.listMessages).mockResolvedValue(cachedPage([cached]))
    const api = apiWithListMessages(async () => {
      throw new Error('offline')
    })
    const { result } = renderChat({ api, cache })

    await waitForReady(result)
    expect(result.current.dataSource).toBe('cache')
    expect(result.current.messages).toEqual([cached])
    expect(cache.listMessages).toHaveBeenCalledWith('op_42', conversation.id, { limit: 30 })
    expect(cache.saveMessages).not.toHaveBeenCalled()
  })

  it('never falls back to cached business data after a 403 response', async () => {
    const cache = createCache()
    vi.mocked(cache.listMessages).mockResolvedValue(cachedPage([canonicalMessage('cached')]))
    const api = apiWithListMessages(async () => {
      throw new PlanetApiError('Forbidden', 403)
    })
    const { result } = renderChat({ api, cache })

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.messages).toEqual([])
    expect(result.current.dataSource).toBeNull()
    expect(result.current.error).toContain('دسترسی')
    expect(cache.listMessages).not.toHaveBeenCalled()
    expect(cache.saveMessages).not.toHaveBeenCalled()
  })

  it('resets messages and pagination when the conversation or owner changes', async () => {
    const otherConversation = { ...conversation, id: 'conv_2', chat_id: 'chat_2' }
    const listMessages = vi.fn<ConversationApi['listMessages']>(async (conversationId) =>
      messagePage([
        canonicalMessage(`message_${conversationId}`, { conversation_id: conversationId }),
      ]),
    )
    const api = apiWithListMessages(listMessages)
    const hub = createMockHubTransport()
    const { result, rerender } = renderHook(
      ({ ownerId, activeConversation }) =>
        useChat({ api, conversation: activeConversation, ownerId }),
      {
        initialProps: { ownerId: 'op_42', activeConversation: conversation },
        wrapper: ({ children }: { children: ReactNode }) => (
          <HubConnectionProvider
            session={session}
            ticketAdapter={createMockTicketAdapter()}
            transport={hub.transport}
          >
            {children}
          </HubConnectionProvider>
        ),
      },
    )
    await waitFor(() => expect(result.current.messages).toHaveLength(1))

    rerender({ ownerId: 'op_42', activeConversation: otherConversation })
    await waitFor(() =>
      expect(result.current.messages[0]?.conversation_id).toBe(otherConversation.id),
    )
    expect(result.current.nextCursor).toBeNull()
    expect(result.current.hasMore).toBe(false)

    rerender({ ownerId: 'op_43', activeConversation: otherConversation })
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(3))
    expect(result.current.messages).toHaveLength(1)
  })
})

describe('shared mock transport', () => {
  it('returns one canonical id for duplicate client mutation ids while emitting each echo', async () => {
    const hub = createMockHubTransport()
    await hub.transport.connect({
      url: 'wss://mock-hub.superapp.local',
      connectionToken: 'mock_ticket_test',
    })
    const echoes: HubMessage[] = []
    const unsubscribe = hub.transport.subscribe((event) => {
      if (event.type === 'chat') echoes.push(event.message)
    })
    const wireMessage = { ...incomingMessage, sender: 'operator' as const, text: 'پاسخ' }
    const context = {
      clientMutationId: 'cm_idempotent',
      conversationId: conversation.id,
      senderId: 'op_42',
      sentAt: '2026-11-25T10:03:00.000Z',
    }

    const first = await hub.transport.send(wireMessage, context)
    const second = await hub.transport.send(wireMessage, context)
    expect(first).toEqual({ status: true, canonical: second.canonical })
    expect(second.canonical?.id).toBe('mock_message_0001')
    expect(echoes).toEqual([wireMessage, wireMessage])
    expect(Object.keys(wireMessage)).toHaveLength(7)
    unsubscribe()
    hub.transport.disconnect()
  })

  it("lets two Chat probes using one transport receive each other's messages", async () => {
    const hub = createMockHubTransport()
    const api = apiWithListMessages(async () => messagePage([]))
    const { result } = renderHook(
      () => ({
        first: useChat({ api, conversation, ownerId: 'op_42' }),
        second: useChat({ api, conversation, ownerId: 'op_43' }),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <HubConnectionProvider
            session={session}
            ticketAdapter={createMockTicketAdapter()}
            transport={hub.transport}
          >
            {children}
          </HubConnectionProvider>
        ),
      },
    )
    await waitFor(() => {
      expect(result.current.first.status).toBe('ready')
      expect(result.current.second.status).toBe('ready')
      expect(result.current.first.isOffline).toBe(false)
      expect(result.current.second.isOffline).toBe(false)
    })

    await act(async () => {
      await result.current.first.send('از اپراتور اول')
    })
    await waitFor(() => {
      expect(result.current.first.messages).toHaveLength(1)
      expect(result.current.second.messages).toHaveLength(1)
    })

    await act(async () => {
      await result.current.second.send('از اپراتور دوم')
    })
    await waitFor(() => {
      expect(result.current.first.messages).toHaveLength(2)
      expect(result.current.second.messages).toHaveLength(2)
    })
    expect(result.current.first.messages.map((message) => message.text)).toEqual(
      expect.arrayContaining(['از اپراتور اول', 'از اپراتور دوم']),
    )
    expect(result.current.second.messages.map((message) => message.text)).toEqual(
      expect.arrayContaining(['از اپراتور اول', 'از اپراتور دوم']),
    )
  })
})

describe('canonical message helpers', () => {
  it('normalizes duplicate Hub wire messages to the same canonical id', () => {
    const first = normalizeHubMessage(incomingMessage, conversation, 'op_42')
    const second = normalizeHubMessage({ ...incomingMessage }, conversation, 'op_42')

    expect(first).toEqual(second)
    expect(first?.id).toMatch(/^hub_[0-9a-f]{16}$/)
    expect(first).not.toHaveProperty('user_id')
    expect(hubMessageSignature(incomingMessage)).toBe(hubMessageSignature({ ...incomingMessage }))
  })

  it('keeps distinct canonical messages with identical content while removing a synthetic match', () => {
    const first = canonicalMessage('canonical_1', {
      text: 'محتوای یکسان',
      sent_at: '2026-11-25T10:03:00.000Z',
    })
    const second = canonicalMessage('canonical_2', {
      text: first.text,
      sent_at: first.sent_at,
    })
    const synthetic = normalizeHubMessage(
      {
        ...incomingMessage,
        text: first.text,
        timestamp: Date.parse(first.sent_at),
      },
      conversation,
      'op_42',
    )!

    expect(
      mergeCanonicalMessages([first, second, synthetic], [], conversation).map(
        (message) => message.id,
      ),
    ).toEqual(['canonical_1', 'canonical_2'])
    expect(
      mergeCanonicalMessages([synthetic], [first, second], conversation).map(
        (message) => message.id,
      ),
    ).toEqual(['canonical_1', 'canonical_2'])
  })

  it('deduplicates by canonical id and client mutation id and sorts chronologically', () => {
    const clientMutationId = generateClientMutationId()
    const optimistic = createOptimisticMessage(
      conversation,
      'op_42',
      'پاسخ',
      clientMutationId,
      '2026-11-25T10:02:00.000Z',
    )
    const canonical = canonicalMessage('canonical', {
      client_mutation_id: clientMutationId,
      sender: 'operator',
      sender_id: 'op_42',
      text: 'پاسخ',
      sent_at: optimistic.sent_at,
    })
    const earlier = canonicalMessage('earlier', { sent_at: '2026-11-25T10:01:00.000Z' })

    expect(mergeCanonicalMessages([optimistic, earlier, earlier], [canonical, canonical])).toEqual([
      earlier,
      canonical,
    ])
    expect(generateClientMutationId()).not.toBe(clientMutationId)
  })
})
