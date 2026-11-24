import type { CursorPageQuery, EntityId, ISODateTime, Nullable, Paginated } from './common'

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface Money {
  amount: number
  currency: 'IRR'
}

export interface OrderLine {
  product_id: EntityId
  title: string
  variant_title: string
  quantity: number
  unit_price: Money
}

export interface Order {
  id: EntityId
  code: string
  customer_name: string
  status: OrderStatus
  payment_status: PaymentStatus
  total: Money
  created_at: ISODateTime
  updated_at: ISODateTime
  deleted_at: Nullable<ISODateTime>
  lines: OrderLine[]
}

export interface ProductVariant {
  id: EntityId
  title: string
  sku: string
  price: Money
  inventory_quantity: number
}

export interface Product {
  id: EntityId
  title: string
  slug: string
  status: 'active' | 'draft' | 'archived'
  price: Money
  inventory_quantity: number
  variants: ProductVariant[]
  updated_at: ISODateTime
  deleted_at: Nullable<ISODateTime>
}

export interface OrderListQuery extends CursorPageQuery {
  search?: string
  status?: OrderStatus
}

export interface ProductListQuery extends CursorPageQuery {
  search?: string
  status?: Product['status']
}

export interface ShopDashboard {
  today_sales: Money
  today_orders: number
  pending_orders: number
  low_stock_products: number
  updated_at: ISODateTime
}

export type OrderPage = Paginated<Order>
export type ProductPage = Paginated<Product>
