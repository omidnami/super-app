import type { CanonicalMessage, Conversation, SyncChange } from '@superapp/chat-contracts'
import type { LocalDatabase } from './database'
import { ConversationRepository, MessageRepository, SyncStateRepository } from './repositories'

export interface BacklogState {
  owner_id: string
  dataset: string
  cursor: string | null
  last_synced_at: string | null
  status: string
}

function datasetFor(conversationId: string) {
  return `chat:${conversationId}`
}

function assertConversationScope(conversationId: string, conversation: Conversation) {
  if (conversation.id !== conversationId) {
    throw new Error(`Conversation ${conversation.id} does not belong to ${conversationId}`)
  }
}

function assertMessageScope(conversationId: string, message: CanonicalMessage) {
  if (message.conversation_id !== conversationId) {
    throw new Error(`Message ${message.id} does not belong to ${conversationId}`)
  }
}

function validateChanges(conversationId: string, changes: SyncChange[]) {
  for (const change of changes) {
    if (change.entity !== 'conversation' && change.entity !== 'message') {
      throw new Error(`Unsupported sync entity: ${String(change.entity)}`)
    }
    if (change.op !== 'upsert' && change.op !== 'delete') {
      throw new Error(`Unsupported sync operation: ${String(change.op)}`)
    }
    if (change.op === 'upsert' && !change.data) {
      throw new Error(`${change.entity} ${change.id} has no data`)
    }
    if (change.entity === 'conversation') {
      if (change.id !== conversationId) {
        throw new Error(`Conversation ${change.id} does not belong to ${conversationId}`)
      }
      if (change.data) {
        const conversation = change.data as Conversation
        assertConversationScope(conversationId, conversation)
        if (conversation.id !== change.id) {
          throw new Error(`Conversation change ${change.id} has mismatched data`)
        }
      }
    } else if (change.data) {
      const message = change.data as CanonicalMessage
      assertMessageScope(conversationId, message)
      if (message.id !== change.id) {
        throw new Error(`Message change ${change.id} has mismatched data`)
      }
    }
  }
}

export class BacklogRepository {
  private readonly syncState: SyncStateRepository

  constructor(private readonly database: LocalDatabase) {
    this.syncState = new SyncStateRepository(database)
  }

  getState(ownerId: string, conversationId: string): Promise<BacklogState | null> {
    return this.syncState.get(ownerId, datasetFor(conversationId))
  }

  async applyChanges(
    ownerId: string,
    conversationId: string,
    changes: SyncChange[],
    nextCursor: string,
    syncedAt = new Date().toISOString(),
  ): Promise<void> {
    return this.database.transaction(async (transaction) => {
      validateChanges(conversationId, changes)
      const conversations = new ConversationRepository(transaction)
      const messages = new MessageRepository(transaction)
      const syncState = new SyncStateRepository(transaction)

      for (const change of changes) {
        if (change.entity !== 'conversation') continue
        if (change.op === 'delete') {
          await this.markConversationDeleted(transaction, ownerId, change, syncedAt)
        } else {
          await conversations.upsert(ownerId, change.data as Conversation, syncedAt)
        }
      }

      for (const change of changes) {
        if (change.entity !== 'message') continue
        if (change.op === 'delete') {
          await this.markMessageDeleted(transaction, ownerId, conversationId, change, syncedAt)
        } else {
          const message = change.data as CanonicalMessage
          await messages.deleteSyntheticDuplicate(ownerId, message)
          await messages.upsert(ownerId, message, syncedAt)
        }
      }

      await syncState.upsert(ownerId, datasetFor(conversationId), {
        cursor: nextCursor,
        lastSyncedAt: syncedAt,
        status: 'success',
      })
    })
  }

  async replaceSnapshot(
    ownerId: string,
    conversationId: string,
    messages: CanonicalMessage[],
    nextCursor: string,
    syncedAt = new Date().toISOString(),
  ): Promise<void> {
    return this.database.transaction(async (transaction) => {
      for (const message of messages) assertMessageScope(conversationId, message)
      const messageRepository = new MessageRepository(transaction)
      const syncState = new SyncStateRepository(transaction)

      for (const message of messages) {
        await messageRepository.deleteSyntheticDuplicate(ownerId, message)
        await messageRepository.upsert(ownerId, message, syncedAt)
      }

      await transaction.run(
        `UPDATE cached_messages
         SET deleted_at = ?, updated_at = MAX(updated_at, ?), synced_at = ?, cache_status = 'deleted'
         WHERE owner_id = ? AND conversation_id = ? AND deleted_at IS NULL
           AND server_id NOT IN (SELECT value FROM json_each(?))`,
        [
          syncedAt,
          syncedAt,
          syncedAt,
          ownerId,
          conversationId,
          JSON.stringify(messages.map((message) => message.id)),
        ],
      )

      await syncState.upsert(ownerId, datasetFor(conversationId), {
        cursor: nextCursor,
        lastSyncedAt: syncedAt,
        status: 'success',
      })
    })
  }

  private async markConversationDeleted(
    database: LocalDatabase,
    ownerId: string,
    change: SyncChange,
    syncedAt: string,
  ) {
    const deletedAt = change.deleted_at || change.updated_at
    await database.run(
      `UPDATE cached_conversations
       SET deleted_at = ?, updated_at = MAX(updated_at, ?), synced_at = ?, cache_status = 'deleted'
       WHERE owner_id = ? AND server_id = ? AND updated_at <= ?`,
      [deletedAt, deletedAt, syncedAt, ownerId, change.id, deletedAt],
    )
  }

  private async markMessageDeleted(
    database: LocalDatabase,
    ownerId: string,
    conversationId: string,
    change: SyncChange,
    syncedAt: string,
  ) {
    const existing = await database.get<{ conversation_id: string }>(
      'SELECT conversation_id FROM cached_messages WHERE owner_id = ? AND server_id = ?',
      [ownerId, change.id],
    )
    if (!existing) return
    if (existing.conversation_id !== conversationId) {
      throw new Error(`Message ${change.id} does not belong to ${conversationId}`)
    }

    const deletedAt = change.deleted_at || change.updated_at
    await database.run(
      `UPDATE cached_messages
       SET deleted_at = ?, updated_at = MAX(updated_at, ?), synced_at = ?, cache_status = 'deleted'
       WHERE owner_id = ? AND server_id = ? AND conversation_id = ? AND updated_at <= ?`,
      [deletedAt, deletedAt, syncedAt, ownerId, change.id, conversationId, deletedAt],
    )
  }
}
