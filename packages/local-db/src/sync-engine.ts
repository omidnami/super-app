import type { CanonicalMessage, Conversation, SyncChange } from '@superapp/chat-contracts'
import type { LocalDatabase } from './database'
import type { PayloadCipher } from './payload-cipher'
import {
  AccountingRepository,
  ConversationRepository,
  MessageRepository,
  OrderRepository,
  ProductRepository,
  SyncStateRepository,
} from './repositories'

export interface ApplySyncResult {
  applied: number
  cursor: string
  syncedAt: string
}

export interface SyncEngineOptions {
  accountingCipher?: PayloadCipher
  accountingRetentionDays?: number
}

export class SyncEngine {
  private readonly conversations: ConversationRepository
  private readonly messages: MessageRepository
  private readonly orders: OrderRepository
  private readonly products: ProductRepository
  private readonly accounting: AccountingRepository
  private readonly syncState: SyncStateRepository

  constructor(
    private readonly database: LocalDatabase,
    private readonly options: SyncEngineOptions = {},
  ) {
    this.conversations = new ConversationRepository(database)
    this.messages = new MessageRepository(database)
    this.orders = new OrderRepository(database)
    this.products = new ProductRepository(database)
    this.accounting = new AccountingRepository(database, {
      cipher: options.accountingCipher,
      retentionDays: options.accountingRetentionDays,
    })
    this.syncState = new SyncStateRepository(database)
  }

  async applyChatChanges(
    ownerId: string,
    changes: SyncChange[],
    nextCursor: string,
    syncedAt = new Date().toISOString(),
  ): Promise<ApplySyncResult> {
    return this.database.transaction(async (transaction) => {
      const conversations = new ConversationRepository(transaction)
      const messages = new MessageRepository(transaction)
      const syncState = new SyncStateRepository(transaction)

      for (const change of changes) {
        if (change.entity === 'conversation') {
          if (change.op === 'delete') {
            await conversations.markDeleted(
              ownerId,
              change.id,
              change.deleted_at || change.updated_at,
              syncedAt,
              change.version,
            )
          } else {
            if (!change.data) throw new Error(`Conversation ${change.id} has no data`)
            await conversations.upsert(
              ownerId,
              change.data as Conversation,
              syncedAt,
              change.version,
            )
          }
        } else {
          if (change.op === 'delete') {
            await messages.markDeleted(
              ownerId,
              change.id,
              change.deleted_at || change.updated_at,
              syncedAt,
              change.version,
            )
          } else {
            if (!change.data) throw new Error(`Message ${change.id} has no data`)
            await messages.upsert(
              ownerId,
              change.data as CanonicalMessage,
              syncedAt,
              change.version,
            )
          }
        }
      }

      await syncState.upsert(ownerId, 'chat', {
        cursor: nextCursor,
        lastSyncedAt: syncedAt,
        status: 'success',
      })

      return { applied: changes.length, cursor: nextCursor, syncedAt }
    })
  }

  async applyShopSnapshot(
    ownerId: string,
    orders: Parameters<OrderRepository['upsert']>[1][],
    products: Parameters<ProductRepository['upsert']>[1][],
    nextCursor: string,
    syncedAt = new Date().toISOString(),
  ): Promise<ApplySyncResult> {
    return this.database.transaction(async (transaction) => {
      const ordersRepository = new OrderRepository(transaction)
      const productsRepository = new ProductRepository(transaction)
      const syncState = new SyncStateRepository(transaction)

      for (const order of orders) await ordersRepository.upsert(ownerId, order, syncedAt)
      for (const product of products) await productsRepository.upsert(ownerId, product, syncedAt)

      await syncState.upsert(ownerId, 'shop', {
        cursor: nextCursor,
        lastSyncedAt: syncedAt,
        status: 'success',
      })
      return { applied: orders.length + products.length, cursor: nextCursor, syncedAt }
    })
  }

  async applyAccountingSnapshot(
    ownerId: string,
    documents: Parameters<AccountingRepository['upsert']>[1][],
    nextCursor: string,
    syncedAt = new Date().toISOString(),
  ): Promise<ApplySyncResult> {
    return this.database.transaction(async (transaction) => {
      const accountingRepository = new AccountingRepository(transaction, {
        cipher: this.options.accountingCipher,
        retentionDays: this.options.accountingRetentionDays,
      })
      const syncState = new SyncStateRepository(transaction)

      await accountingRepository.purgeExpired(ownerId)
      for (const document of documents)
        await accountingRepository.upsert(ownerId, document, syncedAt)

      await syncState.upsert(ownerId, 'accounting', {
        cursor: nextCursor,
        lastSyncedAt: syncedAt,
        status: 'success',
      })
      return { applied: documents.length, cursor: nextCursor, syncedAt }
    })
  }

  async getCursor(ownerId: string, dataset: string) {
    return this.syncState.get(ownerId, dataset)
  }
}
