import type { ServiceSession } from '@superapp/auth'
import type { AccountingCache } from '@superapp/accounting'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import {
  AccountingRepository,
  createExpoDatabaseFactory,
  type LocalDatabase,
} from '@superapp/local-db'
import { accountingKeyWasCreated, clearAccountingKey, createAccountingCipher } from './crypto'

let databasePromise: Promise<LocalDatabase> | null = null
const caches = new Map<string, AccountingCache>()

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

function emptyDocumentPage(): Awaited<ReturnType<AccountingCache['listDocuments']>> {
  return { items: [], next_cursor: null, has_more: false }
}

export function createMobileAccountingCache(scope: string): AccountingCache {
  const existing = caches.get(scope)
  if (existing) return existing

  let active = true
  let initialized = false
  let legacyPurgePending = false
  let initializing: Promise<void> | null = null
  const cipher = createAccountingCipher(scope)
  const repository = (database: LocalDatabase) => new AccountingRepository(database, { cipher })
  const assertOwner = (ownerId: string) => {
    if (ownerId !== scope) {
      throw new Error('Accounting cache scope does not match the active session.')
    }
  }
  const initialize = () => {
    if (initialized || !active) return Promise.resolve()
    if (!initializing) {
      initializing = (async () => {
        const keyCreated = await accountingKeyWasCreated(scope)
        if (!active) return
        if (keyCreated) legacyPurgePending = true
        if (legacyPurgePending) {
          const database = await getDatabase()
          if (!active) return
          await new AccountingRepository(database).clear(scope)
          legacyPurgePending = false
        }
        if (active) initialized = true
      })().finally(() => {
        initializing = null
      })
    }
    return initializing
  }
  const cache: AccountingCache = {
    async getDashboard(ownerId) {
      if (!active) return null
      assertOwner(ownerId)
      await initialize()
      if (!active) return null
      const database = await getDatabase()
      if (!active) return null
      const dashboard = await repository(database).getDashboard(ownerId)
      return active ? dashboard : null
    },
    async saveDashboard(ownerId, dashboard, syncedAt) {
      if (!active) return
      assertOwner(ownerId)
      await initialize()
      if (!active) return
      const database = await getDatabase()
      if (!active) return
      await database.transaction(async (transaction) => {
        if (!active) return
        await repository(transaction).saveDashboard(ownerId, dashboard, syncedAt)
      })
    },
    async listDocuments(ownerId, query) {
      if (!active) return emptyDocumentPage()
      assertOwner(ownerId)
      await initialize()
      if (!active) return emptyDocumentPage()
      const database = await getDatabase()
      if (!active) return emptyDocumentPage()
      const page = await repository(database).list(ownerId, query)
      return active ? page : emptyDocumentPage()
    },
    async saveDocuments(ownerId, documents, syncedAt) {
      if (!active) return
      assertOwner(ownerId)
      await initialize()
      if (!active) return
      const database = await getDatabase()
      if (!active) return
      await database.transaction(async (transaction) => {
        if (!active) return
        await repository(transaction).saveDocuments(ownerId, documents, syncedAt)
      })
    },
    async getDocument(ownerId, id) {
      if (!active) return null
      assertOwner(ownerId)
      await initialize()
      if (!active) return null
      const database = await getDatabase()
      if (!active) return null
      const document = await repository(database).get(ownerId, id)
      return active ? document : null
    },
    async getSyncState(ownerId, dataset) {
      if (!active) return null
      assertOwner(ownerId)
      await initialize()
      if (!active) return null
      const database = await getDatabase()
      if (!active) return null
      const state = await repository(database).getSyncState(ownerId, dataset)
      return active ? state : null
    },
    async clear(ownerId) {
      if (!active) return
      assertOwner(ownerId)
      active = false
      try {
        const database = await getDatabase()
        await repository(database).clear(ownerId)
      } finally {
        await clearAccountingKey(scope)
      }
      caches.delete(scope)
    },
  }

  caches.set(scope, cache)
  return cache
}

export async function clearAccountingCacheForSession(session: ServiceSession) {
  const scope = createConversationCacheScope(session.context.operatorId, session.context.projectId)
  const cache = caches.get(scope) || createMobileAccountingCache(scope)
  await cache.clear(scope)
}
