import type {
  Order,
  OrderListQuery,
  OrderPage,
  Product,
  ProductListQuery,
  ProductPage,
  ShopDashboard,
} from '@superapp/chat-contracts'
import orderFixtures from '../mocks/fixtures/orders.json'
import productFixtures from '../mocks/fixtures/products.json'
import dashboardFixture from '../mocks/fixtures/shop-dashboard.json'
import { PlanetApiError } from './media'

export interface ShopRequestContext {
  accessToken?: string
  signal?: AbortSignal
}

export interface ShopApi {
  dashboard(context?: ShopRequestContext): Promise<ShopDashboard>
  listOrders(query?: OrderListQuery, context?: ShopRequestContext): Promise<OrderPage>
  getOrder(id: string, context?: ShopRequestContext): Promise<Order | null>
  listProducts(query?: ProductListQuery, context?: ShopRequestContext): Promise<ProductPage>
  getProduct(id: string, context?: ShopRequestContext): Promise<Product | null>
}

export interface PlanetShopApiOptions {
  baseUrl: string
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  fetch?: typeof fetch
}

const orders = orderFixtures as unknown as Order[]
const products = productFixtures as unknown as Product[]
const dashboard = dashboardFixture as ShopDashboard
const ORDER_STATUSES: Order['status'][] = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]
const PAYMENT_STATUSES: Order['payment_status'][] = ['pending', 'paid', 'failed', 'refunded']
const PRODUCT_STATUSES: Product['status'][] = ['active', 'draft', 'archived']

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  if (signal.reason !== undefined) throw signal.reason
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  throw error
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function offsetFromCursor(cursor?: string) {
  const match = /^offset_(\d+)$/.exec(cursor || '')
  return match ? Number(match[1]) : 0
}

function includesSearch(value: string, search: string) {
  return value.toLocaleLowerCase('fa').includes(search.toLocaleLowerCase('fa'))
}

function paginate<T>(items: T[], query: { cursor?: string; limit?: number }) {
  const requestedLimit = Number(query.limit)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 30
  const offset = offsetFromCursor(query.cursor)
  const pageItems = items.slice(offset, offset + limit)
  const nextOffset = offset + pageItems.length
  return {
    items: pageItems,
    next_cursor: nextOffset < items.length ? `offset_${nextOffset}` : null,
    has_more: nextOffset < items.length,
  }
}

export function createMockShopApi(): ShopApi {
  return {
    async dashboard(context) {
      throwIfAborted(context?.signal)
      return clone(dashboard)
    },
    async listOrders(query = {}, context) {
      throwIfAborted(context?.signal)
      const search = query.search?.trim() || ''
      const filtered = orders
        .filter((order) => !order.deleted_at)
        .filter((order) => !query.status || order.status === query.status)
        .filter(
          (order) =>
            !search ||
            includesSearch(order.code, search) ||
            includesSearch(order.customer_name, search),
        )
        .sort(
          (first, second) =>
            Date.parse(second.updated_at) - Date.parse(first.updated_at) ||
            second.id.localeCompare(first.id),
        )
      return paginate(filtered, query)
    },
    async getOrder(id, context) {
      throwIfAborted(context?.signal)
      const order = orders.find((item) => item.id === id && !item.deleted_at)
      return order ? clone(order) : null
    },
    async listProducts(query = {}, context) {
      throwIfAborted(context?.signal)
      const search = query.search?.trim() || ''
      const filtered = products
        .filter((product) => !product.deleted_at)
        .filter((product) => !query.status || product.status === query.status)
        .filter(
          (product) =>
            !search ||
            includesSearch(product.title, search) ||
            includesSearch(product.slug, search),
        )
        .sort(
          (first, second) =>
            Date.parse(second.updated_at) - Date.parse(first.updated_at) ||
            second.id.localeCompare(first.id),
        )
      return paginate(filtered, query)
    },
    async getProduct(id, context) {
      throwIfAborted(context?.signal)
      const product = products.find((item) => item.id === id && !item.deleted_at)
      return product ? clone(product) : null
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isMoney(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.currency === 'IRR'
  )
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCount(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isNullableDateTime(value: unknown): value is string | null {
  return value === null || isDateTime(value)
}

function isOrder(value: unknown): value is Order {
  if (!isRecord(value) || !isMoney(value.total) || !Array.isArray(value.lines)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.customer_name === 'string' &&
    ORDER_STATUSES.includes(value.status as Order['status']) &&
    PAYMENT_STATUSES.includes(value.payment_status as Order['payment_status']) &&
    isDateTime(value.created_at) &&
    isDateTime(value.updated_at) &&
    isNullableDateTime(value.deleted_at) &&
    value.lines.every(
      (line) =>
        isRecord(line) &&
        typeof line.product_id === 'string' &&
        typeof line.title === 'string' &&
        typeof line.variant_title === 'string' &&
        isCount(line.quantity) &&
        isMoney(line.unit_price),
    )
  )
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value) || !isMoney(value.price) || !Array.isArray(value.variants)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.slug === 'string' &&
    PRODUCT_STATUSES.includes(value.status as Product['status']) &&
    isFiniteNumber(value.inventory_quantity) &&
    isDateTime(value.updated_at) &&
    isNullableDateTime(value.deleted_at) &&
    value.variants.every(
      (variant) =>
        isRecord(variant) &&
        typeof variant.id === 'string' &&
        typeof variant.title === 'string' &&
        typeof variant.sku === 'string' &&
        isMoney(variant.price) &&
        isFiniteNumber(variant.inventory_quantity),
    )
  )
}

function isDashboard(value: unknown): value is ShopDashboard {
  return (
    isRecord(value) &&
    isMoney(value.today_sales) &&
    isCount(value.today_orders) &&
    isCount(value.pending_orders) &&
    isCount(value.low_stock_products) &&
    isDateTime(value.updated_at)
  )
}

function isPage<T>(
  value: unknown,
  validate: (item: unknown) => item is T,
): value is {
  items: T[]
  next_cursor: string | null
  has_more: boolean
} {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(validate) &&
    isNullableString(value.next_cursor) &&
    typeof value.has_more === 'boolean' &&
    (!value.has_more || (typeof value.next_cursor === 'string' && value.next_cursor.length > 0))
  )
}

export function createPlanetShopApi({
  baseUrl,
  getAccessToken,
  fetch: fetchImpl = globalThis.fetch,
}: PlanetShopApiOptions): ShopApi {
  const root = baseUrl.replace(/\/$/, '')

  async function request<T>(
    path: string,
    query: object = {},
    context: ShopRequestContext = {},
    validate: (value: unknown) => value is T,
  ): Promise<T> {
    throwIfAborted(context.signal)
    const url = new URL(`${root}${path}`)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
    const accessToken = context.accessToken || (await getAccessToken?.())
    throwIfAborted(context.signal)
    const headers = new Headers({ Accept: 'application/json' })
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    const response = await fetchImpl(url, { method: 'GET', headers, signal: context.signal })
    if (!response.ok) throw new PlanetApiError('دریافت داده فروشگاه ناموفق بود.', response.status)
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new PlanetApiError('پاسخ Planet معتبر نیست.', response.status)
    }
    if (!isRecord(payload) || payload.status !== true || !('data' in payload)) {
      throw new PlanetApiError('پاسخ Planet معتبر نیست.', response.status)
    }
    if (!validate(payload.data))
      throw new PlanetApiError('داده فروشگاه معتبر نیست.', response.status)
    return payload.data
  }

  return {
    dashboard(context) {
      return request('/api/v1/account/shop/dashboard', {}, context, isDashboard)
    },
    listOrders(query = {}, context) {
      return request('/api/v1/account/shop/orders', query, context, (value) =>
        isPage(value, isOrder),
      )
    },
    getOrder(id, context) {
      return request<Order | null>(
        `/api/v1/account/shop/orders/${encodeURIComponent(id)}`,
        {},
        context,
        (value) => value === null || isOrder(value),
      )
    },
    listProducts(query = {}, context) {
      return request('/api/v1/account/shop/products', query, context, (value) =>
        isPage(value, isProduct),
      )
    },
    getProduct(id, context) {
      return request<Product | null>(
        `/api/v1/account/shop/products/${encodeURIComponent(id)}`,
        {},
        context,
        (value) => value === null || isProduct(value),
      )
    },
  }
}

export function createConfiguredShopApi(baseUrl?: string): ShopApi {
  const normalizedBaseUrl = baseUrl?.trim()
  return normalizedBaseUrl
    ? createPlanetShopApi({ baseUrl: normalizedBaseUrl })
    : createMockShopApi()
}
