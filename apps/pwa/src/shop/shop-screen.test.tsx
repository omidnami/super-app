import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Order, OrderPage, Product, ShopDashboard } from '@superapp/chat-contracts'
import type { ShopApi } from '@superapp/api-client'
import type { ShopCache } from '@superapp/shop'
import { ShopScreen } from '@superapp/ui/web'
import { AppThemeProvider } from '../theme/AppThemeProvider'

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
const secondOrder: Order = {
  ...order,
  id: 'ord_2',
  code: 'ORD-2',
  updated_at: '2026-11-26T09:30:00.000Z',
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

function renderShop(shopApi: ShopApi, shopCache: ShopCache, canRead = true) {
  return render(
    <AppThemeProvider>
      <ShopScreen
        api={shopApi}
        ownerId="scope_1"
        cache={shopCache}
        isOnline={false}
        canRead={canRead}
      />
    </AppThemeProvider>,
  )
}

describe('ShopScreen', () => {
  it('shows stale data, the last sync time and the offline cache banner', async () => {
    const shopApi = api()
    renderShop(shopApi, cache())

    expect(await screen.findByText('فروش امروز')).toBeInTheDocument()
    expect(screen.getByText('داده قدیمی')).toBeInTheDocument()
    expect(screen.getByText(/آخرین سینک:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /آفلاین هستید/ })).toBeInTheDocument()
    expect(shopApi.dashboard).not.toHaveBeenCalled()
  })

  it('loads another offline page from the repository cache', async () => {
    const shopApi = api()
    const shopCache = cache()
    vi.mocked(shopCache.listOrders).mockImplementation(
      async (_ownerId, query): Promise<OrderPage> =>
        query.cursor
          ? { items: [secondOrder], next_cursor: null, has_more: false }
          : { items: [order], next_cursor: 'offset_1', has_more: true },
    )
    renderShop(shopApi, shopCache)

    fireEvent.click(await screen.findByRole('tab', { name: 'سفارش‌ها' }))
    fireEvent.click(await screen.findByRole('button', { name: 'نمایش بیشتر' }))

    expect(await screen.findByRole('button', { name: 'جزئیات سفارش ORD-2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'جزئیات سفارش ORD-1' })).toBeInTheDocument()
    expect(shopApi.listOrders).not.toHaveBeenCalled()
  })

  it('blocks the shop UI and all requests without shop.read', async () => {
    const shopApi = api()
    renderShop(shopApi, cache(), false)

    expect(await screen.findByText('دسترسی مجاز نیست')).toBeInTheDocument()
    expect(shopApi.dashboard).not.toHaveBeenCalled()
    expect(shopApi.listOrders).not.toHaveBeenCalled()
    expect(shopApi.listProducts).not.toHaveBeenCalled()
  })
})
