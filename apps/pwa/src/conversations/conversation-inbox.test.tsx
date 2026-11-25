import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  Conversation,
  ConversationListQuery,
  ConversationPage,
} from '@superapp/chat-contracts'
import {
  createMockConversationApi,
  createPlanetConversationApi,
  filterConversations,
  PlanetApiError,
  type ConversationApi,
} from '@superapp/api-client'
import { useConversationInbox, type ConversationCache } from '@superapp/conversation-inbox'

function conversation(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    project_id: 'prj_12',
    source: 'bale',
    robot_id: 'robot_1',
    chat_id: `chat_${id}`,
    customer: { id: `user_${id}`, display_name: `مشتری ${id}`, initials: 'م' },
    support_level: 'level_1',
    status: 'open',
    assignee: { id: 'op_1', name: 'اپراتور اول' },
    last_message: `پیام ${id}`,
    last_message_at: '2026-11-25T10:00:00.000Z',
    unread_count: 1,
    created_at: '2026-11-25T09:00:00.000Z',
    updated_at: '2026-11-25T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

function page(items: Conversation[], nextCursor: string | null = null): ConversationPage {
  return { items, next_cursor: nextCursor, has_more: Boolean(nextCursor) }
}

function apiWithList(list: ConversationApi['list']): ConversationApi {
  return {
    list,
    async get() {
      return null
    },
    async listMessages() {
      throw new Error('Not used in inbox tests')
    },
  }
}

function createCache(): ConversationCache {
  return {
    list: vi.fn(async () => page([])),
    save: vi.fn(async () => undefined),
  }
}

describe('conversation inbox data', () => {
  it('applies every inbox filter and excludes deleted conversations', async () => {
    const items = [
      conversation('match'),
      conversation('other-source', { source: 'chat' }),
      conversation('other-level', { support_level: 'level_2' }),
      conversation('other-status', { status: 'closed' }),
      conversation('other-operator', { assignee: { id: 'op_2', name: 'اپراتور دوم' } }),
      conversation('read', { unread_count: 0 }),
      conversation('deleted', { deleted_at: '2026-11-25T11:00:00.000Z' }),
    ]
    const api = createMockConversationApi()
    const filtered = await filterConversations(items, {
      search: 'مشتری match',
      source: 'bale',
      support_level: 'level_1',
      status: 'open',
      assignee_operator_id: 'op_1',
      unread_only: true,
    })

    expect(filtered.map((item) => item.id)).toEqual(['match'])
    expect(await api.list({ source: 'chat', limit: 1 })).toMatchObject({
      items: [{ id: 'conv_1002' }],
      has_more: false,
    })
  })

  it('passes filters and the messaging access token to the API', async () => {
    const list = vi.fn<ConversationApi['list']>(async () => page([]))
    const api = apiWithList(list)
    const { result } = renderHook(() =>
      useConversationInbox({
        api,
        ownerId: 'prj_12',
        accessToken: 'messaging_token',
        searchDebounceMs: 0,
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => {
      result.current.setFilters({
        search: 'علی',
        source: 'bale',
        support_level: 'level_2',
        status: 'escalated',
        assignee_operator_id: 'op_18',
        unread_only: true,
      })
    })

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        {
          search: 'علی',
          source: 'bale',
          support_level: 'level_2',
          status: 'escalated',
          assignee_operator_id: 'op_18',
          unread_only: true,
          limit: 30,
        },
        expect.objectContaining({ accessToken: 'messaging_token' }),
      ),
    )
  })

  it('loads the next cursor and merges duplicate conversations', async () => {
    const first = conversation('conv_1')
    const second = conversation('conv_2')
    const list = vi.fn<ConversationApi['list']>(async (query) =>
      query?.cursor ? page([first, second]) : page([first], 'cursor_1'),
    )
    const api = apiWithList(list)
    const { result } = renderHook(() =>
      useConversationInbox({
        api,
        ownerId: 'prj_12',
        pageSize: 1,
        searchDebounceMs: 0,
      }),
    )

    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.hasMore).toBe(true)
    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.items.map((item) => item.id)).toEqual(['conv_1', 'conv_2'])
    expect(result.current.hasMore).toBe(false)
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor_1', limit: 1 }),
      expect.any(Object),
    )
  })

  it('does not write a stale response to the cache after filters change', async () => {
    let resolveFirst!: (value: ConversationPage) => void
    const firstRequest = new Promise<ConversationPage>((resolve) => {
      resolveFirst = resolve
    })
    const current = conversation('current', { status: 'closed' })
    const list = vi
      .fn<ConversationApi['list']>()
      .mockImplementationOnce(() => firstRequest)
      .mockImplementation(async () => page([current]))
    const cache = createCache()
    const api = apiWithList(list)
    const { result } = renderHook(() =>
      useConversationInbox({
        api,
        ownerId: 'prj_12',
        cache,
        searchDebounceMs: 0,
      }),
    )

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    act(() => result.current.setFilters({ status: 'closed' }))
    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['current']))

    await act(async () => {
      resolveFirst(page([conversation('stale')]))
      await firstRequest
    })

    expect(cache.save).toHaveBeenCalledTimes(1)
    expect(cache.save).toHaveBeenCalledWith(
      'prj_12',
      expect.objectContaining({ status: 'closed' }),
      page([current]),
    )
  })

  it('distinguishes an empty result from a loading failure', async () => {
    const api = apiWithList(async () => page([]))
    const { result } = renderHook(() =>
      useConversationInbox({
        api,
        ownerId: 'prj_12',
        searchDebounceMs: 0,
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('uses the owner-scoped cache when the network request fails', async () => {
    const cached = conversation('cached')
    const cache = createCache()
    vi.mocked(cache.list).mockResolvedValue(page([cached]))
    const api = apiWithList(async () => {
      throw new Error('offline')
    })
    const { result } = renderHook(() =>
      useConversationInbox({
        api,
        ownerId: 'prj_12',
        cache,
        searchDebounceMs: 0,
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.dataSource).toBe('cache')
    expect(result.current.items.map((item) => item.id)).toEqual(['cached'])
    expect(cache.list).toHaveBeenCalledWith('prj_12', expect.objectContaining({ limit: 30 }))
    expect(cache.save).not.toHaveBeenCalled()
  })

  it('keeps a successful remote result when writing the cache fails', async () => {
    const cache = createCache()
    vi.mocked(cache.save).mockRejectedValue(new Error('disk full'))
    const api = apiWithList(async () => page([conversation('remote')]))
    const { result } = renderHook(() =>
      useConversationInbox({
        api,
        ownerId: 'prj_12',
        cache,
        searchDebounceMs: 0,
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.dataSource).toBe('remote')
    expect(result.current.items.map((item) => item.id)).toEqual(['remote'])
  })

  it('surfaces a retryable error when neither network nor cache is available', async () => {
    const api = apiWithList(async () => {
      throw new Error('offline')
    })
    const { result } = renderHook(() =>
      useConversationInbox({
        api,
        ownerId: 'prj_12',
        searchDebounceMs: 0,
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('دریافت گفتگوها ناموفق بود. دوباره تلاش کنید.')
    expect(result.current.items).toEqual([])
  })
})

describe('Planet conversation API', () => {
  it('builds the documented query and sends the messaging bearer token', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ status: true, data: page([]) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const api = createPlanetConversationApi({
      baseUrl: 'https://planet.superapp.local/',
      getAccessToken: () => 'session_token',
      fetch: fetchMock,
    })
    const query: ConversationListQuery = {
      search: 'علی',
      source: 'bale',
      support_level: 'level_1',
      status: 'open',
      assignee_operator_id: 'op_42',
      unread_only: true,
      cursor: 'offset_30',
      limit: 30,
    }

    await api.list(query)

    const [input, init] = fetchMock.mock.calls[0]!
    const url = new URL(String(input))
    expect(url.pathname).toBe('/api/v1/chat/conversations')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: 'علی',
      source: 'bale',
      support_level: 'level_1',
      status: 'open',
      assignee_operator_id: 'op_42',
      unread_only: 'true',
      cursor: 'offset_30',
      limit: '30',
    })
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer session_token')
  })

  it('turns non-success responses into a typed API error', async () => {
    const api = createPlanetConversationApi({
      baseUrl: 'https://planet.superapp.local',
      fetch: async () => new Response('{}', { status: 503 }),
    })

    await expect(api.list()).rejects.toBeInstanceOf(PlanetApiError)
    await expect(api.list()).rejects.toMatchObject({ status: 503 })
  })
})
