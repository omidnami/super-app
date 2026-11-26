import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Order, Product, ShopDashboard } from '@superapp/chat-contracts'
import { PlanetApiError, type ShopApi } from '@superapp/api-client'
import { useShop, type ShopCache } from '@superapp/shop'

const dashboard: ShopDashboard = {
  today_sales: { amount: 1000, currency: 'IRR' },
  today_orders: 1,
  pending_orders: 0,
  low_stock_products: 1,
  updated_at: '2026-11-26T10:00:00.000Z',
}
const order: Order = {
  id: 'ord_1',
  code: 'ORD-1',
  customer_name: 'مشتری',
  status: 'paid',
  payment_status: 'paid',
  total: { amount: 1000, currency: 'IRR' },
  created_at: '2026-11-26T09:00:00.000Z',
  updated_at: '2026-11-26T10:00:00.000Z',
  deleted_at: null,
  lines: [],
}
const product: Product = {
  id: 'prd_1',
  title: 'محصول',
  slug: 'product',
  status: 'active',
  price: { amount: 1000, currency: 'IRR' },
  inventory_quantity: 2,
  variants: [],
  updated_at: '2026-11-26T10:00:00.000Z',
  deleted_at: null,
}
const secondOrder: Order = {
  ...order,
  id: 'ord_2',
  code: 'ORD-2',
  updated_at: '2026-11-26T09:30:00.000Z',
}
const secondProduct: Product = {
  ...product,
  id: 'prd_2',
  title: 'محصول دوم',
  slug: 'product-2',
  updated_at: '2026-11-26T09:30:00.000Z',
}

function api(): ShopApi {
  return {
    dashboard: vi.fn(async () => dashboard),
    listOrders: vi.fn(async () => ({ items: [order], next_cursor: null, has_more: false })),
    getOrder: vi.fn(async () => order),
    listProducts: vi.fn(async () => ({ items: [product], next_cursor: null, has_more: false })),
    getProduct: vi.fn(async () => product),
  }
}

function cache(): ShopCache {
  return {
    getDashboard: vi.fn(async () => dashboard),
    saveDashboard: vi.fn(async () => undefined),
    listOrders: vi.fn(async () => ({ items: [order], next_cursor: null, has_more: false })),
    saveOrders: vi.fn(async () => undefined),
    getOrder: vi.fn(async () => order),
    listProducts: vi.fn(async () => ({ items: [product], next_cursor: null, has_more: false })),
    saveProducts: vi.fn(async () => undefined),
    getProduct: vi.fn(async () => product),
    getSyncState: vi.fn(async () => ({ last_synced_at: '2026-11-26T09:59:00.000Z' })),
    clear: vi.fn(async () => undefined),
  }
}

describe('useShop', () => {
  it('does not issue shop requests when read permission is absent', async () => {
    const shopApi = api()
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', enabled: false }),
    )

    expect(result.current.dashboard.status).toBe('idle')
    expect(result.current.orders.status).toBe('idle')
    expect(result.current.products.status).toBe('idle')
    expect(shopApi.dashboard).not.toHaveBeenCalled()
    expect(shopApi.listOrders).not.toHaveBeenCalled()
    expect(shopApi.listProducts).not.toHaveBeenCalled()
  })

  it('loads online dashboard, orders and products and writes the mobile cache', async () => {
    const shopApi = api()
    const shopCache = cache()
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', cache: shopCache }),
    )

    await waitFor(() => expect(result.current.products.status).toBe('ready'))
    expect(result.current.dashboard.data).toEqual(dashboard)
    expect(result.current.orders.data?.items).toEqual([order])
    expect(result.current.products.data?.items).toEqual([product])
    expect(result.current.dashboard.dataSource).toBe('remote')
    expect(shopCache.saveDashboard).toHaveBeenCalled()
    expect(shopCache.saveOrders).toHaveBeenCalled()
    expect(shopCache.saveProducts).toHaveBeenCalled()
  })

  it('uses cached data and the last sync time while offline', async () => {
    const shopApi = api()
    const shopCache = cache()
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', cache: shopCache, isOnline: false }),
    )

    await waitFor(() => expect(result.current.products.status).toBe('ready'))
    expect(result.current.orders.dataSource).toBe('cache')
    expect(result.current.orders.lastSyncedAt).toBe('2026-11-26T09:59:00.000Z')
    expect(shopApi.listOrders).not.toHaveBeenCalled()
    expect(shopApi.dashboard).not.toHaveBeenCalled()
  })

  it('keeps an empty online result distinct from an error', async () => {
    const shopApi = api()
    vi.mocked(shopApi.listOrders).mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
    })
    const { result } = renderHook(() => useShop({ api: shopApi, ownerId: 'scope_1' }))

    await waitFor(() => expect(result.current.orders.status).toBe('ready'))
    expect(result.current.orders.data?.items).toEqual([])
    expect(result.current.orders.error).toBeNull()
  })

  it('does not expose cached business data after a 403 response', async () => {
    const shopApi = api()
    vi.mocked(shopApi.listOrders).mockRejectedValue(new PlanetApiError('forbidden', 403))
    const shopCache = cache()
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', cache: shopCache }),
    )

    await waitFor(() => expect(result.current.orders.status).toBe('error'))
    expect(result.current.orders.data).toBeNull()
    expect(result.current.orders.error).toContain('مجاز نیست')
    expect(shopCache.listOrders).not.toHaveBeenCalled()
  })

  it('paginates cached orders and products while offline without API requests', async () => {
    const shopApi = api()
    const shopCache = cache()
    vi.mocked(shopCache.listOrders).mockImplementation(async (_ownerId, query) =>
      query.cursor
        ? { items: [secondOrder], next_cursor: null, has_more: false }
        : { items: [order], next_cursor: 'offset_1', has_more: true },
    )
    vi.mocked(shopCache.listProducts).mockImplementation(async (_ownerId, query) =>
      query.cursor
        ? { items: [secondProduct], next_cursor: null, has_more: false }
        : { items: [product], next_cursor: 'offset_1', has_more: true },
    )
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', cache: shopCache, isOnline: false, pageSize: 1 }),
    )

    await waitFor(() => expect(result.current.products.status).toBe('ready'))
    await act(async () => result.current.loadMoreOrders())
    await act(async () => result.current.loadMoreProducts())

    expect(result.current.orders.data?.items.map((item) => item.id)).toEqual(['ord_1', 'ord_2'])
    expect(result.current.products.data?.items.map((item) => item.id)).toEqual(['prd_1', 'prd_2'])
    expect(result.current.orders.dataSource).toBe('cache')
    expect(shopApi.listOrders).not.toHaveBeenCalled()
    expect(shopApi.listProducts).not.toHaveBeenCalled()
  })

  it('distinguishes an empty cached result from missing offline data', async () => {
    const shopApi = api()
    const shopCache = cache()
    vi.mocked(shopCache.listOrders).mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
    })
    vi.mocked(shopCache.getSyncState).mockResolvedValue(null)
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', cache: shopCache, isOnline: false }),
    )

    await waitFor(() => expect(result.current.orders.status).toBe('error'))
    expect(result.current.orders.data).toBeNull()
    expect(result.current.orders.error).toContain('آفلاین')
  })

  it('keeps a synchronized empty cached result as an empty stale page', async () => {
    const shopApi = api()
    const shopCache = cache()
    vi.mocked(shopCache.listOrders).mockResolvedValue({
      items: [],
      next_cursor: null,
      has_more: false,
    })
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', cache: shopCache, isOnline: false }),
    )

    await waitFor(() => expect(result.current.orders.status).toBe('ready'))
    expect(result.current.orders.data?.items).toEqual([])
    expect(result.current.orders.dataSource).toBe('cache')
    expect(result.current.orders.lastSyncedAt).toBe('2026-11-26T09:59:00.000Z')
  })

  it('does not fall back to cached details after a 404 response', async () => {
    const shopApi = api()
    const shopCache = cache()
    vi.mocked(shopApi.getOrder).mockRejectedValue(new PlanetApiError('not found', 404))
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', cache: shopCache }),
    )
    await waitFor(() => expect(result.current.orders.status).toBe('ready'))

    await act(async () => result.current.openOrder('ord_missing'))

    expect(result.current.detail.status).toBe('error')
    expect(result.current.detail.data).toBeNull()
    expect(shopCache.getOrder).not.toHaveBeenCalled()
  })

  it('trims search and resets the cursor when filters change', async () => {
    const shopApi = api()
    const { result } = renderHook(() => useShop({ api: shopApi, ownerId: 'scope_1' }))
    await waitFor(() => expect(result.current.orders.status).toBe('ready'))

    act(() =>
      result.current.setOrderFilters({ search: '  ORD  ', status: 'paid', cursor: 'offset_9' }),
    )

    await waitFor(() =>
      expect(shopApi.listOrders).toHaveBeenLastCalledWith(
        { search: 'ORD', status: 'paid', limit: 30 },
        expect.anything(),
      ),
    )
    expect(result.current.orderFilters.cursor).toBeUndefined()
  })

  it('aborts requests and clears business data when the owner scope changes', async () => {
    const shopApi = api()
    let resolveDashboard!: (value: ShopDashboard) => void
    let firstSignal: AbortSignal | undefined
    vi.mocked(shopApi.dashboard).mockImplementationOnce(
      (context) =>
        new Promise<ShopDashboard>((resolve) => {
          resolveDashboard = resolve
          firstSignal = context?.signal
        }),
    )
    const { result, rerender } = renderHook(({ ownerId }) => useShop({ api: shopApi, ownerId }), {
      initialProps: { ownerId: 'scope_1' },
    })
    await waitFor(() => expect(shopApi.dashboard).toHaveBeenCalledTimes(1))

    rerender({ ownerId: 'scope_2' })

    await waitFor(() => expect(result.current.dashboard.status).toBe('ready'))
    expect(firstSignal?.aborted).toBe(true)
    expect(result.current.dashboard.data).toEqual(dashboard)
    expect(shopApi.dashboard).toHaveBeenCalledTimes(2)
    resolveDashboard(dashboard)
  })

  it('does not reopen an in-flight detail after it is closed', async () => {
    const shopApi = api()
    let resolveOrder!: (value: Order) => void
    let detailSignal: AbortSignal | undefined
    vi.mocked(shopApi.getOrder).mockImplementationOnce(
      (_id, context) =>
        new Promise<Order>((resolve) => {
          resolveOrder = resolve
          detailSignal = context?.signal
        }),
    )
    const { result } = renderHook(() => useShop({ api: shopApi, ownerId: 'scope_1' }))
    await waitFor(() => expect(result.current.orders.status).toBe('ready'))

    act(() => {
      void result.current.openOrder('ord_1')
    })
    await waitFor(() => expect(result.current.detail.status).toBe('loading'))
    act(() => result.current.closeDetail())
    await act(async () => resolveOrder(order))

    expect(detailSignal?.aborted).toBe(true)
    expect(result.current.detail.kind).toBeNull()
    expect(result.current.detail.data).toBeNull()
  })

  it('opens online and offline details without write operations', async () => {
    const shopApi = api()
    const shopCache = cache()
    const { result } = renderHook(() =>
      useShop({ api: shopApi, ownerId: 'scope_1', cache: shopCache }),
    )
    await waitFor(() => expect(result.current.orders.status).toBe('ready'))

    await act(async () => result.current.openOrder('ord_1'))
    expect(result.current.detail.data).toEqual(order)
    expect(result.current.detail.kind).toBe('order')
    act(() => result.current.closeDetail())

    vi.mocked(shopApi.getProduct).mockRejectedValue(new Error('offline'))
    await act(async () => result.current.openProduct('prd_1'))
    expect(result.current.detail.data).toEqual(product)
    expect(result.current.detail.dataSource).toBe('cache')
  })
})

describe('shop API', () => {
  it('filters and paginates mock orders and products', async () => {
    const { createMockShopApi } = await import('@superapp/api-client')
    const shopApi = createMockShopApi()
    const orders = await shopApi.listOrders({ search: 'TK-1008', status: 'processing', limit: 1 })
    expect(orders.items.map((item) => item.id)).toEqual(['ord_4001'])
    const products = await shopApi.listProducts({ search: 'jbl', status: 'active', limit: 1 })
    expect(products.items.map((item) => item.id)).toEqual(['prd_5002'])
  })

  it('advances mock cursors for order and product pages', async () => {
    const { createMockShopApi } = await import('@superapp/api-client')
    const shopApi = createMockShopApi()

    const firstOrders = await shopApi.listOrders({ limit: 1 })
    const secondOrders = await shopApi.listOrders({ limit: 1, cursor: firstOrders.next_cursor! })
    const firstProducts = await shopApi.listProducts({ limit: 1 })
    const secondProducts = await shopApi.listProducts({
      limit: 1,
      cursor: firstProducts.next_cursor!,
    })

    expect(firstOrders.items.map((item) => item.id)).toEqual(['ord_4001'])
    expect(secondOrders.items.map((item) => item.id)).toEqual(['ord_4002'])
    expect(firstProducts.items.map((item) => item.id)).toEqual(['prd_5001'])
    expect(secondProducts.items.map((item) => item.id)).toEqual(['prd_5002'])
    expect(secondOrders.has_more).toBe(false)
    expect(secondProducts.has_more).toBe(false)
  })

  it('uses authenticated GET endpoints and has no write methods', async () => {
    const { createPlanetShopApi } = await import('@superapp/api-client')
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname
      const data = path.endsWith('/dashboard')
        ? dashboard
        : path.endsWith('/orders')
          ? { items: [order], next_cursor: null, has_more: false }
          : path.endsWith('/products')
            ? { items: [product], next_cursor: null, has_more: false }
            : path.includes('/orders/')
              ? order
              : product
      return new Response(JSON.stringify({ status: true, data }), { status: 200 })
    })
    const shopApi = createPlanetShopApi({
      baseUrl: 'https://planet.example',
      getAccessToken: () => 'account_token',
      fetch: fetchMock,
    })

    await shopApi.dashboard()
    await shopApi.listOrders({ search: 'ORD', limit: 10 })
    await shopApi.getOrder('ord/1')
    await shopApi.listProducts({ status: 'active' })
    await shopApi.getProduct('prd_1')

    expect(fetchMock).toHaveBeenCalledTimes(5)
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)))
    expect(urls.map((url) => url.pathname)).toEqual([
      '/api/v1/account/shop/dashboard',
      '/api/v1/account/shop/orders',
      '/api/v1/account/shop/orders/ord%2F1',
      '/api/v1/account/shop/products',
      '/api/v1/account/shop/products/prd_1',
    ])
    expect(urls[1]?.searchParams.get('search')).toBe('ORD')
    expect(urls[3]?.searchParams.get('status')).toBe('active')
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.method).toBe('GET')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer account_token')
    }
    expect(shopApi).not.toHaveProperty('createOrder')
    expect(shopApi).not.toHaveProperty('updateProduct')
  })

  it('rejects malformed commerce payloads instead of trusting their TypeScript shape', async () => {
    const { createPlanetShopApi } = await import('@superapp/api-client')
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ status: true, data: { ...order, status: 'unknown' } }), {
          status: 200,
        }),
    )
    const shopApi = createPlanetShopApi({
      baseUrl: 'https://planet.example',
      fetch: fetchMock,
    })

    await expect(shopApi.getOrder('ord_1')).rejects.toMatchObject({
      name: 'PlanetApiError',
      status: 200,
    })
  })

  it('honors aborted signals before issuing mock or Planet requests', async () => {
    const { createMockShopApi, createPlanetShopApi } = await import('@superapp/api-client')
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.fn<typeof fetch>()

    await expect(
      createMockShopApi().dashboard({ signal: controller.signal }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    })
    await expect(
      createPlanetShopApi({ baseUrl: 'https://planet.example', fetch: fetchMock }).dashboard({
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
