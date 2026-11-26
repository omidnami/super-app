// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Order, Product, ShopDashboard } from '@superapp/chat-contracts'
import type { LocalDatabase, SqlValue } from '@superapp/local-db'
import { runMigrations } from '@superapp/local-db/migrate'
import { OrderRepository, ProductRepository } from '@superapp/local-db/repositories'
import { ShopRepository } from '@superapp/local-db/shop-repository'

class NodeSqliteDatabase implements LocalDatabase {
  private readonly database = new DatabaseSync(':memory:')
  async exec(sql: string) {
    this.database.exec(sql)
  }
  async all<T>(sql: string, params: SqlValue[] = []) {
    return this.database.prepare(sql).all(...params) as T[]
  }
  async get<T>(sql: string, params: SqlValue[] = []) {
    return (this.database.prepare(sql).get(...params) as T | undefined) ?? null
  }
  async run(sql: string, params: SqlValue[] = []) {
    this.database.prepare(sql).run(...params)
  }
  async transaction<T>(task: (database: LocalDatabase) => Promise<T>) {
    this.database.exec('BEGIN')
    try {
      const result = await task(this)
      this.database.exec('COMMIT')
      return result
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }
  async close() {
    this.database.close()
  }
}

const dashboard: ShopDashboard = {
  today_sales: { amount: 1000, currency: 'IRR' },
  today_orders: 1,
  pending_orders: 0,
  low_stock_products: 1,
  updated_at: '2026-11-26T10:00:00.000Z',
}
const order: Order = {
  id: 'ord_1',
  code: 'ORD-1',
  customer_name: 'مشتری',
  status: 'paid',
  payment_status: 'paid',
  total: { amount: 1000, currency: 'IRR' },
  created_at: '2026-11-26T09:00:00.000Z',
  updated_at: '2026-11-26T10:00:00.000Z',
  deleted_at: null,
  lines: [],
}
const product: Product = {
  id: 'prd_1',
  title: 'محصول',
  slug: 'product',
  status: 'active',
  price: { amount: 1000, currency: 'IRR' },
  inventory_quantity: 2,
  variants: [],
  updated_at: '2026-11-26T10:00:00.000Z',
  deleted_at: null,
}
const secondOrder: Order = {
  ...order,
  id: 'ord_2',
  code: 'ORD_%',
  customer_name: 'مشتری دوم',
  updated_at: '2026-11-26T09:30:00.000Z',
}
const secondProduct: Product = {
  ...product,
  id: 'prd_2',
  title: 'محصول دوم',
  slug: 'product_2',
  updated_at: '2026-11-26T09:30:00.000Z',
}

let database: NodeSqliteDatabase
beforeEach(async () => {
  database = new NodeSqliteDatabase()
  await runMigrations(database)
})

describe('shop cache repository', () => {
  it('stores dashboard, orders and products for offline filtered reads', async () => {
    const repository = new ShopRepository(database)
    await repository.saveDashboard('scope_1', dashboard, '2026-11-26T10:01:00.000Z')
    await repository.saveOrders('scope_1', [order], '2026-11-26T10:01:00.000Z')
    await repository.saveProducts('scope_1', [product], '2026-11-26T10:01:00.000Z')

    expect(await repository.getDashboard('scope_1')).toEqual(dashboard)
    expect(
      (await new OrderRepository(database).list('scope_1', { search: 'ORD', status: 'paid' }))
        .items,
    ).toEqual([order])
    expect(
      (await new ProductRepository(database).list('scope_1', { search: 'محصول', status: 'active' }))
        .items,
    ).toEqual([product])
    expect(await new OrderRepository(database).get('scope_1', 'ord_1')).toEqual(order)
    expect(await repository.getSyncState('scope_1', 'shop:orders')).toMatchObject({
      last_synced_at: '2026-11-26T10:01:00.000Z',
    })
  })

  it('paginates filtered cache pages and treats SQL wildcard characters literally', async () => {
    const repository = new ShopRepository(database)
    await repository.saveOrders('scope_1', [order, secondOrder])
    await repository.saveProducts('scope_1', [product, secondProduct])
    const orders = new OrderRepository(database)
    const products = new ProductRepository(database)

    const firstOrders = await orders.list('scope_1', { limit: 1, search: ' ORD ' })
    const secondOrders = await orders.list('scope_1', {
      limit: 1,
      search: 'ORD',
      cursor: firstOrders.next_cursor!,
    })
    const firstProducts = await products.list('scope_1', { limit: 1, search: 'محصول' })
    const secondProducts = await products.list('scope_1', {
      limit: 1,
      search: 'محصول',
      cursor: firstProducts.next_cursor!,
    })

    expect(firstOrders.items.map((item) => item.id)).toEqual(['ord_1'])
    expect(secondOrders.items.map((item) => item.id)).toEqual(['ord_2'])
    expect(firstProducts.items.map((item) => item.id)).toEqual(['prd_1'])
    expect(secondProducts.items.map((item) => item.id)).toEqual(['prd_2'])
    expect((await orders.list('scope_1', { search: '%' })).items.map((item) => item.id)).toEqual([
      'ord_2',
    ])
    expect((await products.list('scope_1', { search: '_' })).items.map((item) => item.id)).toEqual([
      'prd_2',
    ])
  })

  it('does not let older payloads replace newer cached entities or dashboard data', async () => {
    const repository = new ShopRepository(database)
    await repository.saveOrders('scope_1', [order])
    await repository.saveProducts('scope_1', [product])
    await repository.saveDashboard('scope_1', dashboard)
    await repository.saveOrders('scope_1', [{ ...secondOrder, id: order.id, code: 'OLD' }])
    await repository.saveProducts('scope_1', [{ ...secondProduct, id: product.id, title: 'قدیمی' }])
    await repository.saveDashboard('scope_1', {
      ...dashboard,
      today_orders: 0,
      updated_at: '2026-11-25T10:00:00.000Z',
    })

    expect(await new OrderRepository(database).get('scope_1', order.id)).toEqual(order)
    expect(await new ProductRepository(database).get('scope_1', product.id)).toEqual(product)
    expect(await repository.getDashboard('scope_1')).toEqual(dashboard)
  })

  it('records a synchronized empty page so offline empty results are not errors', async () => {
    const repository = new ShopRepository(database)
    await repository.saveOrders('scope_1', [], '2026-11-26T10:01:00.000Z')

    expect(await new OrderRepository(database).list('scope_1')).toMatchObject({ items: [] })
    expect(await repository.getSyncState('scope_1', 'shop:orders')).toMatchObject({
      last_synced_at: '2026-11-26T10:01:00.000Z',
      status: 'success',
    })
  })

  it('clears only the signed-out owner scope', async () => {
    const repository = new ShopRepository(database)
    await repository.saveOrders('scope_1', [order])
    await repository.saveOrders('scope_2', [order])
    await repository.saveDashboard('scope_1', dashboard)

    await repository.clear('scope_1')

    expect(await new OrderRepository(database).list('scope_1')).toMatchObject({ items: [] })
    expect(await repository.getDashboard('scope_1')).toBeNull()
    expect(await new OrderRepository(database).list('scope_2')).toMatchObject({ items: [order] })
  })
})
