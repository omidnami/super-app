import type { ServiceSession } from '@superapp/auth'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import type { ShopCache as ShopCacheContract } from '@superapp/shop'
import {
  OrderRepository,
  ProductRepository,
  ShopRepository,
  createExpoDatabaseFactory,
  type LocalDatabase,
} from '@superapp/local-db'

let databasePromise: Promise<LocalDatabase> | null = null
const caches = new Map<string, ShopCacheContract>()

function getDatabase() {
  if (!databasePromise) {
    databasePromise = createExpoDatabaseFactory()
      .open('superapp.db')
      .catch((error: unknown) => {
        databasePromise = null
        throw error
      })
  }
  return databasePromise
}

export function createMobileShopCache(scope: string): ShopCacheContract {
  const existing = caches.get(scope)
  if (existing) return existing

  let active = true
  const assertOwner = (ownerId: string) => {
    if (ownerId !== scope) throw new Error('Shop cache scope does not match the active session.')
  }
  const cache: ShopCacheContract = {
    async getDashboard(ownerId) {
      if (!active) return null
      assertOwner(ownerId)
      const database = await getDatabase()
      if (!active) return null
      return new ShopRepository(database).getDashboard(ownerId)
    },
    async saveDashboard(ownerId, dashboard, syncedAt) {
      if (!active) return
      assertOwner(ownerId)
      const database = await getDatabase()
      await database.transaction(async (transaction) => {
        if (!active) return
        await new ShopRepository(transaction).saveDashboard(ownerId, dashboard, syncedAt)
      })
    },
    async listOrders(ownerId, query) {
      if (!active) return { items: [], next_cursor: null, has_more: false }
      assertOwner(ownerId)
      const database = await getDatabase()
      if (!active) return { items: [], next_cursor: null, has_more: false }
      return new OrderRepository(database).list(ownerId, query)
    },
    async saveOrders(ownerId, orders, syncedAt) {
      if (!active) return
      assertOwner(ownerId)
      const database = await getDatabase()
      await database.transaction(async (transaction) => {
        if (!active) return
        await new ShopRepository(transaction).saveOrders(ownerId, orders, syncedAt)
      })
    },
    async getOrder(ownerId, id) {
      if (!active) return null
      assertOwner(ownerId)
      const database = await getDatabase()
      if (!active) return null
      return new OrderRepository(database).get(ownerId, id)
    },
    async listProducts(ownerId, query) {
      if (!active) return { items: [], next_cursor: null, has_more: false }
      assertOwner(ownerId)
      const database = await getDatabase()
      if (!active) return { items: [], next_cursor: null, has_more: false }
      return new ProductRepository(database).list(ownerId, query)
    },
    async saveProducts(ownerId, products, syncedAt) {
      if (!active) return
      assertOwner(ownerId)
      const database = await getDatabase()
      await database.transaction(async (transaction) => {
        if (!active) return
        await new ShopRepository(transaction).saveProducts(ownerId, products, syncedAt)
      })
    },
    async getProduct(ownerId, id) {
      if (!active) return null
      assertOwner(ownerId)
      const database = await getDatabase()
      if (!active) return null
      return new ProductRepository(database).get(ownerId, id)
    },
    async getSyncState(ownerId, dataset) {
      if (!active) return null
      assertOwner(ownerId)
      const database = await getDatabase()
      if (!active) return null
      return new ShopRepository(database).getSyncState(ownerId, dataset)
    },
    async clear(ownerId) {
      if (!active) return
      assertOwner(ownerId)
      active = false
      const database = await getDatabase()
      await new ShopRepository(database).clear(ownerId)
    },
  }

  caches.set(scope, cache)
  return cache
}

export async function clearShopCacheForSession(session: ServiceSession) {
  const scope = createConversationCacheScope(session.context.operatorId, session.context.projectId)
  const cache = caches.get(scope) || createMobileShopCache(scope)
  await cache.clear(scope)
  caches.delete(scope)
}
