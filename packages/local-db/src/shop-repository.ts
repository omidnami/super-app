import type { Order, Product, ShopDashboard } from '@superapp/chat-contracts'
import type { LocalDatabase } from './database'
import { OrderRepository, ProductRepository, SyncStateRepository } from './repositories'

const DASHBOARD_KEY = 'shop:dashboard'

export class ShopRepository {
  constructor(private readonly database: LocalDatabase) {}

  async getDashboard(ownerId: string): Promise<ShopDashboard | null> {
    const row = await this.database.get<{ payload_json: string }>(
      'SELECT payload_json FROM cached_reports WHERE owner_id = ? AND report_key = ?',
      [ownerId, DASHBOARD_KEY],
    )
    return row ? (JSON.parse(row.payload_json) as ShopDashboard) : null
  }

  async saveDashboard(
    ownerId: string,
    dashboard: ShopDashboard,
    syncedAt = new Date().toISOString(),
  ) {
    await this.database.transaction(async (transaction) => {
      await transaction.run(
        `INSERT INTO cached_reports (owner_id, report_key, payload_json, updated_at, synced_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(owner_id, report_key) DO UPDATE SET
           payload_json = excluded.payload_json,
           updated_at = excluded.updated_at,
           synced_at = excluded.synced_at
         WHERE excluded.updated_at >= cached_reports.updated_at`,
        [ownerId, DASHBOARD_KEY, JSON.stringify(dashboard), dashboard.updated_at, syncedAt],
      )
      await new SyncStateRepository(transaction).upsert(ownerId, DASHBOARD_KEY, {
        lastSyncedAt: syncedAt,
        status: 'success',
      })
    })
  }

  async saveOrders(ownerId: string, orders: Order[], syncedAt = new Date().toISOString()) {
    await this.database.transaction(async (transaction) => {
      const repository = new OrderRepository(transaction)
      for (const order of orders) await repository.upsert(ownerId, order, syncedAt)
      await new SyncStateRepository(transaction).upsert(ownerId, 'shop:orders', {
        lastSyncedAt: syncedAt,
        status: 'success',
      })
    })
  }

  async saveProducts(ownerId: string, products: Product[], syncedAt = new Date().toISOString()) {
    await this.database.transaction(async (transaction) => {
      const repository = new ProductRepository(transaction)
      for (const product of products) await repository.upsert(ownerId, product, syncedAt)
      await new SyncStateRepository(transaction).upsert(ownerId, 'shop:products', {
        lastSyncedAt: syncedAt,
        status: 'success',
      })
    })
  }

  getSyncState(ownerId: string, dataset: string) {
    return new SyncStateRepository(this.database).get(ownerId, dataset)
  }

  async clear(ownerId: string) {
    await this.database.transaction(async (transaction) => {
      await transaction.run('DELETE FROM cached_orders WHERE owner_id = ?', [ownerId])
      await transaction.run('DELETE FROM cached_products WHERE owner_id = ?', [ownerId])
      await transaction.run(
        "DELETE FROM cached_reports WHERE owner_id = ? AND report_key LIKE 'shop:%'",
        [ownerId],
      )
      await transaction.run("DELETE FROM sync_state WHERE owner_id = ? AND dataset LIKE 'shop:%'", [
        ownerId,
      ])
    })
  }
}
