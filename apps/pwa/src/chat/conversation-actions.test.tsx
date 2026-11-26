import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Conversation } from '@superapp/chat-contracts'
import { PlanetApiError, type ConversationApi } from '@superapp/api-client'
import { useConversationActions } from '@superapp/chat'

const conversation: Conversation = {
  id: 'conv_1',
  project_id: 'prj_12',
  source: 'bale',
  robot_id: 'robot_1',
  chat_id: 'chat_1',
  customer: { id: 'customer_1', display_name: 'مشتری', initials: 'م' },
  support_level: 'level_1',
  status: 'open',
  assignee: { id: 'op_1', name: 'اپراتور اول' },
  last_message: 'سلام',
  last_message_at: '2026-11-25T10:00:00.000Z',
  unread_count: 0,
  created_at: '2026-11-25T09:00:00.000Z',
  updated_at: '2026-11-25T10:00:00.000Z',
  deleted_at: null,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function apiWithActions(): ConversationApi {
  return {
    async list() {
      throw new Error('Not used')
    },
    get: vi.fn(async () => conversation),
    async listMessages() {
      throw new Error('Not used')
    },
    assign: vi.fn(async () => ({
      ...conversation,
      assignee: { id: 'op_2', name: 'اپراتور دوم' },
      status: 'assigned' as const,
    })),
    escalate: vi.fn(async () => ({
      ...conversation,
      support_level: 'level_2' as const,
      status: 'escalated' as const,
    })),
    updateStatus: vi.fn(async (_id, request) => ({ ...conversation, status: request.status })),
  }
}

describe('useConversationActions', () => {
  it('applies an optimistic assignment and reconciles it with the server response', async () => {
    const pending = deferred<Conversation>()
    const api = apiWithActions()
    vi.mocked(api.assign!).mockReturnValue(pending.promise)
    const onConversationChange = vi.fn()
    const { result } = renderHook(() =>
      useConversationActions({
        api,
        conversation,
        permissions: ['chat.assign'],
        operatorLevel: 'level_1',
        onConversationChange,
      }),
    )

    let request!: Promise<boolean>
    act(() => {
      request = result.current.assign('op_2')
    })
    expect(result.current.conversation).toMatchObject({
      assignee: { id: 'op_2' },
      status: 'assigned' as const,
    })
    expect(onConversationChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assignee: expect.objectContaining({ id: 'op_2' }),
        status: 'assigned',
      }),
    )

    const server = {
      ...conversation,
      assignee: { id: 'op_2', name: 'اپراتور دوم' },
      status: 'assigned' as const,
    }
    await act(async () => {
      pending.resolve(server)
      expect(await request).toBe(true)
    })
    expect(result.current.conversation).toEqual(server)
    expect(result.current.status).toBe('success')
  })

  it('blocks actions without permission or above the operator support level', async () => {
    const api = apiWithActions()
    const { result } = renderHook(() =>
      useConversationActions({ api, conversation, permissions: [], operatorLevel: 'level_1' }),
    )
    expect(result.current.canAssign).toBe(false)
    expect(result.current.canEscalate).toBe(false)
    expect(result.current.canChangeStatus).toBe(false)
    await act(async () => {
      expect(await result.current.assign('op_2')).toBe(false)
    })
    expect(api.assign).not.toHaveBeenCalled()

    const higherConversation = { ...conversation, support_level: 'level_2' as const }
    const levelOne = renderHook(() =>
      useConversationActions({
        api,
        conversation: higherConversation,
        permissions: ['chat.assign', 'chat.escalate'],
        operatorLevel: 'level_1',
      }),
    )
    expect(levelOne.result.current.canAssign).toBe(false)
    expect(levelOne.result.current.canEscalate).toBe(false)
  })

  it('escalates, closes and reopens a conversation', async () => {
    const api = apiWithActions()
    const { result } = renderHook(() =>
      useConversationActions({
        api,
        conversation,
        permissions: ['chat.assign', 'chat.escalate'],
        operatorLevel: 'level_1',
      }),
    )

    await act(async () => {
      expect(await result.current.escalate('level_2', 'بررسی فنی')).toBe(true)
    })
    expect(api.escalate).toHaveBeenCalledWith(
      conversation.id,
      { support_level: 'level_2', reason: 'بررسی فنی' },
      expect.any(Object),
    )
    expect(result.current.conversation).toMatchObject({
      support_level: 'level_2' as const,
      status: 'escalated' as const,
    })

    await act(async () => {
      expect(await result.current.setStatus('closed')).toBe(true)
    })
    expect(result.current.conversation.status).toBe('closed')
    expect(result.current.canAssign).toBe(false)

    await act(async () => {
      expect(await result.current.setStatus('open')).toBe(true)
    })
    expect(result.current.conversation.status).toBe('open')
  })

  it('rolls back an optimistic update after a 403 response', async () => {
    const api = apiWithActions()
    vi.mocked(api.assign!).mockRejectedValue(new PlanetApiError('forbidden', 403))
    const { result } = renderHook(() =>
      useConversationActions({
        api,
        conversation,
        permissions: ['chat.assign'],
        operatorLevel: 'level_1',
      }),
    )

    await act(async () => {
      expect(await result.current.assign('op_2')).toBe(false)
    })
    expect(result.current.conversation).toEqual(conversation)
    expect(result.current.error).toContain('403')
    expect(result.current.status).toBe('error')
  })

  it('rolls back and refreshes the conversation after a 409 conflict', async () => {
    const api = apiWithActions()
    const refreshed = {
      ...conversation,
      status: 'closed' as const,
      updated_at: '2026-11-25T10:05:00.000Z',
    }
    vi.mocked(api.assign!).mockRejectedValue(new PlanetApiError('conflict', 409))
    vi.mocked(api.get!).mockResolvedValue(refreshed)
    const { result } = renderHook(() =>
      useConversationActions({
        api,
        conversation,
        permissions: ['chat.assign'],
        operatorLevel: 'level_1',
      }),
    )

    await act(async () => {
      expect(await result.current.assign('op_2')).toBe(false)
    })
    await waitFor(() => expect(result.current.conversation).toEqual(refreshed))
    expect(api.get).toHaveBeenCalledWith(conversation.id, expect.any(Object))
    expect(result.current.error).toContain('409')
  })
})

describe('conversation action API', () => {
  it('returns a controlled 409 when the mock conversation cannot be changed', async () => {
    const { createMockConversationApi } = await import('@superapp/api-client')
    const api = createMockConversationApi()
    await api.updateStatus!('conv_1001', { status: 'closed' })
    await expect(api.assign!('conv_1001', { operator_id: 'op_42' })).rejects.toMatchObject({
      status: 409,
    })
    await expect(api.escalate!('conv_1001', { support_level: 'level_1' })).rejects.toMatchObject({
      status: 409,
    })
  })

  it('posts the documented action body with the messaging bearer token', async () => {
    const { createPlanetConversationApi } = await import('@superapp/api-client')
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ status: true, data: conversation }), { status: 200 }),
    )
    const api = createPlanetConversationApi({
      baseUrl: 'https://planet.example',
      getAccessToken: () => 'messaging_token',
      fetch: fetchMock,
    })

    await api.escalate!('conv_1', { support_level: 'level_2', reason: 'بررسی فنی' })

    const [input, init] = fetchMock.mock.calls[0]!
    expect(String(input)).toBe('https://planet.example/api/v1/chat/conversations/conv_1/escalate')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      support_level: 'level_2',
      reason: 'بررسی فنی',
    })
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer messaging_token')
  })
})
