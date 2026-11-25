import type { ServiceSession } from '@superapp/auth'
import type { ConversationListQuery } from '@superapp/chat-contracts'
import {
  createConversationCacheScope,
  parseConversationCacheScope,
  type ConversationCache,
} from '@superapp/conversation-inbox'
import {
  ConversationRepository,
  createExpoDatabaseFactory,
  type LocalDatabase,
} from '@superapp/local-db'

let databasePromise: Promise<LocalDatabase> | null = null
const caches = new Map<string, ConversationCache>()

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

export function createMobileConversationCache(scope: string): ConversationCache {
  const existing = caches.get(scope)
  if (existing) return existing

  const cache: ConversationCache = {
    async list(ownerId, query: ConversationListQuery) {
      const database = await getDatabase()
      return new ConversationRepository(database).list(ownerId, {
        search: query.search,
        source: query.source,
        supportLevel: query.support_level,
        status: query.status,
        assigneeId: query.assignee_operator_id,
        unreadOnly: query.unread_only,
        cursor: query.cursor,
        limit: query.limit,
      })
    },

    async save(ownerId, _query, page, syncedAt = new Date().toISOString(), completeSnapshot) {
      const { projectId } = parseConversationCacheScope(ownerId)
      const database = await getDatabase()
      await database.transaction(async (transaction) => {
        const conversations = new ConversationRepository(transaction)
        const itemsToUpsert = completeSnapshot || page.items
        for (const conversation of itemsToUpsert) {
          if (conversation.project_id !== projectId) {
            throw new Error('Conversation project does not match the active messaging session')
          }
          await conversations.upsert(ownerId, conversation, syncedAt)
        }
        if (completeSnapshot) {
          await conversations.markMissingDeleted(
            ownerId,
            completeSnapshot.map((conversation) => conversation.id),
            syncedAt,
            syncedAt,
          )
        }
      })
    },

    async clear(ownerId) {
      parseConversationCacheScope(ownerId)
      const database = await getDatabase()
      await database.transaction(async (transaction) => {
        await transaction.run('DELETE FROM cached_messages WHERE owner_id = ?', [ownerId])
        await transaction.run('DELETE FROM cached_conversations WHERE owner_id = ?', [ownerId])
        await transaction.run("DELETE FROM sync_state WHERE owner_id = ? AND dataset = 'chat'", [
          ownerId,
        ])
      })
    },
  }

  caches.set(scope, cache)
  return cache
}

export async function clearConversationCacheForSession(session: ServiceSession) {
  const scope = createConversationCacheScope(session.context.operatorId, session.context.projectId)
  const cache = caches.get(scope) || createMobileConversationCache(scope)
  await cache.clear?.(scope)
  caches.delete(scope)
}
