import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type {
  Order,
  OrderPage,
  Product,
  ProductPage,
  ShopDashboard,
} from '@superapp/chat-contracts'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import type { LocalDatabase } from '@superapp/local-db'

const mockSaveDashboard = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockSaveOrders = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockSaveProducts = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockClear = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockListOrders = jest.fn<(...args: unknown[]) => Promise<OrderPage>>()
const mockListProducts = jest.fn<(...args: unknown[]) => Promise<ProductPage>>()

const mockDatabase = {
  exec: jest.fn(async () => undefined),
  all: jest.fn(async () => []),
  get: jest.fn(async () => null),
  run: jest.fn(async () => undefined),
  transaction: async <T>(task: (database: LocalDatabase) => Promise<T>) => task(mockDatabase),
  close: jest.fn(async () => undefined),
} as unknown as LocalDatabase

let mockOpenDatabase: () => Promise<LocalDatabase> = async () => mockDatabase

jest.mock('@superapp/local-db', () => ({
  createExpoDatabaseFactory: () => ({ open: () => mockOpenDatabase() }),
  ShopRepository: class {
    saveDashboard(...args: unknown[]) {
      return mockSaveDashboard(...args)
    }

    saveOrders(...args: unknown[]) {
      return mockSaveOrders(...args)
    }

    saveProducts(...args: unknown[]) {
      return mockSaveProducts(...args)
    }

    clear(...args: unknown[]) {
      return mockClear(...args)
    }
  },
  OrderRepository: class {
    list(...args: unknown[]) {
      return mockListOrders(...args)
    }
  },
  ProductRepository: class {
    list(...args: unknown[]) {
      return mockListProducts(...args)
    }
  },
}))

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

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  mockSaveDashboard.mockResolvedValue(undefined)
  mockSaveOrders.mockResolvedValue(undefined)
  mockSaveProducts.mockResolvedValue(undefined)
  mockClear.mockResolvedValue(undefined)
  mockListOrders.mockResolvedValue({ items: [], next_cursor: null, has_more: false })
  mockListProducts.mockResolvedValue({ items: [], next_cursor: null, has_more: false })
  mockOpenDatabase = async () => mockDatabase
})

describe('mobile shop cache lifetime', () => {
  it('ignores saves after the scope has been cleared', async () => {
    const { createMobileShopCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_1', 'prj_12')
    const cache = createMobileShopCache(scope)

    await cache.clear(scope)
    await cache.saveDashboard(scope, dashboard)
    await cache.saveOrders(scope, [order])
    await cache.saveProducts(scope, [product])

    expect(mockSaveDashboard).not.toHaveBeenCalled()
    expect(mockSaveOrders).not.toHaveBeenCalled()
    expect(mockSaveProducts).not.toHaveBeenCalled()
    expect(mockClear).toHaveBeenCalledWith(scope)
  })

  it('does not let an in-flight save repopulate a cleared scope', async () => {
    let resolveDatabase!: (database: LocalDatabase) => void
    mockOpenDatabase = () =>
      new Promise<LocalDatabase>((resolve) => {
        resolveDatabase = resolve
      })
    const { createMobileShopCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_2', 'prj_12')
    const cache = createMobileShopCache(scope)

    const saving = cache.saveOrders(scope, [order])
    const clearing = cache.clear(scope)
    resolveDatabase(mockDatabase)
    await Promise.all([saving, clearing])

    expect(mockSaveOrders).not.toHaveBeenCalled()
    expect(mockClear).toHaveBeenCalledWith(scope)
  })

  it('keeps the cache inactive when logout cleanup fails', async () => {
    mockClear.mockRejectedValueOnce(new Error('disk failure'))
    const { clearShopCacheForSession, createMobileShopCache } =
      jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_4', 'prj_12')
    const session = {
      accessToken: 'account_token',
      refreshToken: 'refresh_token',
      expiresAt: 1,
      service: 'account' as const,
      context: { operatorId: 'op_4', projectId: 'prj_12', permissions: ['shop.read'] },
    }
    const cache = createMobileShopCache(scope)

    await expect(clearShopCacheForSession(session)).rejects.toThrow('disk failure')
    await cache.saveOrders(scope, [order])

    expect(mockSaveOrders).not.toHaveBeenCalled()
    expect(createMobileShopCache(scope)).toBe(cache)
  })

  it('rejects reads and writes for a different owner scope', async () => {
    const { createMobileShopCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_3', 'prj_12')
    const cache = createMobileShopCache(scope)

    await expect(cache.listOrders('other_scope', {})).rejects.toThrow('Shop cache scope')
    await expect(cache.saveProducts(scope, [product])).resolves.toBeUndefined()
    expect(mockListOrders).not.toHaveBeenCalled()
    expect(mockSaveProducts).toHaveBeenCalled()
  })
})
