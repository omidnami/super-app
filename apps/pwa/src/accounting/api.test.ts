// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type {
  AccountingDashboard,
  AccountingDocument,
  AccountingDocumentListQuery,
  AccountingDocumentPage,
} from '@superapp/chat-contracts'
import {
  createConfiguredAccountingApi,
  createMockAccountingApi,
  createPlanetAccountingApi,
  PlanetApiError,
} from '@superapp/api-client'

const timestamp = '2026-11-24T08:25:00.000Z'
const dashboardUpdatedAt = '2026-11-24T10:45:00.000Z'
const document: AccountingDocument = {
  id: 'acc_6001',
  code: 'INV-2026-1108',
  type: 'invoice',
  status: 'confirmed',
  counterparty_name: 'علی محمدی',
  total: { amount: 12989000, currency: 'IRR' },
  issued_at: timestamp,
  updated_at: timestamp,
  deleted_at: null,
  description: 'فاکتور فروش سفارش TK-1008',
}
const dashboard: AccountingDashboard = {
  total_receivable: { amount: 4500000, currency: 'IRR' },
  total_payable: { amount: 3200000, currency: 'IRR' },
  current_balance: { amount: 18539000, currency: 'IRR' },
  documents_count: 2,
  balances: [
    {
      account_id: 'accnt_1',
      title: 'صندوق',
      balance: { amount: 6200000, currency: 'IRR' },
      updated_at: dashboardUpdatedAt,
    },
    {
      account_id: 'accnt_2',
      title: 'بانک',
      balance: { amount: 12339000, currency: 'IRR' },
      updated_at: dashboardUpdatedAt,
    },
  ],
  updated_at: dashboardUpdatedAt,
}
const page: AccountingDocumentPage = {
  items: [document],
  next_cursor: null,
  has_more: false,
}

function responseWithPayload(payload: unknown, status = 200): Response {
  const response = new Response(null, { status })
  Object.defineProperty(response, 'json', { value: async () => payload })
  return response
}

function successResponse(data: unknown): Response {
  return responseWithPayload({ status: true, data })
}

describe('accounting API adapters', () => {
  it('uses authenticated GETs for every path and serializes all list filters', async () => {
    const calls: Array<{ url: URL; init?: RequestInit }> = []
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      calls.push({ url: new URL(String(input)), init })
      const path = calls.at(-1)!.url.pathname
      const data = path.endsWith('/dashboard')
        ? dashboard
        : path.endsWith('/documents')
          ? { ...page, next_cursor: 'offset_1', has_more: true, total: 2 }
          : document
      return successResponse(data)
    })
    const api = createPlanetAccountingApi({
      baseUrl: 'https://planet.example/',
      getAccessToken: () => 'provider-token',
      fetch: fetchMock,
    })
    const controller = new AbortController()
    const context = { accessToken: 'context-token', signal: controller.signal }
    const query: AccountingDocumentListQuery = {
      search: 'INV-2026',
      type: 'invoice',
      status: 'confirmed',
      issued_from: '2026-11-01',
      issued_to: '2026-11-24T23:59:59.999Z',
      cursor: 'offset_10',
      limit: 25,
    }

    await expect(api.dashboard(context)).resolves.toEqual(dashboard)
    await expect(api.listDocuments(query, context)).resolves.toEqual({
      ...page,
      next_cursor: 'offset_1',
      has_more: true,
      total: 2,
    })
    await expect(api.getDocument('acc/6001', context)).resolves.toEqual(document)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(calls.map(({ url }) => url.pathname)).toEqual([
      '/api/v1/account/accounting/dashboard',
      '/api/v1/account/accounting/documents',
      '/api/v1/account/accounting/documents/acc%2F6001',
    ])
    expect(Object.fromEntries(calls[1]!.url.searchParams)).toEqual({
      search: 'INV-2026',
      type: 'invoice',
      status: 'confirmed',
      issued_from: '2026-11-01',
      issued_to: '2026-11-24T23:59:59.999Z',
      cursor: 'offset_10',
      limit: '25',
    })
    for (const { init } of calls) {
      expect(init?.method).toBe('GET')
      expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer context-token')
      expect(init?.signal).toBe(controller.signal)
    }
  })

  it('falls back to the token provider and accepts a null document response', async () => {
    const getAccessToken = vi.fn(() => 'provider-token')
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname
      return successResponse(path.endsWith('/documents/missing') ? null : page)
    })
    const api = createPlanetAccountingApi({
      baseUrl: 'https://planet.example',
      getAccessToken,
      fetch: fetchMock,
    })

    await expect(api.getDocument('missing')).resolves.toBeNull()
    expect(getAccessToken).toHaveBeenCalledOnce()
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer provider-token',
    )
  })

  it('filters and paginates mock documents with inclusive date-only bounds', async () => {
    const api = createMockAccountingApi()

    await expect(api.dashboard()).resolves.toEqual(dashboard)
    await expect(api.getDocument(document.id)).resolves.toEqual(document)
    await expect(api.getDocument('missing')).resolves.toBeNull()

    const first = await api.listDocuments({ limit: 1 })
    expect(first.items.map((item) => item.id)).toEqual(['acc_6001'])
    expect(first.next_cursor).toBe('offset_1')
    expect(first.has_more).toBe(true)
    expect(first.total).toBe(2)

    const second = await api.listDocuments({ limit: 1, cursor: first.next_cursor! })
    expect(second.items.map((item) => item.id)).toEqual(['acc_6002'])
    expect(second.next_cursor).toBeNull()
    expect(second.has_more).toBe(false)

    await expect(
      api.listDocuments({
        search: 'INV-2026',
        type: 'invoice',
        status: 'confirmed',
        issued_from: '2026-11-24',
        issued_to: '2026-11-24',
      }),
    ).resolves.toMatchObject({ items: [document] })
    await expect(
      api.listDocuments({ issued_from: '2026-11-24T08:25:00.000Z' }),
    ).resolves.toMatchObject({ items: [document] })
    await expect(api.listDocuments({ issued_to: '2026-11-23' })).resolves.toMatchObject({
      items: [{ id: 'acc_6002' }],
    })
  })

  it('exposes only read methods from mock, Planet, and configured adapters', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => successResponse(dashboard))
    const planet = createPlanetAccountingApi({
      baseUrl: 'https://planet.example',
      fetch: fetchMock,
    })
    const mock = createMockAccountingApi()
    const configured = createConfiguredAccountingApi()

    for (const api of [mock, planet, configured]) {
      expect(Object.keys(api).sort()).toEqual(['dashboard', 'getDocument', 'listDocuments'])
      expect(api).not.toHaveProperty('createDocument')
      expect(api).not.toHaveProperty('updateDocument')
      expect(api).not.toHaveProperty('deleteDocument')
    }
    await expect(configured.dashboard()).resolves.toEqual(dashboard)

    const subpath = await import('@superapp/api-client/accounting')
    expect(subpath.createConfiguredAccountingApi).toBe(createConfiguredAccountingApi)
  })

  it('trims a configured Planet URL', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => successResponse(dashboard))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const api = createConfiguredAccountingApi('  https://planet.example/  ')
      await expect(api.dashboard()).resolves.toEqual(dashboard)
      expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
        '/api/v1/account/accounting/dashboard',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects malformed envelopes and invalid JSON', async () => {
    const invalidPayloads: unknown[] = [
      null,
      [],
      { status: true },
      { data: document },
      { status: false, data: document },
      { status: 1, data: document },
    ]
    for (const payload of invalidPayloads) {
      const api = createPlanetAccountingApi({
        baseUrl: 'https://planet.example',
        fetch: async () => responseWithPayload(payload),
      })
      await expect(api.getDocument(document.id)).rejects.toBeInstanceOf(PlanetApiError)
    }

    const invalidJson = createPlanetAccountingApi({
      baseUrl: 'https://planet.example',
      fetch: async () => new Response('{', { status: 200 }),
    })
    await expect(invalidJson.dashboard()).rejects.toMatchObject({
      name: 'PlanetApiError',
      status: 200,
    })
  })

  it('strictly validates document fields, enums, money, and dates', async () => {
    const invalidDocuments: unknown[] = [
      { ...document, id: 1 },
      { ...document, type: 'credit_note' },
      { ...document, status: 'paid' },
      { ...document, total: { amount: Number.POSITIVE_INFINITY, currency: 'IRR' } },
      { ...document, total: { amount: 1, currency: 'USD' } },
      { ...document, issued_at: 'not-a-date' },
      { ...document, updated_at: 'not-a-date' },
      { ...document, deleted_at: 'not-a-date' },
      { ...document, counterparty_name: null },
      { ...document, description: null },
    ]
    for (const data of invalidDocuments) {
      const api = createPlanetAccountingApi({
        baseUrl: 'https://planet.example',
        fetch: async () => successResponse(data),
      })
      await expect(api.getDocument(document.id)).rejects.toMatchObject({
        name: 'PlanetApiError',
        status: 200,
      })
    }
  })

  it('strictly validates dashboard money, counts, balances, and dates', async () => {
    const invalidDashboards: unknown[] = [
      { ...dashboard, total_receivable: { amount: Number.NaN, currency: 'IRR' } },
      { ...dashboard, total_payable: { amount: 1, currency: 'USD' } },
      { ...dashboard, current_balance: { amount: Number.NEGATIVE_INFINITY, currency: 'IRR' } },
      { ...dashboard, documents_count: -1 },
      { ...dashboard, documents_count: 1.5 },
      { ...dashboard, documents_count: Number.POSITIVE_INFINITY },
      { ...dashboard, balances: {} },
      {
        ...dashboard,
        balances: [{ ...dashboard.balances[0]!, updated_at: 'not-a-date' }],
      },
      { ...dashboard, updated_at: 'not-a-date' },
    ]
    for (const data of invalidDashboards) {
      const api = createPlanetAccountingApi({
        baseUrl: 'https://planet.example',
        fetch: async () => successResponse(data),
      })
      await expect(api.dashboard()).rejects.toBeInstanceOf(PlanetApiError)
    }
  })

  it('strictly validates page items, cursor consistency, and totals', async () => {
    const invalidPages: unknown[] = [
      { ...page, items: {} },
      { ...page, items: [{ ...document, status: 'unknown' }] },
      { items: [], has_more: false },
      { ...page, next_cursor: 1 },
      { ...page, has_more: 'false' },
      { ...page, has_more: true },
      { ...page, next_cursor: '' },
      { ...page, next_cursor: 'offset_1' },
      { ...page, total: -1 },
      { ...page, total: 1.5 },
      { ...page, total: Number.POSITIVE_INFINITY },
    ]
    for (const data of invalidPages) {
      const api = createPlanetAccountingApi({
        baseUrl: 'https://planet.example',
        fetch: async () => successResponse(data),
      })
      await expect(api.listDocuments()).rejects.toMatchObject({
        name: 'PlanetApiError',
        status: 200,
      })
    }
  })

  it('rejects invalid or reversed accounting date ranges before filtering or fetching', async () => {
    const mock = createMockAccountingApi()
    await expect(mock.listDocuments({ issued_from: 'not-a-date' })).rejects.toMatchObject({
      name: 'PlanetApiError',
      status: 422,
    })
    await expect(
      mock.listDocuments({ issued_from: '2026-11-25', issued_to: '2026-11-24' }),
    ).rejects.toMatchObject({ status: 422 })

    const fetchMock = vi.fn<typeof fetch>()
    const planet = createPlanetAccountingApi({
      baseUrl: 'https://planet.example',
      fetch: fetchMock,
    })
    await expect(planet.listDocuments({ issued_to: '2026-02-31' })).rejects.toMatchObject({
      status: 422,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves HTTP failures as PlanetApiError', async () => {
    const api = createPlanetAccountingApi({
      baseUrl: 'https://planet.example',
      fetch: async () => new Response('{}', { status: 503 }),
    })

    await expect(api.listDocuments()).rejects.toBeInstanceOf(PlanetApiError)
    await expect(api.listDocuments()).rejects.toMatchObject({ status: 503 })
  })

  it('honors pre-aborted signals in every mock and Planet method without fetching', async () => {
    const controller = new AbortController()
    controller.abort()
    const context = { signal: controller.signal }
    const fetchMock = vi.fn<typeof fetch>()
    const mock = createMockAccountingApi()
    const planet = createPlanetAccountingApi({
      baseUrl: 'https://planet.example',
      fetch: fetchMock,
    })

    for (const api of [mock, planet]) {
      await expect(api.dashboard(context)).rejects.toMatchObject({ name: 'AbortError' })
      await expect(api.listDocuments({}, context)).rejects.toMatchObject({ name: 'AbortError' })
      await expect(api.getDocument(document.id, context)).rejects.toMatchObject({
        name: 'AbortError',
      })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('honors a signal aborted while a Planet request is in flight', async () => {
    const controller = new AbortController()
    let requestSignal: AbortSignal | null | undefined
    let markFetchStarted = () => {}
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve
    })
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      requestSignal = init?.signal
      markFetchStarted()
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    })
    const api = createPlanetAccountingApi({
      baseUrl: 'https://planet.example',
      fetch: fetchMock,
    })

    const pending = api.dashboard({ signal: controller.signal })
    await fetchStarted
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestSignal).toBe(controller.signal)
  })
})
