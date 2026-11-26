import type {
  Order,
  OrderListQuery,
  OrderPage,
  Product,
  ProductListQuery,
  ProductPage,
  ShopDashboard,
} from '@superapp/chat-contracts'
import type { ShopApi } from '@superapp/api-client'

export type ShopResourceStatus = 'idle' | 'loading' | 'ready' | 'error'
export type ShopDataSource = 'remote' | 'cache'

export interface ShopResource<T> {
  data: T | null
  status: ShopResourceStatus
  error: string | null
  dataSource: ShopDataSource | null
  lastSyncedAt: string | null
}

export interface ShopCache {
  getDashboard(ownerId: string): Promise<ShopDashboard | null>
  saveDashboard(ownerId: string, dashboard: ShopDashboard, syncedAt?: string): Promise<void>
  listOrders(ownerId: string, query: OrderListQuery): Promise<OrderPage>
  saveOrders(ownerId: string, orders: Order[], syncedAt?: string): Promise<void>
  getOrder(ownerId: string, id: string): Promise<Order | null>
  listProducts(ownerId: string, query: ProductListQuery): Promise<ProductPage>
  saveProducts(ownerId: string, products: Product[], syncedAt?: string): Promise<void>
  getProduct(ownerId: string, id: string): Promise<Product | null>
  getSyncState(ownerId: string, dataset: string): Promise<{ last_synced_at: string | null } | null>
  clear(ownerId: string): Promise<void>
}

export interface UseShopOptions {
  api: ShopApi
  ownerId: string
  accessToken?: string
  cache?: ShopCache
  isOnline?: boolean
  enabled?: boolean
  pageSize?: number
}

export interface UseShopResult {
  dashboard: ShopResource<ShopDashboard>
  orders: ShopResource<OrderPage>
  products: ShopResource<ProductPage>
  orderFilters: OrderListQuery
  productFilters: ProductListQuery
  detail: ShopResource<Order | Product> & { kind: 'order' | 'product' | null; id: string | null }
  setOrderFilters: (filters: Partial<OrderListQuery>) => void
  setProductFilters: (filters: Partial<ProductListQuery>) => void
  refreshDashboard: () => Promise<void>
  refreshOrders: () => Promise<void>
  refreshProducts: () => Promise<void>
  refreshAll: () => Promise<void>
  loadMoreOrders: () => Promise<void>
  loadMoreProducts: () => Promise<void>
  openOrder: (id: string) => Promise<void>
  openProduct: (id: string) => Promise<void>
  closeDetail: () => void
}
