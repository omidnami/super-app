import { useState, type ReactNode } from 'react'
import type { ShopApi } from '@superapp/api-client'
import type { Order, Product, ShopDashboard } from '@superapp/chat-contracts'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_OPTIONS,
  useShop,
  type ShopCache,
  type ShopResource,
} from '@superapp/shop'
import { useTheme } from '@superapp/theme'
import { formatPersianDate } from '../src/format'
import {
  Badge,
  Button,
  Card,
  MoneyText,
  PersianDateText,
  SearchBar,
  Select,
  Tabs,
} from './primitives'
import { EmptyState, ErrorState, OfflineBanner, Skeleton, SyncStatusBar } from './feedback'
import { InfiniteList } from './lists'

export interface ShopScreenProps {
  api: ShopApi
  ownerId: string
  accessToken?: string
  cache?: ShopCache
  isOnline?: boolean
  canRead: boolean
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <span className="shop-metric-label" style={{ color: tokens.color.textTertiary }}>
        {label}
      </span>
      <strong style={{ color: tokens.color.textPrimary }}>{value}</strong>
    </Card>
  )
}

export function InventoryBadge({ quantity }: { quantity: number }) {
  return (
    <Badge
      label={`موجودی: ${quantity.toLocaleString('fa-IR')}`}
      tone={quantity <= 3 ? 'danger' : quantity <= 5 ? 'warning' : 'success'}
    />
  )
}

export function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const { tokens } = useTheme()
  return (
    <Card onPress={onPress} accessibilityLabel={`جزئیات سفارش ${order.code}`}>
      <div className="shop-card">
        <div className="shop-row">
          <strong style={{ color: tokens.color.textPrimary }}>{order.code}</strong>
          <Badge label={ORDER_STATUS_LABELS[order.status]} tone="primary" />
        </div>
        <span style={{ color: tokens.color.textSecondary }}>{order.customer_name}</span>
        <div className="shop-row">
          <MoneyText amount={order.total.amount} currency={order.total.currency} />
          <PersianDateText value={order.created_at} />
        </div>
        <span className="shop-caption" style={{ color: tokens.color.textTertiary }}>
          {PAYMENT_STATUS_LABELS[order.payment_status]}
        </span>
      </div>
    </Card>
  )
}

export function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { tokens } = useTheme()
  return (
    <Card onPress={onPress} accessibilityLabel={`جزئیات محصول ${product.title}`}>
      <div className="shop-card">
        <div className="shop-row">
          <strong style={{ color: tokens.color.textPrimary }}>{product.title}</strong>
          <InventoryBadge quantity={product.inventory_quantity} />
        </div>
        <div className="shop-row">
          <MoneyText amount={product.price.amount} currency={product.price.currency} />
          <Badge label={PRODUCT_STATUS_LABELS[product.status]} />
        </div>
      </div>
    </Card>
  )
}

function ResourceState<T>({
  resource,
  onRetry,
  children,
}: {
  resource: ShopResource<T>
  onRetry: () => void
  children: (data: T) => ReactNode
}) {
  if (resource.status === 'loading' || resource.status === 'idle') {
    return (
      <div className="shop-loading">
        <Skeleton width="60%" height={24} />
        <Skeleton width="100%" height={80} />
        <Skeleton width="100%" height={80} />
      </div>
    )
  }
  if (resource.status === 'error') {
    return <ErrorState message={resource.error || 'دریافت داده ناموفق بود.'} onRetry={onRetry} />
  }
  if (!resource.data) return null
  return <>{children(resource.data)}</>
}

function ShopSyncStatus({
  resource,
  onRetry,
}: {
  resource: ShopResource<unknown>
  onRetry: () => void
}) {
  const { tokens } = useTheme()
  const status =
    resource.status === 'loading' || resource.status === 'idle'
      ? 'syncing'
      : resource.status === 'error'
        ? 'error'
        : resource.dataSource === 'cache'
          ? 'stale'
          : 'success'
  return (
    <div className="shop-sync" style={{ gap: tokens.spacing.xs }}>
      <SyncStatusBar
        status={status}
        lastSyncedAt={resource.lastSyncedAt || undefined}
        onPress={onRetry}
      />
      {resource.dataSource === 'cache' ? <Badge label="داده قدیمی" tone="warning" /> : null}
    </div>
  )
}

function ShopDashboard({
  resource,
  onRetry,
}: {
  resource: ShopResource<ShopDashboard>
  onRetry: () => void
}) {
  return (
    <ResourceState resource={resource} onRetry={onRetry}>
      {(data) => (
        <div className="shop-metrics">
          <MetricCard
            label="فروش امروز"
            value={`${data.today_sales.amount.toLocaleString('fa-IR')} تومان`}
          />
          <MetricCard label="سفارش‌های امروز" value={data.today_orders.toLocaleString('fa-IR')} />
          <MetricCard
            label="سفارش‌های در انتظار"
            value={data.pending_orders.toLocaleString('fa-IR')}
          />
          <MetricCard label="کم‌موجودی" value={data.low_stock_products.toLocaleString('fa-IR')} />
        </div>
      )}
    </ResourceState>
  )
}

function OrderList({ shop }: { shop: ReturnType<typeof useShop> }) {
  const { tokens } = useTheme()
  return (
    <div className="shop-list" style={{ gap: tokens.spacing.sm }}>
      <SearchBar
        value={shop.orderFilters.search || ''}
        onChangeText={(search) => shop.setOrderFilters({ search })}
        placeholder="جستجوی کد یا مشتری..."
      />
      <Select
        label="وضعیت سفارش"
        value={shop.orderFilters.status || ''}
        options={ORDER_STATUS_OPTIONS}
        placeholder="همه وضعیت‌ها"
        onChange={(status) =>
          shop.setOrderFilters({ status: (status || undefined) as Order['status'] | undefined })
        }
      />
      <ResourceState resource={shop.orders} onRetry={() => void shop.refreshOrders()}>
        {(page) =>
          page.items.length === 0 ? (
            <EmptyState title="سفارشی پیدا نشد" description="فیلتر یا جستجو را تغییر دهید." />
          ) : (
            <InfiniteList
              items={page.items}
              keyExtractor={(order) => order.id}
              accessibilityLabel="فهرست سفارش‌ها"
              renderItem={(order) => (
                <div className="shop-item">
                  <OrderCard order={order} onPress={() => void shop.openOrder(order.id)} />
                </div>
              )}
              hasMore={page.has_more}
              onEndReached={() => void shop.loadMoreOrders()}
            />
          )
        }
      </ResourceState>
      {shop.orders.error && shop.orders.data ? (
        <ErrorState message={shop.orders.error} onRetry={() => void shop.refreshOrders()} />
      ) : null}
    </div>
  )
}

function ProductList({ shop }: { shop: ReturnType<typeof useShop> }) {
  const { tokens } = useTheme()
  return (
    <div className="shop-list" style={{ gap: tokens.spacing.sm }}>
      <SearchBar
        value={shop.productFilters.search || ''}
        onChangeText={(search) => shop.setProductFilters({ search })}
        placeholder="جستجوی نام یا Slug..."
      />
      <Select
        label="وضعیت محصول"
        value={shop.productFilters.status || ''}
        options={PRODUCT_STATUS_OPTIONS}
        placeholder="همه وضعیت‌ها"
        onChange={(status) =>
          shop.setProductFilters({ status: (status || undefined) as Product['status'] | undefined })
        }
      />
      <ResourceState resource={shop.products} onRetry={() => void shop.refreshProducts()}>
        {(page) =>
          page.items.length === 0 ? (
            <EmptyState title="محصولی پیدا نشد" description="فیلتر یا جستجو را تغییر دهید." />
          ) : (
            <InfiniteList
              items={page.items}
              keyExtractor={(product) => product.id}
              accessibilityLabel="فهرست محصولات"
              renderItem={(product) => (
                <div className="shop-item">
                  <ProductCard
                    product={product}
                    onPress={() => void shop.openProduct(product.id)}
                  />
                </div>
              )}
              hasMore={page.has_more}
              onEndReached={() => void shop.loadMoreProducts()}
            />
          )
        }
      </ResourceState>
      {shop.products.error && shop.products.data ? (
        <ErrorState message={shop.products.error} onRetry={() => void shop.refreshProducts()} />
      ) : null}
    </div>
  )
}

function OrderDetail({ order }: { order: Order }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <div className="shop-detail">
        <h2 style={{ color: tokens.color.textPrimary }}>{order.code}</h2>
        <span style={{ color: tokens.color.textSecondary }}>{order.customer_name}</span>
        <div className="shop-row">
          <MoneyText amount={order.total.amount} currency={order.total.currency} />
          <Badge label={ORDER_STATUS_LABELS[order.status]} tone="primary" />
        </div>
        <Badge label={PAYMENT_STATUS_LABELS[order.payment_status]} />
        <span className="shop-caption" style={{ color: tokens.color.textTertiary }}>
          ثبت: {formatPersianDate(order.created_at)} · به‌روزرسانی:{' '}
          {formatPersianDate(order.updated_at)}
        </span>
        {order.lines.map((line) => (
          <div key={`${line.product_id}-${line.variant_title}`} className="shop-line">
            <strong style={{ color: tokens.color.textPrimary }}>
              {line.title} · {line.variant_title}
            </strong>
            <span style={{ color: tokens.color.textTertiary }}>
              {line.quantity.toLocaleString('fa-IR')} ×{' '}
              {line.unit_price.amount.toLocaleString('fa-IR')} تومان
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function ProductDetail({ product }: { product: Product }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <div className="shop-detail">
        <h2 style={{ color: tokens.color.textPrimary }}>{product.title}</h2>
        <div className="shop-row">
          <MoneyText amount={product.price.amount} currency={product.price.currency} />
          <InventoryBadge quantity={product.inventory_quantity} />
        </div>
        <span className="shop-caption" style={{ color: tokens.color.textTertiary }}>
          {product.slug} · به‌روزرسانی {formatPersianDate(product.updated_at)}
        </span>
        {product.variants.map((variant) => (
          <div key={variant.id} className="shop-line">
            <strong style={{ color: tokens.color.textPrimary }}>{variant.title}</strong>
            <MoneyText amount={variant.price.amount} currency={variant.price.currency} />
            <span style={{ color: tokens.color.textTertiary }}>
              {variant.sku} · {variant.inventory_quantity.toLocaleString('fa-IR')} عدد
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function ShopScreen({
  api,
  ownerId,
  accessToken,
  cache,
  isOnline = true,
  canRead,
}: ShopScreenProps) {
  const { tokens } = useTheme()
  const [tab, setTab] = useState<'dashboard' | 'orders' | 'products'>('dashboard')
  const shop = useShop({ api, ownerId, accessToken, cache, isOnline, enabled: canRead })
  const resource =
    tab === 'dashboard' ? shop.dashboard : tab === 'orders' ? shop.orders : shop.products
  const retryDetail = () => {
    if (shop.detail.kind === 'order' && shop.detail.id) void shop.openOrder(shop.detail.id)
    if (shop.detail.kind === 'product' && shop.detail.id) void shop.openProduct(shop.detail.id)
  }

  if (!canRead) {
    return (
      <ErrorState title="دسترسی مجاز نیست" message="مجوز shop.read برای مشاهده فروشگاه لازم است." />
    )
  }

  if (shop.detail.kind) {
    return (
      <section
        className="shop-screen"
        style={{ gap: tokens.spacing.md }}
        aria-label="جزئیات فروشگاه"
      >
        <Button label="بازگشت به فروشگاه" variant="secondary" onPress={shop.closeDetail} />
        <ShopSyncStatus resource={shop.detail} onRetry={retryDetail} />
        <OfflineBanner
          visible={!isOnline && shop.detail.dataSource === 'cache'}
          onRetry={retryDetail}
        />
        {shop.detail.status === 'loading' ? (
          <Skeleton width="100%" height={180} />
        ) : shop.detail.status === 'error' ? (
          <ErrorState message={shop.detail.error || 'دریافت جزئیات ناموفق بود.'} />
        ) : shop.detail.kind === 'order' && shop.detail.data ? (
          <OrderDetail order={shop.detail.data as Order} />
        ) : shop.detail.kind === 'product' && shop.detail.data ? (
          <ProductDetail product={shop.detail.data as Product} />
        ) : (
          <EmptyState title="موردی پیدا نشد" />
        )}
      </section>
    )
  }

  return (
    <section
      className="shop-screen"
      style={{ gap: tokens.spacing.md }}
      aria-label="فروشگاه فقط‌خواندنی"
    >
      <header className="shop-header">
        <div>
          <h2>فروشگاه</h2>
          <span style={{ color: tokens.color.textTertiary }}>فقط‌خواندنی</span>
        </div>
        <Badge label="بدون عملیات نوشتن" tone="neutral" />
        <Button
          label="به‌روزرسانی"
          variant="secondary"
          size="sm"
          onPress={() => void shop.refreshAll()}
        />
      </header>
      <ShopSyncStatus resource={resource} onRetry={() => void shop.refreshAll()} />
      <OfflineBanner
        visible={!isOnline && resource.dataSource === 'cache'}
        onRetry={() => void shop.refreshAll()}
      />
      <Tabs
        items={[
          { value: 'dashboard', label: 'داشبورد' },
          { value: 'orders', label: 'سفارش‌ها' },
          { value: 'products', label: 'محصولات' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'dashboard' ? (
        <ShopDashboard resource={shop.dashboard} onRetry={() => void shop.refreshDashboard()} />
      ) : tab === 'orders' ? (
        <OrderList shop={shop} />
      ) : (
        <ProductList shop={shop} />
      )}
    </section>
  )
}
