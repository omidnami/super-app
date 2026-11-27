import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { AccountingApi } from '@superapp/api-client'
import type { AccountingDashboard, AccountingDocument } from '@superapp/chat-contracts'
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_OPTIONS,
  useAccounting,
  type AccountingCache,
  type AccountingResource,
} from '@superapp/accounting'
import { useTheme } from '@superapp/theme'
import {
  Badge,
  Button,
  Card,
  MoneyText,
  PersianDateText,
  SearchBar,
  Select,
  Tabs,
  TextField,
} from './primitives'
import { EmptyState, ErrorState, OfflineBanner, Skeleton, SyncStatusBar } from './feedback'
import { InfiniteList } from './lists'
import { StaleDataBadge } from './chat'
import { MetricCard } from './shop'

export interface AccountingScreenProps {
  api: AccountingApi
  ownerId: string
  accessToken?: string
  cache?: AccountingCache
  isOnline?: boolean
  canRead: boolean
}

function ResourceState<T>({
  resource,
  onRetry,
  children,
}: {
  resource: AccountingResource<T>
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
    return (
      <ErrorState message={resource.error || 'دریافت داده مالی ناموفق بود.'} onRetry={onRetry} />
    )
  }
  if (!resource.data) return null
  return <>{children(resource.data)}</>
}

function AccountingSyncStatus({
  resource,
  onRetry,
}: {
  resource: AccountingResource<unknown>
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
      <StaleDataBadge stale={resource.dataSource === 'cache'} />
    </View>
  )
}

function dateError(value?: string) {
  if (!value) return undefined
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    return 'تاریخ باید با قالب YYYY-MM-DD باشد.'
  }
  return undefined
}

function DocumentFilters({ accounting }: { accounting: ReturnType<typeof useAccounting> }) {
  const { filters } = accounting
  const fromError = dateError(filters.issued_from)
  const toError = dateError(filters.issued_to)
  const rangeError =
    !fromError && !toError && filters.issued_from && filters.issued_to
      ? filters.issued_from > filters.issued_to
        ? 'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.'
        : undefined
      : undefined
  return (
    <View style={{ gap: 8 }}>
      <SearchBar
        value={filters.search || ''}
        onChangeText={(search) => accounting.setFilters({ search })}
        placeholder="جستجوی کد، طرف حساب یا توضیح..."
      />
      <View style={styles.filterRow}>
        <View style={styles.filterItem}>
          <Select
            label="نوع سند"
            value={filters.type || ''}
            options={DOCUMENT_TYPE_OPTIONS}
            placeholder="همه انواع"
            onChange={(type) =>
              accounting.setFilters({
                type: (type || undefined) as AccountingDocument['type'] | undefined,
              })
            }
          />
        </View>
        <View style={styles.filterItem}>
          <Select
            label="وضعیت سند"
            value={filters.status || ''}
            options={DOCUMENT_STATUS_OPTIONS}
            placeholder="همه وضعیت‌ها"
            onChange={(status) =>
              accounting.setFilters({
                status: (status || undefined) as AccountingDocument['status'] | undefined,
              })
            }
          />
        </View>
      </View>
      <View style={styles.filterRow}>
        <View style={styles.filterItem}>
          <TextField
            label="از تاریخ"
            value={filters.issued_from || ''}
            onChangeText={(issued_from) => accounting.setFilters({ issued_from })}
            placeholder="YYYY-MM-DD"
            error={fromError || rangeError}
          />
        </View>
        <View style={styles.filterItem}>
          <TextField
            label="تا تاریخ"
            value={filters.issued_to || ''}
            onChangeText={(issued_to) => accounting.setFilters({ issued_to })}
            placeholder="YYYY-MM-DD"
            error={toError || rangeError}
          />
        </View>
      </View>
    </View>
  )
}

export function AccountingDocumentCard({
  document,
  onPress,
}: {
  document: AccountingDocument
  onPress: () => void
}) {
  const { tokens } = useTheme()
  return (
    <Card onPress={onPress} accessibilityLabel={`جزئیات سند ${document.code}`}>
      <View style={styles.rowBetween}>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          {document.code}
        </Text>
        <Badge
          label={DOCUMENT_STATUS_LABELS[document.status]}
          tone={
            document.status === 'confirmed'
              ? 'success'
              : document.status === 'cancelled'
                ? 'danger'
                : 'warning'
          }
        />
      </View>
      <Text style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}>
        {document.counterparty_name}
      </Text>
      <View style={styles.rowBetween}>
        <MoneyText amount={document.total.amount} currency={document.total.currency} />
        <PersianDateText value={document.issued_at} />
      </View>
      <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
        {DOCUMENT_TYPE_LABELS[document.type]}
      </Text>
    </Card>
  )
}

export const InvoiceCard = AccountingDocumentCard

export function TransactionList({
  documents,
  onPress,
}: {
  documents: AccountingDocument[]
  onPress: (document: AccountingDocument) => void
}) {
  const { tokens } = useTheme()
  if (documents.length === 0) {
    return <EmptyState title="تراکنشی پیدا نشد" description="بازه یا فیلتر را تغییر دهید." />
  }
  return (
    <View accessibilityLabel="فهرست تراکنش‌های مالی" style={{ gap: 8 }}>
      {documents.map((document) => (
        <Card
          key={document.id}
          onPress={() => onPress(document)}
          accessibilityLabel={`تراکنش ${document.code}`}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...tokens.typography.body, color: tokens.color.textPrimary }}>
                {document.code} · {DOCUMENT_TYPE_LABELS[document.type]}
              </Text>
              <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
                {document.counterparty_name}
              </Text>
            </View>
            <MoneyText amount={document.total.amount} currency={document.total.currency} />
          </View>
          <PersianDateText value={document.issued_at} />
        </Card>
      ))}
    </View>
  )
}

export function ReportTable({
  rows,
}: {
  rows: import('@superapp/accounting').AccountingReportRow[]
}) {
  const { tokens } = useTheme()
  return (
    <View accessibilityLabel="جدول گزارش مالی" style={{ gap: 8 }}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textSecondary, flex: 1 }}>
          نوع سند
        </Text>
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textSecondary }}>
          تعداد
        </Text>
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textSecondary }}>
          جمع مبلغ
        </Text>
      </View>
      {rows.map((row) => (
        <View key={row.type} style={styles.tableRow}>
          <Text style={{ ...tokens.typography.body, color: tokens.color.textPrimary, flex: 1 }}>
            {DOCUMENT_TYPE_LABELS[row.type]}
          </Text>
          <Text style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}>
            {row.count.toLocaleString('fa-IR')}
          </Text>
          <MoneyText amount={row.total.amount} currency={row.total.currency} />
        </View>
      ))}
    </View>
  )
}

function AccountingDashboard({
  resource,
  onRetry,
}: {
  resource: AccountingResource<AccountingDashboard>
  onRetry: () => void
}) {
  const { tokens } = useTheme()
  return (
    <ResourceState resource={resource} onRetry={onRetry}>
      {(data) => (
        <View style={{ gap: 12 }}>
          <View style={styles.metrics}>
            <MetricCard
              label="مبلغ قابل دریافت"
              value={
                <MoneyText
                  amount={data.total_receivable.amount}
                  currency={data.total_receivable.currency}
                />
              }
            />
            <MetricCard
              label="مبلغ قابل پرداخت"
              value={
                <MoneyText
                  amount={data.total_payable.amount}
                  currency={data.total_payable.currency}
                />
              }
            />
            <MetricCard
              label="مانده فعلی"
              value={
                <MoneyText
                  amount={data.current_balance.amount}
                  currency={data.current_balance.currency}
                />
              }
            />
            <MetricCard label="تعداد اسناد" value={data.documents_count.toLocaleString('fa-IR')} />
          </View>
          <Card>
            <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
              مانده حساب‌ها
            </Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {data.balances.map((balance) => (
                <View key={balance.account_id} style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...tokens.typography.body, color: tokens.color.textPrimary }}>
                      {balance.title}
                    </Text>
                    <PersianDateText value={balance.updated_at} />
                  </View>
                  <MoneyText amount={balance.balance.amount} currency={balance.balance.currency} />
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}
    </ResourceState>
  )
}

function DocumentList({ accounting }: { accounting: ReturnType<typeof useAccounting> }) {
  const { tokens } = useTheme()
  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <DocumentFilters accounting={accounting} />
      <ResourceState
        resource={accounting.documents}
        onRetry={() => void accounting.refreshDocuments()}
      >
        {(page) =>
          page.items.length === 0 ? (
            <EmptyState title="سندی پیدا نشد" description="بازه، نوع یا جستجو را تغییر دهید." />
          ) : (
            <InfiniteList
              items={page.items}
              keyExtractor={(document) => document.id}
              accessibilityLabel="فهرست اسناد مالی"
              renderItem={(document) => (
                <View style={{ marginBottom: tokens.spacing.sm }}>
                  <AccountingDocumentCard
                    document={document}
                    onPress={() => void accounting.openDocument(document.id)}
                  />
                </View>
              )}
              hasMore={page.has_more}
              onEndReached={() => void accounting.loadMoreDocuments()}
            />
          )
        }
      </ResourceState>
      {accounting.documents.error && accounting.documents.data ? (
        <ErrorState
          message={accounting.documents.error}
          onRetry={() => void accounting.refreshDocuments()}
        />
      ) : null}
    </View>
  )
}

function FinancialReport({ accounting }: { accounting: ReturnType<typeof useAccounting> }) {
  const { tokens } = useTheme()
  return (
    <View style={{ gap: 12 }}>
      <DocumentFilters accounting={accounting} />
      <ResourceState resource={accounting.report} onRetry={() => void accounting.refreshReport()}>
        {(report) => (
          <View style={{ gap: 12 }}>
            <ReportTable rows={report.rows} />
            <View style={styles.rowBetween}>
              <Text style={{ color: tokens.color.textTertiary }}>زمان تهیه گزارش</Text>
              <PersianDateText value={report.generatedAt} />
            </View>
            <TransactionList
              documents={report.items}
              onPress={(document) => void accounting.openDocument(document.id)}
            />
          </View>
        )}
      </ResourceState>
    </View>
  )
}

function DocumentDetail({ document }: { document: AccountingDocument }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <View style={{ gap: tokens.spacing.sm }}>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          {document.code}
        </Text>
        <View style={styles.rowBetween}>
          <Badge label={DOCUMENT_TYPE_LABELS[document.type]} tone="primary" />
          <Badge
            label={DOCUMENT_STATUS_LABELS[document.status]}
            tone={
              document.status === 'confirmed'
                ? 'success'
                : document.status === 'cancelled'
                  ? 'danger'
                  : 'warning'
            }
          />
        </View>
        <Text style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}>
          {document.counterparty_name}
        </Text>
        <MoneyText amount={document.total.amount} currency={document.total.currency} />
        <View style={styles.rowBetween}>
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
            صدور
          </Text>
          <PersianDateText value={document.issued_at} />
        </View>
        <View style={styles.rowBetween}>
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
            به‌روزرسانی
          </Text>
          <PersianDateText value={document.updated_at} />
        </View>
        <Text style={{ ...tokens.typography.body, color: tokens.color.textPrimary }}>
          {document.description}
        </Text>
      </View>
    </Card>
  )
}

export function AccountingScreen({
  api,
  ownerId,
  accessToken,
  cache,
  isOnline = true,
  canRead,
}: AccountingScreenProps) {
  const { tokens } = useTheme()
  const [tab, setTab] = useState<'dashboard' | 'documents' | 'report'>('dashboard')
  const accounting = useAccounting({ api, ownerId, accessToken, cache, isOnline, enabled: canRead })
  const { refreshReport } = accounting
  const resource =
    tab === 'dashboard'
      ? accounting.dashboard
      : tab === 'documents'
        ? accounting.documents
        : accounting.report
  const refreshActive = () => {
    if (tab === 'dashboard') return accounting.refreshDashboard()
    if (tab === 'documents') return accounting.refreshDocuments()
    return accounting.refreshReport()
  }
  const retryDetail = () => {
    if (accounting.detail.id) void accounting.openDocument(accounting.detail.id)
  }

  useEffect(() => {
    if (tab === 'report') void refreshReport()
  }, [refreshReport, tab])

  if (!canRead) {
    return (
      <ErrorState
        title="دسترسی مالی مجاز نیست"
        message="مجوز accounting.read برای مشاهده داده‌های مالی لازم است."
      />
    )
  }

  if (accounting.detail.id) {
    return (
      <View style={{ gap: tokens.spacing.md }}>
        <Button label="بازگشت به حسابداری" variant="secondary" onPress={accounting.closeDetail} />
        <AccountingSyncStatus resource={accounting.detail} onRetry={retryDetail} />
        <OfflineBanner
          visible={!isOnline && accounting.detail.dataSource === 'cache'}
          onRetry={retryDetail}
        />
        {accounting.detail.status === 'loading' ? (
          <Skeleton width="100%" height={180} />
        ) : accounting.detail.status === 'error' ? (
          <ErrorState
            message={accounting.detail.error || 'دریافت سند مالی ناموفق بود.'}
            onRetry={retryDetail}
          />
        ) : accounting.detail.data ? (
          <DocumentDetail document={accounting.detail.data} />
        ) : (
          <EmptyState title="سندی پیدا نشد" />
        )}
      </View>
    )
  }

  return (
    <View style={{ gap: tokens.spacing.md }}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
            حسابداری
          </Text>
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
            داده مالی فقط‌خواندنی
          </Text>
        </View>
        <Badge label="بدون عملیات نوشتن" tone="neutral" />
        <Button
          label="به‌روزرسانی"
          variant="secondary"
          size="sm"
          onPress={() => void refreshActive()}
        />
      </View>
      <AccountingSyncStatus resource={resource} onRetry={() => void refreshActive()} />
      <OfflineBanner
        visible={!isOnline && resource.dataSource === 'cache'}
        onRetry={() => void refreshActive()}
      />
      <Tabs
        items={[
          { value: 'dashboard', label: 'داشبورد' },
          { value: 'documents', label: 'اسناد' },
          { value: 'report', label: 'گزارش' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'dashboard' ? (
        <AccountingDashboard
          resource={accounting.dashboard}
          onRetry={() => void accounting.refreshDashboard()}
        />
      ) : tab === 'documents' ? (
        <DocumentList accounting={accounting} />
      ) : (
        <FinancialReport accounting={accounting} />
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
  filterRow: { flexDirection: 'row', gap: 8 },
  filterItem: { flex: 1 },
  metrics: { gap: 12 },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tableHeader: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
})
