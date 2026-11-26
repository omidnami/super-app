import { useCallback, useEffect, useRef, useState } from 'react'
import { PlanetApiError } from '@superapp/api-client'
import type {
  Order,
  OrderListQuery,
  OrderPage,
  Product,
  ProductListQuery,
  ProductPage,
  ShopDashboard,
} from '@superapp/chat-contracts'
import type { ShopResource, UseShopOptions, UseShopResult } from './types'

const DEFAULT_ERROR = 'دریافت داده فروشگاه ناموفق بود.'
const AUTH_ERROR = 'دسترسی به فروشگاه مجاز نیست.'
const OFFLINE_ERROR = 'داده آفلاین فروشگاه در دسترس نیست.'

function initialResource<T>(): ShopResource<T> {
  return { data: null, status: 'idle', error: null, dataSource: null, lastSyncedAt: null }
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

function isAuthError(error: unknown) {
  return error instanceof PlanetApiError && (error.status === 401 || error.status === 403)
}

function canUseCache(error: unknown) {
  if (!(error instanceof PlanetApiError)) return true
  return error.status === 408 || error.status === 429 || error.status >= 500
}

function errorMessage(error: unknown) {
  if (isAuthError(error)) return AUTH_ERROR
  if (error instanceof PlanetApiError) return error.message
  return error instanceof Error && error.message === OFFLINE_ERROR ? OFFLINE_ERROR : DEFAULT_ERROR
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const seen = new Set(current.map((item) => item.id))
  const additions = incoming.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
  return [...current, ...additions]
}

export function useShop({
  api,
  ownerId,
  accessToken,
  cache,
  isOnline = true,
  enabled = true,
  pageSize = 30,
}: UseShopOptions): UseShopResult {
  const [dashboard, setDashboard] = useState<ShopResource<ShopDashboard>>(initialResource)
  const [orders, setOrders] = useState<ShopResource<OrderPage>>(initialResource)
  const [products, setProducts] = useState<ShopResource<ProductPage>>(initialResource)
  const [orderFilters, setOrderFiltersState] = useState<OrderListQuery>({})
  const [productFilters, setProductFiltersState] = useState<ProductListQuery>({})
  const [detail, setDetail] = useState<UseShopResult['detail']>({
    ...initialResource<Order | Product>(),
    kind: null,
    id: null,
  })
  const dashboardController = useRef<AbortController | null>(null)
  const ordersController = useRef<AbortController | null>(null)
  const productsController = useRef<AbortController | null>(null)
  const detailController = useRef<AbortController | null>(null)
  const ordersLoadingMore = useRef(false)
  const productsLoadingMore = useRef(false)
  const scopeRef = useRef({ ownerId, enabled })

  useEffect(() => {
    const previous = scopeRef.current
    scopeRef.current = { ownerId, enabled }
    if (previous.ownerId !== ownerId || previous.enabled !== enabled) {
      dashboardController.current?.abort()
      ordersController.current?.abort()
      productsController.current?.abort()
      detailController.current?.abort()
      ordersLoadingMore.current = false
      productsLoadingMore.current = false
      setDashboard(initialResource())
      setOrders(initialResource())
      setProducts(initialResource())
      setDetail({ ...initialResource<Order | Product>(), kind: null, id: null })
    }
    return () => {
      dashboardController.current?.abort()
      ordersController.current?.abort()
      productsController.current?.abort()
      detailController.current?.abort()
      ordersLoadingMore.current = false
      productsLoadingMore.current = false
    }
  }, [enabled, ownerId])

  const lastSync = useCallback(
    async (dataset: string) => {
      if (!cache) return null
      try {
        return (await cache.getSyncState(ownerId, dataset))?.last_synced_at || null
      } catch {
        return null
      }
    },
    [cache, ownerId],
  )

  const loadDashboard = useCallback(async () => {
    if (!enabled) return
    dashboardController.current?.abort()
    const controller = new AbortController()
    dashboardController.current = controller
    setDashboard((current) => ({ ...current, status: 'loading', error: null }))
    try {
      if (!isOnline) throw new Error(OFFLINE_ERROR)
      const data = await api.dashboard({ accessToken, signal: controller.signal })
      if (controller.signal.aborted) return
      if (cache) {
        try {
          await cache.saveDashboard(ownerId, data)
        } catch {
          // A cache write failure does not hide fresh server data.
        }
      }
      if (controller.signal.aborted) return
      setDashboard({
        data,
        status: 'ready',
        error: null,
        dataSource: 'remote',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (caught) {
      if (controller.signal.aborted || isAbortError(caught)) return
      if (cache && canUseCache(caught)) {
        try {
          const data = await cache.getDashboard(ownerId)
          if (controller.signal.aborted) return
          if (!data) throw new Error(OFFLINE_ERROR)
          const lastSyncedAt = await lastSync('shop:dashboard')
          if (controller.signal.aborted) return
          setDashboard({
            data,
            status: 'ready',
            error: null,
            dataSource: 'cache',
            lastSyncedAt,
          })
          return
        } catch {
          // Fall through to the error state.
        }
      }
      setDashboard({
        data: null,
        status: 'error',
        error: errorMessage(caught),
        dataSource: null,
        lastSyncedAt: null,
      })
    }
  }, [accessToken, api, cache, enabled, isOnline, lastSync, ownerId])

  const loadOrders = useCallback(
    async (reset = true) => {
      if (!reset || !enabled) return
      ordersController.current?.abort()
      const controller = new AbortController()
      ordersController.current = controller
      ordersLoadingMore.current = false
      setOrders((current) => ({ ...current, status: 'loading', error: null, data: null }))
      const query = {
        ...orderFilters,
        search: orderFilters.search?.trim() || undefined,
        limit: pageSize,
      }
      try {
        if (!isOnline) throw new Error(OFFLINE_ERROR)
        const data = await api.listOrders(query, { accessToken, signal: controller.signal })
        if (controller.signal.aborted) return
        if (cache) {
          try {
            await cache.saveOrders(ownerId, data.items)
          } catch {
            // Keep the remote page available even when caching fails.
          }
        }
        if (controller.signal.aborted) return
        setOrders({
          data,
          status: 'ready',
          error: null,
          dataSource: 'remote',
          lastSyncedAt: new Date().toISOString(),
        })
      } catch (caught) {
        if (controller.signal.aborted || isAbortError(caught)) return
        if (cache && canUseCache(caught)) {
          try {
            const data = await cache.listOrders(ownerId, query)
            if (controller.signal.aborted) return
            const lastSyncedAt = await lastSync('shop:orders')
            if (controller.signal.aborted) return
            if (!data.items.length && !lastSyncedAt) throw new Error(OFFLINE_ERROR)
            setOrders({
              data,
              status: 'ready',
              error: null,
              dataSource: 'cache',
              lastSyncedAt,
            })
            return
          } catch {
            // Fall through to the error state.
          }
        }
        setOrders({
          data: null,
          status: 'error',
          error: errorMessage(caught),
          dataSource: null,
          lastSyncedAt: null,
        })
      }
    },
    [accessToken, api, cache, enabled, isOnline, lastSync, orderFilters, ownerId, pageSize],
  )

  const loadProducts = useCallback(
    async (reset = true) => {
      if (!reset || !enabled) return
      productsController.current?.abort()
      const controller = new AbortController()
      productsController.current = controller
      productsLoadingMore.current = false
      setProducts((current) => ({ ...current, status: 'loading', error: null, data: null }))
      const query = {
        ...productFilters,
        search: productFilters.search?.trim() || undefined,
        limit: pageSize,
      }
      try {
        if (!isOnline) throw new Error(OFFLINE_ERROR)
        const data = await api.listProducts(query, { accessToken, signal: controller.signal })
        if (controller.signal.aborted) return
        if (cache) {
          try {
            await cache.saveProducts(ownerId, data.items)
          } catch {
            // Keep the remote page available even when caching fails.
          }
        }
        if (controller.signal.aborted) return
        setProducts({
          data,
          status: 'ready',
          error: null,
          dataSource: 'remote',
          lastSyncedAt: new Date().toISOString(),
        })
      } catch (caught) {
        if (controller.signal.aborted || isAbortError(caught)) return
        if (cache && canUseCache(caught)) {
          try {
            const data = await cache.listProducts(ownerId, query)
            if (controller.signal.aborted) return
            const lastSyncedAt = await lastSync('shop:products')
            if (controller.signal.aborted) return
            if (!data.items.length && !lastSyncedAt) throw new Error(OFFLINE_ERROR)
            setProducts({
              data,
              status: 'ready',
              error: null,
              dataSource: 'cache',
              lastSyncedAt,
            })
            return
          } catch {
            // Fall through to the error state.
          }
        }
        setProducts({
          data: null,
          status: 'error',
          error: errorMessage(caught),
          dataSource: null,
          lastSyncedAt: null,
        })
      }
    },
    [accessToken, api, cache, enabled, isOnline, lastSync, ownerId, pageSize, productFilters],
  )

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const loadMoreOrders = useCallback(async () => {
    const current = orders.data
    if (!enabled || !current?.next_cursor || !current.has_more || ordersLoadingMore.current) return
    if (!isOnline && orders.dataSource !== 'cache') {
      await loadOrders()
      return
    }
    ordersLoadingMore.current = true
    const controller = ordersController.current
    if (!controller || controller.signal.aborted) {
      ordersLoadingMore.current = false
      return
    }
    const query = {
      ...orderFilters,
      search: orderFilters.search?.trim() || undefined,
      cursor: current.next_cursor,
      limit: pageSize,
    }
    try {
      if (orders.dataSource === 'cache') {
        if (!cache) throw new Error(OFFLINE_ERROR)
        const page = await cache.listOrders(ownerId, query)
        if (controller.signal.aborted) return
        const lastSyncedAt = orders.lastSyncedAt || (await lastSync('shop:orders'))
        if (controller.signal.aborted) return
        setOrders({
          data: { ...page, items: mergeById(current.items, page.items) },
          status: 'ready',
          error: null,
          dataSource: 'cache',
          lastSyncedAt,
        })
        return
      }
      const page = await api.listOrders(query, { accessToken, signal: controller.signal })
      if (controller.signal.aborted) return
      if (cache) {
        try {
          await cache.saveOrders(ownerId, page.items)
        } catch {
          // Pagination remains usable without a cache write.
        }
      }
      if (controller.signal.aborted) return
      setOrders({
        data: { ...page, items: mergeById(current.items, page.items) },
        status: 'ready',
        error: null,
        dataSource: 'remote',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (caught) {
      if (!controller.signal.aborted && !isAbortError(caught)) {
        if (isAuthError(caught)) {
          setOrders({
            data: null,
            status: 'error',
            error: errorMessage(caught),
            dataSource: null,
            lastSyncedAt: null,
          })
        } else {
          setOrders((previous) => ({ ...previous, error: errorMessage(caught) }))
        }
      }
    } finally {
      ordersLoadingMore.current = false
    }
  }, [
    accessToken,
    api,
    cache,
    enabled,
    isOnline,
    lastSync,
    loadOrders,
    orderFilters,
    orders.data,
    orders.dataSource,
    orders.lastSyncedAt,
    ownerId,
    pageSize,
  ])

  const loadMoreProducts = useCallback(async () => {
    const current = products.data
    if (!enabled || !current?.next_cursor || !current.has_more || productsLoadingMore.current)
      return
    if (!isOnline && products.dataSource !== 'cache') {
      await loadProducts()
      return
    }
    productsLoadingMore.current = true
    const controller = productsController.current
    if (!controller || controller.signal.aborted) {
      productsLoadingMore.current = false
      return
    }
    const query = {
      ...productFilters,
      search: productFilters.search?.trim() || undefined,
      cursor: current.next_cursor,
      limit: pageSize,
    }
    try {
      if (products.dataSource === 'cache') {
        if (!cache) throw new Error(OFFLINE_ERROR)
        const page = await cache.listProducts(ownerId, query)
        if (controller.signal.aborted) return
        const lastSyncedAt = products.lastSyncedAt || (await lastSync('shop:products'))
        if (controller.signal.aborted) return
        setProducts({
          data: { ...page, items: mergeById(current.items, page.items) },
          status: 'ready',
          error: null,
          dataSource: 'cache',
          lastSyncedAt,
        })
        return
      }
      const page = await api.listProducts(query, { accessToken, signal: controller.signal })
      if (controller.signal.aborted) return
      if (cache) {
        try {
          await cache.saveProducts(ownerId, page.items)
        } catch {
          // Pagination remains usable without a cache write.
        }
      }
      if (controller.signal.aborted) return
      setProducts({
        data: { ...page, items: mergeById(current.items, page.items) },
        status: 'ready',
        error: null,
        dataSource: 'remote',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (caught) {
      if (!controller.signal.aborted && !isAbortError(caught)) {
        if (isAuthError(caught)) {
          setProducts({
            data: null,
            status: 'error',
            error: errorMessage(caught),
            dataSource: null,
            lastSyncedAt: null,
          })
        } else {
          setProducts((previous) => ({ ...previous, error: errorMessage(caught) }))
        }
      }
    } finally {
      productsLoadingMore.current = false
    }
  }, [
    accessToken,
    api,
    cache,
    enabled,
    isOnline,
    lastSync,
    loadProducts,
    ownerId,
    pageSize,
    productFilters,
    products.data,
    products.dataSource,
    products.lastSyncedAt,
  ])

  const openDetail = useCallback(
    async (kind: 'order' | 'product', id: string) => {
      if (!enabled) return
      detailController.current?.abort()
      const controller = new AbortController()
      detailController.current = controller
      setDetail({ ...initialResource<Order | Product>(), kind, id, status: 'loading' })
      try {
        if (!isOnline) throw new Error(OFFLINE_ERROR)
        const data =
          kind === 'order'
            ? await api.getOrder(id, { accessToken, signal: controller.signal })
            : await api.getProduct(id, { accessToken, signal: controller.signal })
        if (controller.signal.aborted) return
        setDetail({
          data,
          kind,
          id,
          status: 'ready',
          error: null,
          dataSource: 'remote',
          lastSyncedAt: new Date().toISOString(),
        })
      } catch (caught) {
        if (controller.signal.aborted || isAbortError(caught)) return
        if (cache && canUseCache(caught)) {
          try {
            const data =
              kind === 'order'
                ? await cache.getOrder(ownerId, id)
                : await cache.getProduct(ownerId, id)
            if (controller.signal.aborted) return
            if (!data) throw new Error(OFFLINE_ERROR)
            const lastSyncedAt = await lastSync(kind === 'order' ? 'shop:orders' : 'shop:products')
            if (controller.signal.aborted) return
            setDetail({
              data,
              kind,
              id,
              status: 'ready',
              error: null,
              dataSource: 'cache',
              lastSyncedAt,
            })
            return
          } catch {
            // Fall through to the error state.
          }
        }
        setDetail({
          data: null,
          kind,
          id,
          status: 'error',
          error: errorMessage(caught),
          dataSource: null,
          lastSyncedAt: null,
        })
      }
    },
    [accessToken, api, cache, enabled, isOnline, lastSync, ownerId],
  )

  const setOrderFilters = useCallback((patch: Partial<OrderListQuery>) => {
    setOrderFiltersState((current) => ({ ...current, ...patch, cursor: undefined }))
  }, [])

  const setProductFilters = useCallback((patch: Partial<ProductListQuery>) => {
    setProductFiltersState((current) => ({ ...current, ...patch, cursor: undefined }))
  }, [])

  const closeDetail = useCallback(() => {
    detailController.current?.abort()
    setDetail({ ...initialResource<Order | Product>(), kind: null, id: null })
  }, [])

  return {
    dashboard,
    orders,
    products,
    orderFilters,
    productFilters,
    detail,
    setOrderFilters,
    setProductFilters,
    refreshDashboard: loadDashboard,
    refreshOrders: () => loadOrders(),
    refreshProducts: () => loadProducts(),
    refreshAll: async () => {
      await Promise.all([loadDashboard(), loadOrders(), loadProducts()])
    },
    loadMoreOrders,
    loadMoreProducts,
    openOrder: (id) => openDetail('order', id),
    openProduct: (id) => openDetail('product', id),
    closeDetail,
  }
}
