import type { ConversationListQuery } from '@superapp/chat-contracts'
import type { ConversationCache } from '@superapp/conversation-inbox'
import {
  ConversationRepository,
  createExpoDatabaseFactory,
  type LocalDatabase,
} from '@superapp/local-db'

let databasePromise: Promise<LocalDatabase> | null = null

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

export function createMobileConversationCache(): ConversationCache {
  return {
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

    async save(ownerId, _query, page, syncedAt = new Date().toISOString()) {
      const database = await getDatabase()
      await database.transaction(async (transaction) => {
        const conversations = new ConversationRepository(transaction)
        for (const conversation of page.items) {
          if (conversation.project_id !== ownerId) {
            throw new Error('Conversation owner does not match the active messaging session')
          }
          await conversations.upsert(ownerId, conversation, syncedAt)
        }
      })
    },
  }
}
