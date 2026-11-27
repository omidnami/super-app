import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  AccountingDashboard,
  AccountingDocument,
  AccountingDocumentListQuery,
  AccountingDocumentPage,
} from '@superapp/chat-contracts'
import { PlanetApiError, type AccountingApi } from '@superapp/api-client'
import { useAccounting, type AccountingCache } from '@superapp/accounting'

const lastSyncedAt = '2026-11-26T09:59:00.000Z'
const document: AccountingDocument = {
  id: 'acc_6001',
  code: 'INV-2026-1108',
  type: 'invoice',
  status: 'confirmed',
  counterparty_name: 'علی محمدی',
  total: { amount: 12989000, currency: 'IRR' },
  issued_at: '2026-11-24T08:25:00.000Z',
  updated_at: '2026-11-24T08:25:00.000Z',
  deleted_at: null,
  description: 'فاکتور فروش سفارش TK-1008',
}
const receipt: AccountingDocument = {
  ...document,
  id: 'acc_6002',
  code: 'RCPT-2026-1109',
  type: 'receipt',
  counterparty_name: 'شرکت آلفا',
  total: { amount: 2500000, currency: 'IRR' },
  description: 'رسید پیش پرداخت',
}
const payment: AccountingDocument = {
  ...document,
  id: 'acc_6003',
  code: 'PAY-2026-0311',
  type: 'payment',
  counterparty_name: 'تأمین‌کننده',
  total: { amount: 750000, currency: 'IRR' },
  description: 'پرداخت هزینه',
}
const dashboard: AccountingDashboard = {
  total_receivable: { amount: 4500000, currency: 'IRR' },
  total_payable: { amount: 3200000, currency: 'IRR' },
  current_balance: { amount: 18539000, currency: 'IRR' },
  documents_count: 3,
  balances: [
    {
      account_id: 'accnt_1',
      title: 'صندوق',
      balance: { amount: 6200000, currency: 'IRR' },
      updated_at: '2026-11-24T10:45:00.000Z',
    },
    {
      account_id: 'accnt_2',
      title: 'بانک',
      balance: { amount: 12339000, currency: 'IRR' },
      updated_at: '2026-11-24T11:45:00.000Z',
    },
  ],
  updated_at: '2026-11-24T10:45:00.000Z',
}

function page(
  items: AccountingDocument[],
  nextCursor: string | null = null,
  hasMore = false,
): AccountingDocumentPage {
  return { items, next_cursor: nextCursor, has_more: hasMore }
}

function api(): AccountingApi {
  return {
    dashboard: vi.fn(async () => dashboard),
    listDocuments: vi.fn(async () => page([document])),
    getDocument: vi.fn(async () => document),
  }
}

function cache(): AccountingCache {
  return {
    getDashboard: vi.fn(async () => dashboard),
    saveDashboard: vi.fn(async () => undefined),
    listDocuments: vi.fn(async () => page([document])),
    saveDocuments: vi.fn(async () => undefined),
    getDocument: vi.fn(async () => document),
    getSyncState: vi.fn(async () => ({ last_synced_at: lastSyncedAt })),
    clear: vi.fn(async () => undefined),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('useAccounting', () => {
  it('issues no API or cache reads when accounting.read is absent', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    const { result } = renderHook(() =>
      useAccounting({
        api: accountingApi,
        ownerId: 'scope_1',
        cache: accountingCache,
        enabled: false,
      }),
    )

    expect(result.current.dashboard.status).toBe('idle')
    expect(result.current.documents.status).toBe('idle')
    expect(result.current.report.status).toBe('idle')
    expect(result.current.detail.status).toBe('idle')

    await act(async () => {
      await result.current.refreshAll()
      await result.current.loadMoreDocuments()
      await result.current.openDocument(document.id)
    })

    expect(accountingApi.dashboard).not.toHaveBeenCalled()
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
    expect(accountingApi.getDocument).not.toHaveBeenCalled()
    expect(accountingCache.getDashboard).not.toHaveBeenCalled()
    expect(accountingCache.listDocuments).not.toHaveBeenCalled()
    expect(accountingCache.getDocument).not.toHaveBeenCalled()
    expect(accountingCache.getSyncState).not.toHaveBeenCalled()
  })

  it('loads the online dashboard and documents and writes both to the cache', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    const { result } = renderHook(() =>
      useAccounting({
        api: accountingApi,
        ownerId: 'scope_1',
        accessToken: 'account_token',
        cache: accountingCache,
      }),
    )

    await waitFor(() => {
      expect(result.current.dashboard.status).toBe('ready')
      expect(result.current.documents.status).toBe('ready')
    })

    expect(result.current.dashboard.data).toEqual(dashboard)
    expect(result.current.documents.data).toEqual(page([document]))
    expect(result.current.dashboard.dataSource).toBe('remote')
    expect(result.current.documents.dataSource).toBe('remote')
    expect(result.current.dashboard.lastSyncedAt).toEqual(expect.any(String))
    expect(result.current.documents.lastSyncedAt).toEqual(expect.any(String))
    expect(accountingApi.dashboard).toHaveBeenCalledWith({
      accessToken: 'account_token',
      signal: expect.any(AbortSignal),
    })
    expect(accountingApi.listDocuments).toHaveBeenCalledWith(
      { limit: 30 },
      { accessToken: 'account_token', signal: expect.any(AbortSignal) },
    )
    expect(accountingCache.saveDashboard).toHaveBeenCalledWith('scope_1', dashboard)
    expect(accountingCache.saveDocuments).toHaveBeenCalledWith('scope_1', [document])
    expect(accountingCache.getDashboard).not.toHaveBeenCalled()
    expect(accountingCache.listDocuments).not.toHaveBeenCalled()
  })

  it('uses stale cached dashboard and documents with their last sync time while offline', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    const { result } = renderHook(() =>
      useAccounting({
        api: accountingApi,
        ownerId: 'scope_1',
        cache: accountingCache,
        isOnline: false,
      }),
    )

    await waitFor(() => {
      expect(result.current.dashboard.status).toBe('ready')
      expect(result.current.documents.status).toBe('ready')
    })

    expect(result.current.dashboard.data).toEqual(dashboard)
    expect(result.current.documents.data).toEqual(page([document]))
    expect(result.current.dashboard.dataSource).toBe('cache')
    expect(result.current.documents.dataSource).toBe('cache')
    expect(result.current.dashboard.lastSyncedAt).toBe(lastSyncedAt)
    expect(result.current.documents.lastSyncedAt).toBe(lastSyncedAt)
    expect(accountingCache.getDashboard).toHaveBeenCalledWith('scope_1')
    expect(accountingCache.listDocuments).toHaveBeenCalledWith('scope_1', { limit: 30 })
    expect(accountingCache.getSyncState).toHaveBeenCalledWith('scope_1', 'accounting:dashboard')
    expect(accountingCache.getSyncState).toHaveBeenCalledWith('scope_1', 'accounting:documents')
    expect(accountingApi.dashboard).not.toHaveBeenCalled()
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
    expect(accountingCache.saveDashboard).not.toHaveBeenCalled()
    expect(accountingCache.saveDocuments).not.toHaveBeenCalled()
  })

  it('paginates cached documents offline without issuing API requests', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    vi.mocked(accountingCache.listDocuments).mockImplementation(async (_ownerId, query) =>
      query.cursor ? page([receipt]) : page([document], 'offset_1', true),
    )
    const { result } = renderHook(() =>
      useAccounting({
        api: accountingApi,
        ownerId: 'scope_1',
        cache: accountingCache,
        isOnline: false,
        pageSize: 1,
      }),
    )

    await waitFor(() => expect(result.current.documents.status).toBe('ready'))
    await act(async () => result.current.loadMoreDocuments())

    expect(result.current.documents.data?.items.map((item) => item.id)).toEqual([
      'acc_6001',
      'acc_6002',
    ])
    expect(result.current.documents.data).toMatchObject({
      next_cursor: null,
      has_more: false,
    })
    expect(result.current.documents.dataSource).toBe('cache')
    expect(result.current.documents.lastSyncedAt).toBe(lastSyncedAt)
    expect(accountingCache.listDocuments).toHaveBeenNthCalledWith(1, 'scope_1', { limit: 1 })
    expect(accountingCache.listDocuments).toHaveBeenNthCalledWith(2, 'scope_1', {
      limit: 1,
      cursor: 'offset_1',
    })
    expect(accountingApi.dashboard).not.toHaveBeenCalled()
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
    expect(accountingApi.getDocument).not.toHaveBeenCalled()
  })

  it('loads another online page without duplicates', async () => {
    const accountingApi = api()
    vi.mocked(accountingApi.listDocuments).mockImplementation(async (query) =>
      query?.cursor ? page([receipt]) : page([document], 'offset_1', true),
    )
    const { result } = renderHook(() =>
      useAccounting({ api: accountingApi, ownerId: 'scope_1', pageSize: 1 }),
    )
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))

    await act(async () => result.current.loadMoreDocuments())

    expect(result.current.documents.data?.items.map((item) => item.id)).toEqual([
      'acc_6001',
      'acc_6002',
    ])
    expect(result.current.documents.dataSource).toBe('remote')
    expect(accountingApi.listDocuments).toHaveBeenCalledTimes(2)
  })

  it('builds an offline report from cached pages and opens cached document details', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    vi.mocked(accountingCache.listDocuments).mockImplementation(async (_ownerId, query) =>
      query.cursor ? page([receipt]) : page([document], 'offset_1', true),
    )
    const { result } = renderHook(() =>
      useAccounting({
        api: accountingApi,
        ownerId: 'scope_1',
        cache: accountingCache,
        isOnline: false,
      }),
    )
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))

    await act(async () => result.current.refreshReport())
    await act(async () => result.current.openDocument(document.id))

    expect(result.current.report.data?.items.map((item) => item.id)).toEqual([
      'acc_6001',
      'acc_6002',
    ])
    expect(result.current.report.dataSource).toBe('cache')
    expect(result.current.report.lastSyncedAt).toBe(lastSyncedAt)
    expect(result.current.detail.data).toEqual(document)
    expect(result.current.detail.dataSource).toBe('cache')
    expect(accountingApi.dashboard).not.toHaveBeenCalled()
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
    expect(accountingApi.getDocument).not.toHaveBeenCalled()
  })

  it('reports missing offline documents instead of treating them as an empty page', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    vi.mocked(accountingCache.listDocuments).mockResolvedValue(page([]))
    vi.mocked(accountingCache.getSyncState).mockResolvedValue(null)
    const { result } = renderHook(() =>
      useAccounting({
        api: accountingApi,
        ownerId: 'scope_1',
        cache: accountingCache,
        isOnline: false,
      }),
    )

    await waitFor(() => expect(result.current.documents.status).toBe('error'))

    expect(result.current.documents.data).toBeNull()
    expect(result.current.documents.error).toBe('داده آفلاین حسابداری در دسترس نیست.')
    expect(result.current.documents.dataSource).toBeNull()
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
  })

  it('keeps a synchronized empty cached page distinct from missing offline data', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    vi.mocked(accountingCache.listDocuments).mockResolvedValue(page([]))
    const { result } = renderHook(() =>
      useAccounting({
        api: accountingApi,
        ownerId: 'scope_1',
        cache: accountingCache,
        isOnline: false,
      }),
    )

    await waitFor(() => expect(result.current.documents.status).toBe('ready'))

    expect(result.current.documents.data?.items).toEqual([])
    expect(result.current.documents.error).toBeNull()
    expect(result.current.documents.dataSource).toBe('cache')
    expect(result.current.documents.lastSyncedAt).toBe(lastSyncedAt)
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
  })

  it('keeps an empty online page as a successful remote result', async () => {
    const accountingApi = api()
    vi.mocked(accountingApi.listDocuments).mockResolvedValue(page([]))
    const { result } = renderHook(() => useAccounting({ api: accountingApi, ownerId: 'scope_1' }))

    await waitFor(() => expect(result.current.documents.status).toBe('ready'))

    expect(result.current.documents.data?.items).toEqual([])
    expect(result.current.documents.error).toBeNull()
    expect(result.current.documents.dataSource).toBe('remote')
  })

  it.each([403, 404])(
    'does not fall back to cached dashboard, documents, or report after a %s response',
    async (status) => {
      const accountingApi = api()
      const accountingCache = cache()
      const message = status === 403 ? 'forbidden' : 'not found'
      vi.mocked(accountingApi.dashboard).mockRejectedValue(new PlanetApiError(message, status))
      vi.mocked(accountingApi.listDocuments).mockRejectedValue(new PlanetApiError(message, status))
      const { result } = renderHook(() =>
        useAccounting({ api: accountingApi, ownerId: 'scope_1', cache: accountingCache }),
      )

      await waitFor(() => {
        expect(result.current.dashboard.status).toBe('error')
        expect(result.current.documents.status).toBe('error')
      })
      await act(async () => result.current.refreshReport())

      expect(result.current.dashboard.data).toBeNull()
      expect(result.current.documents.data).toBeNull()
      expect(result.current.report.data).toBeNull()
      expect(result.current.report.status).toBe('error')
      if (status === 403) {
        expect(result.current.dashboard.error).toBe('دسترسی به داده مالی مجاز نیست.')
        expect(result.current.documents.error).toBe('دسترسی به داده مالی مجاز نیست.')
        expect(result.current.report.error).toBe('دسترسی به داده مالی مجاز نیست.')
      } else {
        expect(result.current.dashboard.error).toBe(message)
        expect(result.current.documents.error).toBe(message)
        expect(result.current.report.error).toBe(message)
      }
      expect(accountingCache.getDashboard).not.toHaveBeenCalled()
      expect(accountingCache.listDocuments).not.toHaveBeenCalled()
      expect(accountingCache.getSyncState).not.toHaveBeenCalled()
    },
  )

  it('does not fall back to a cached document after a 404 response', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    vi.mocked(accountingApi.getDocument).mockRejectedValue(new PlanetApiError('not found', 404))
    const { result } = renderHook(() =>
      useAccounting({ api: accountingApi, ownerId: 'scope_1', cache: accountingCache }),
    )
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))

    await act(async () => result.current.openDocument('acc_missing'))

    expect(result.current.detail.status).toBe('error')
    expect(result.current.detail.id).toBe('acc_missing')
    expect(result.current.detail.data).toBeNull()
    expect(result.current.detail.error).toBe('not found')
    expect(accountingCache.getDocument).not.toHaveBeenCalled()
  })

  it('trims search and date filters and resets the cursor', async () => {
    const accountingApi = api()
    const { result } = renderHook(() =>
      useAccounting({ api: accountingApi, ownerId: 'scope_1', pageSize: 7 }),
    )
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))

    act(() =>
      result.current.setFilters({
        search: '  INV-2026  ',
        issued_from: ' 2026-11-01 ',
        issued_to: ' 2026-11-24 ',
        cursor: 'offset_9',
      }),
    )

    await waitFor(() =>
      expect(accountingApi.listDocuments).toHaveBeenLastCalledWith(
        {
          search: 'INV-2026',
          issued_from: '2026-11-01',
          issued_to: '2026-11-24',
          limit: 7,
        },
        expect.anything(),
      ),
    )
    expect(result.current.filters.cursor).toBeUndefined()

    act(() =>
      result.current.setFilters({
        search: '   ',
        issued_from: ' ',
        issued_to: '\t',
        cursor: 'offset_10',
      }),
    )
    await waitFor(() =>
      expect(accountingApi.listDocuments).toHaveBeenLastCalledWith(
        {
          search: undefined,
          issued_from: undefined,
          issued_to: undefined,
          limit: 7,
        },
        expect.anything(),
      ),
    )
    expect(result.current.filters.cursor).toBeUndefined()
  })

  it('rejects invalid or reversed date filters without exposing unfiltered financial data', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    const { result } = renderHook(() =>
      useAccounting({ api: accountingApi, ownerId: 'scope_1', cache: accountingCache }),
    )
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))
    vi.mocked(accountingApi.listDocuments).mockClear()
    vi.mocked(accountingCache.listDocuments).mockClear()

    act(() => result.current.setFilters({ issued_from: '2026-02-31' }))
    await waitFor(() => expect(result.current.documents.status).toBe('error'))
    expect(result.current.documents.error).toContain('بازه زمانی معتبر نیست')
    expect(result.current.documents.data).toBeNull()
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
    expect(accountingCache.listDocuments).not.toHaveBeenCalled()

    act(() => result.current.setFilters({ issued_from: '2026-11-25', issued_to: '2026-11-24' }))
    await waitFor(() => expect(result.current.documents.status).toBe('error'))
    expect(result.current.documents.error).toContain('بازه زمانی معتبر نیست')
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
    expect(accountingCache.listDocuments).not.toHaveBeenCalled()
  })

  it('aborts every prior request and clears financial data when the owner changes', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    const { result, rerender } = renderHook(
      ({ ownerId }) => useAccounting({ api: accountingApi, ownerId, cache: accountingCache }),
      { initialProps: { ownerId: 'scope_1' } },
    )
    await waitFor(() => {
      expect(result.current.dashboard.status).toBe('ready')
      expect(result.current.documents.status).toBe('ready')
    })
    await act(async () => result.current.refreshReport())
    await act(async () => result.current.openDocument(document.id))
    expect(result.current.report.status).toBe('ready')
    expect(result.current.detail.status).toBe('ready')

    const firstDashboardSignal = vi.mocked(accountingApi.dashboard).mock.calls[0]?.[0]?.signal
    const firstDocumentsSignal = vi.mocked(accountingApi.listDocuments).mock.calls[0]?.[1]?.signal
    const firstReportSignal = vi.mocked(accountingApi.listDocuments).mock.calls[1]?.[1]?.signal
    const firstDetailSignal = vi.mocked(accountingApi.getDocument).mock.calls[0]?.[1]?.signal

    const nextDashboardData = {
      ...dashboard,
      current_balance: { amount: 999, currency: 'IRR' as const },
    }
    const nextDocument = {
      ...document,
      id: 'acc_owner_2',
      code: 'INV-OWNER-2',
      total: { amount: 999, currency: 'IRR' as const },
    }
    const nextDashboard = deferred<AccountingDashboard>()
    const nextDocuments = deferred<AccountingDocumentPage>()
    const nextDetail = deferred<AccountingDocument>()
    let nextDashboardSignal: AbortSignal | undefined
    let nextDocumentsSignal: AbortSignal | undefined
    let nextDetailSignal: AbortSignal | undefined
    vi.mocked(accountingApi.dashboard).mockImplementation((context) => {
      nextDashboardSignal = context?.signal
      return nextDashboard.promise
    })
    vi.mocked(accountingApi.listDocuments).mockImplementation((_query, context) => {
      nextDocumentsSignal = context?.signal
      return nextDocuments.promise
    })
    vi.mocked(accountingApi.getDocument).mockImplementation((_id, context) => {
      nextDetailSignal = context?.signal
      return nextDetail.promise
    })

    rerender({ ownerId: 'scope_2' })

    expect(firstDashboardSignal?.aborted).toBe(true)
    expect(firstDocumentsSignal?.aborted).toBe(true)
    expect(firstReportSignal?.aborted).toBe(true)
    expect(firstDetailSignal?.aborted).toBe(true)
    expect(result.current.dashboard.data).toBeNull()
    expect(result.current.documents.data).toBeNull()
    expect(result.current.report.data).toBeNull()
    expect(result.current.detail.data).toBeNull()
    expect(result.current.dashboard.status).toBe('loading')
    expect(result.current.documents.status).toBe('loading')
    expect(result.current.report.status).toBe('idle')
    expect(result.current.detail.status).toBe('idle')

    act(() => {
      void result.current.refreshReport()
      void result.current.openDocument(nextDocument.id)
    })
    expect(result.current.report.status).toBe('loading')
    expect(result.current.detail.status).toBe('loading')

    await act(async () => {
      nextDashboard.resolve(nextDashboardData)
      nextDocuments.resolve(page([nextDocument]))
      nextDetail.resolve(nextDocument)
    })
    await waitFor(() => {
      expect(result.current.dashboard.status).toBe('ready')
      expect(result.current.documents.status).toBe('ready')
      expect(result.current.report.status).toBe('ready')
      expect(result.current.detail.status).toBe('ready')
    })

    expect(result.current.dashboard.data).toEqual(nextDashboardData)
    expect(result.current.documents.data?.items).toEqual([nextDocument])
    expect(result.current.report.data?.items).toEqual([nextDocument])
    expect(result.current.detail.data).toEqual(nextDocument)
    expect(nextDashboardSignal?.aborted).toBe(false)
    expect(nextDocumentsSignal?.aborted).toBe(false)
    expect(nextDetailSignal?.aborted).toBe(false)
    expect(accountingCache.saveDashboard).toHaveBeenLastCalledWith('scope_2', nextDashboardData)
    expect(accountingCache.saveDocuments).toHaveBeenLastCalledWith('scope_2', [nextDocument])
  })

  it('aborts an in-flight detail and keeps it closed after the request resolves', async () => {
    const accountingApi = api()
    const pendingDetail = deferred<AccountingDocument>()
    let detailSignal: AbortSignal | undefined
    vi.mocked(accountingApi.getDocument).mockImplementationOnce((_id, context) => {
      detailSignal = context?.signal
      return pendingDetail.promise
    })
    const { result } = renderHook(() => useAccounting({ api: accountingApi, ownerId: 'scope_1' }))
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))

    let request!: Promise<void>
    act(() => {
      request = result.current.openDocument(document.id)
    })
    await waitFor(() => expect(result.current.detail.status).toBe('loading'))
    expect(result.current.detail.id).toBe(document.id)

    act(() => result.current.closeDetail())

    expect(detailSignal?.aborted).toBe(true)
    expect(result.current.detail.status).toBe('idle')
    expect(result.current.detail.id).toBeNull()
    expect(result.current.detail.data).toBeNull()

    await act(async () => {
      pendingDetail.resolve(document)
      await request
    })

    expect(result.current.detail.status).toBe('idle')
    expect(result.current.detail.id).toBeNull()
    expect(result.current.detail.data).toBeNull()
  })

  it('aggregates unique documents across report pages and caches only a complete report', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    const { result } = renderHook(() =>
      useAccounting({ api: accountingApi, ownerId: 'scope_1', cache: accountingCache }),
    )
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))

    act(() =>
      result.current.setFilters({
        search: '  INV  ',
        status: 'confirmed',
        issued_from: ' 2026-11-01 ',
        issued_to: ' 2026-11-24 ',
        cursor: 'stale_cursor',
      }),
    )
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))
    vi.mocked(accountingApi.listDocuments).mockClear()
    vi.mocked(accountingCache.saveDocuments).mockClear()
    vi.mocked(accountingApi.listDocuments).mockImplementation(async (query) =>
      query?.cursor === 'offset_2'
        ? page([receipt, payment, document])
        : page([document], 'offset_2', true),
    )

    await act(async () => result.current.refreshReport())

    expect(result.current.report.status).toBe('ready')
    expect(result.current.report.dataSource).toBe('remote')
    expect(result.current.report.data?.items.map((item) => item.id)).toEqual([
      'acc_6001',
      'acc_6002',
      'acc_6003',
    ])
    expect(result.current.report.data?.rows).toEqual([
      { type: 'invoice', count: 1, total: { amount: 12989000, currency: 'IRR' } },
      { type: 'receipt', count: 1, total: { amount: 2500000, currency: 'IRR' } },
      { type: 'payment', count: 1, total: { amount: 750000, currency: 'IRR' } },
      { type: 'journal', count: 0, total: { amount: 0, currency: 'IRR' } },
    ])
    expect(result.current.report.data?.generatedAt).toEqual(expect.any(String))
    const context = { accessToken: undefined, signal: expect.any(AbortSignal) }
    expect(accountingApi.listDocuments).toHaveBeenNthCalledWith(
      1,
      {
        search: 'INV',
        status: 'confirmed',
        issued_from: '2026-11-01',
        issued_to: '2026-11-24',
        limit: 100,
        cursor: undefined,
      },
      context,
    )
    expect(accountingApi.listDocuments).toHaveBeenNthCalledWith(
      2,
      {
        search: 'INV',
        status: 'confirmed',
        issued_from: '2026-11-01',
        issued_to: '2026-11-24',
        limit: 100,
        cursor: 'offset_2',
      },
      context,
    )
    expect(accountingCache.saveDocuments).toHaveBeenCalledTimes(1)
    expect(accountingCache.saveDocuments).toHaveBeenCalledWith('scope_1', [
      document,
      receipt,
      payment,
    ])
  })

  it('shows an error instead of a partial report when pagination exceeds the safety cap', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    const pages = Array.from({ length: 11 }, (_, index): AccountingDocumentPage => ({
      items: [
        {
          ...document,
          id: `acc_cap_${index + 1}`,
          code: `INV-CAP-${index + 1}`,
          total: { amount: 1000 * (index + 1), currency: 'IRR' },
        },
      ],
      next_cursor: `page_${index + 2}`,
      has_more: true,
    }))
    const readPage = (query?: AccountingDocumentListQuery) => {
      const pageIndex = query?.cursor ? Number(query.cursor.replace('page_', '')) - 1 : 0
      return pages[pageIndex]!
    }
    const { result } = renderHook(() =>
      useAccounting({ api: accountingApi, ownerId: 'scope_1', cache: accountingCache }),
    )
    await waitFor(() => expect(result.current.documents.status).toBe('ready'))
    vi.mocked(accountingApi.listDocuments).mockClear()
    vi.mocked(accountingCache.listDocuments).mockClear()
    vi.mocked(accountingCache.saveDocuments).mockClear()
    vi.mocked(accountingApi.listDocuments).mockImplementation(async (query) => readPage(query))
    vi.mocked(accountingCache.listDocuments).mockImplementation(async (_ownerId, query) =>
      readPage(query),
    )

    await act(async () => result.current.refreshReport())

    expect(result.current.report.status).toBe('error')
    expect(result.current.report.data).toBeNull()
    expect(result.current.report.error).toBe('گزارش کامل نیست؛ بازه یا فیلتر را محدودتر کنید.')
    expect(accountingApi.listDocuments).toHaveBeenCalledTimes(10)
    expect(accountingCache.listDocuments).not.toHaveBeenCalled()
    expect(accountingCache.saveDocuments).not.toHaveBeenCalled()
    expect(accountingApi.listDocuments).not.toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'page_11' }),
      expect.anything(),
    )
  })
})
