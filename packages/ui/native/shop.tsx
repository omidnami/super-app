import { useState, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
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

export function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
        {label}
      </Text>
      <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary, marginTop: 4 }}>
        {value}
      </Text>
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
      <View style={styles.rowBetween}>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          {order.code}
        </Text>
        <Badge label={ORDER_STATUS_LABELS[order.status]} tone="primary" />
      </View>
      <Text style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}>
        {order.customer_name}
      </Text>
      <View style={styles.rowBetween}>
        <MoneyText amount={order.total.amount} currency={order.total.currency} />
        <PersianDateText value={order.created_at} />
      </View>
      <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
        {PAYMENT_STATUS_LABELS[order.payment_status]}
      </Text>
    </Card>
  )
}

export function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { tokens } = useTheme()
  return (
    <Card onPress={onPress} accessibilityLabel={`جزئیات محصول ${product.title}`}>
      <View style={styles.rowBetween}>
        <Text
          numberOfLines={2}
          style={{ ...tokens.typography.title, color: tokens.color.textPrimary, flex: 1 }}
        >
          {product.title}
        </Text>
        <InventoryBadge quantity={product.inventory_quantity} />
      </View>
      <View style={styles.rowBetween}>
        <MoneyText amount={product.price.amount} currency={product.price.currency} />
        <Badge label={PRODUCT_STATUS_LABELS[product.status]} />
      </View>
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
      <View style={{ gap: 12 }}>
        <Skeleton width="60%" height={24} />
        <Skeleton width="100%" height={80} />
        <Skeleton width="100%" height={80} />
      </View>
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
    <View style={{ gap: tokens.spacing.xs }}>
      <SyncStatusBar
        status={status}
        lastSyncedAt={resource.lastSyncedAt || undefined}
        onPress={onRetry}
      />
      {resource.dataSource === 'cache' ? <Badge label="داده قدیمی" tone="warning" /> : null}
    </View>
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
        <View style={styles.metrics}>
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
        </View>
      )}
    </ResourceState>
  )
}

function OrderList({ shop }: { shop: ReturnType<typeof useShop> }) {
  const { tokens } = useTheme()
  return (
    <View style={{ gap: tokens.spacing.sm }}>
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
                <View style={{ marginBottom: tokens.spacing.sm }}>
                  <OrderCard order={order} onPress={() => void shop.openOrder(order.id)} />
                </View>
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
    </View>
  )
}

function ProductList({ shop }: { shop: ReturnType<typeof useShop> }) {
  const { tokens } = useTheme()
  return (
    <View style={{ gap: tokens.spacing.sm }}>
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
                <View style={{ marginBottom: tokens.spacing.sm }}>
                  <ProductCard
                    product={product}
                    onPress={() => void shop.openProduct(product.id)}
                  />
                </View>
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
    </View>
  )
}

function OrderDetail({ order }: { order: Order }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <View style={{ gap: tokens.spacing.sm }}>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          {order.code}
        </Text>
        <Text style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}>
          {order.customer_name}
        </Text>
        <View style={styles.rowBetween}>
          <MoneyText amount={order.total.amount} currency={order.total.currency} />
          <Badge label={ORDER_STATUS_LABELS[order.status]} tone="primary" />
        </View>
        <Badge label={PAYMENT_STATUS_LABELS[order.payment_status]} />
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
          ثبت: {formatPersianDate(order.created_at)} · به‌روزرسانی:{' '}
          {formatPersianDate(order.updated_at)}
        </Text>
        {order.lines.map((line) => (
          <View key={`${line.product_id}-${line.variant_title}`} style={styles.line}>
            <Text style={{ ...tokens.typography.body, color: tokens.color.textPrimary }}>
              {line.title} · {line.variant_title}
            </Text>
            <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
              {line.quantity.toLocaleString('fa-IR')} ×{' '}
              {line.unit_price.amount.toLocaleString('fa-IR')} تومان
            </Text>
          </View>
        ))}
      </View>
    </Card>
  )
}

function ProductDetail({ product }: { product: Product }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <View style={{ gap: tokens.spacing.sm }}>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          {product.title}
        </Text>
        <View style={styles.rowBetween}>
          <MoneyText amount={product.price.amount} currency={product.price.currency} />
          <InventoryBadge quantity={product.inventory_quantity} />
        </View>
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
          {product.slug} · به‌روزرسانی {formatPersianDate(product.updated_at)}
        </Text>
        {product.variants.map((variant) => (
          <View key={variant.id} style={styles.line}>
            <Text style={{ ...tokens.typography.body, color: tokens.color.textPrimary }}>
              {variant.title}
            </Text>
            <MoneyText amount={variant.price.amount} currency={variant.price.currency} />
            <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
              {variant.sku} · {variant.inventory_quantity.toLocaleString('fa-IR')} عدد
            </Text>
          </View>
        ))}
      </View>
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
      <View style={{ gap: tokens.spacing.md }}>
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
      </View>
    )
  }

  return (
    <View style={{ gap: tokens.spacing.md }}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
            فروشگاه
          </Text>
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
            فقط‌خواندنی
          </Text>
        </View>
        <Badge label="بدون عملیات نوشتن" tone="neutral" />
        <Button
          label="به‌روزرسانی"
          variant="secondary"
          size="sm"
          onPress={() => void shop.refreshAll()}
        />
      </View>
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
    </View>
  )
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metrics: { gap: 12 },
  line: { gap: 4, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
})
