import { useEffect, useState, type ReactNode } from 'react'
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
      <div className="accounting-loading">
        <Skeleton width="60%" height={24} />
        <Skeleton width="100%" height={80} />
        <Skeleton width="100%" height={80} />
      </div>
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
    <div className="accounting-sync" style={{ gap: tokens.spacing.xs }}>
      <SyncStatusBar
        status={status}
        lastSyncedAt={resource.lastSyncedAt || undefined}
        onPress={onRetry}
      />
      <StaleDataBadge stale={resource.dataSource === 'cache'} />
    </div>
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
    <div className="accounting-filters">
      <SearchBar
        value={filters.search || ''}
        onChangeText={(search) => accounting.setFilters({ search })}
        placeholder="جستجوی کد، طرف حساب یا توضیح..."
      />
      <div className="accounting-filter-row">
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
      </div>
      <div className="accounting-filter-row">
        <TextField
          label="از تاریخ"
          value={filters.issued_from || ''}
          onChangeText={(issued_from) => accounting.setFilters({ issued_from })}
          placeholder="YYYY-MM-DD"
          error={fromError || rangeError}
        />
        <TextField
          label="تا تاریخ"
          value={filters.issued_to || ''}
          onChangeText={(issued_to) => accounting.setFilters({ issued_to })}
          placeholder="YYYY-MM-DD"
          error={toError || rangeError}
        />
      </div>
    </div>
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
      <div className="accounting-card">
        <div className="accounting-row">
          <strong style={{ color: tokens.color.textPrimary }}>{document.code}</strong>
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
        </div>
        <span style={{ color: tokens.color.textSecondary }}>{document.counterparty_name}</span>
        <div className="accounting-row">
          <MoneyText amount={document.total.amount} currency={document.total.currency} />
          <PersianDateText value={document.issued_at} />
        </div>
        <span className="accounting-caption" style={{ color: tokens.color.textTertiary }}>
          {DOCUMENT_TYPE_LABELS[document.type]}
        </span>
      </div>
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
    <div className="accounting-transactions" aria-label="فهرست تراکنش‌های مالی">
      {documents.map((document) => (
        <Card
          key={document.id}
          onPress={() => onPress(document)}
          accessibilityLabel={`تراکنش ${document.code}`}
        >
          <div className="accounting-row">
            <div className="accounting-transaction-copy">
              <strong style={{ color: tokens.color.textPrimary }}>
                {document.code} · {DOCUMENT_TYPE_LABELS[document.type]}
              </strong>
              <span style={{ color: tokens.color.textTertiary }}>{document.counterparty_name}</span>
            </div>
            <MoneyText amount={document.total.amount} currency={document.total.currency} />
          </div>
          <PersianDateText value={document.issued_at} />
        </Card>
      ))}
    </div>
  )
}

export function ReportTable({
  rows,
}: {
  rows: import('@superapp/accounting').AccountingReportRow[]
}) {
  return (
    <div className="accounting-table-wrap">
      <table className="accounting-table">
        <caption>گزارش تجمیعی اسناد مالی</caption>
        <thead>
          <tr>
            <th scope="col">نوع سند</th>
            <th scope="col">تعداد</th>
            <th scope="col">جمع مبلغ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.type}>
              <th scope="row">{DOCUMENT_TYPE_LABELS[row.type]}</th>
              <td>{row.count.toLocaleString('fa-IR')}</td>
              <td>
                <MoneyText amount={row.total.amount} currency={row.total.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        <div className="accounting-dashboard">
          <div className="accounting-metrics">
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
          </div>
          <Card>
            <h3 style={{ color: tokens.color.textPrimary }}>مانده حساب‌ها</h3>
            <div className="accounting-balances">
              {data.balances.map((balance) => (
                <div key={balance.account_id} className="accounting-row">
                  <div>
                    <strong style={{ color: tokens.color.textPrimary }}>{balance.title}</strong>
                    <PersianDateText value={balance.updated_at} />
                  </div>
                  <MoneyText amount={balance.balance.amount} currency={balance.balance.currency} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </ResourceState>
  )
}

function DocumentList({ accounting }: { accounting: ReturnType<typeof useAccounting> }) {
  const { tokens } = useTheme()
  return (
    <div className="accounting-list" style={{ gap: tokens.spacing.sm }}>
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
                <div className="accounting-item">
                  <AccountingDocumentCard
                    document={document}
                    onPress={() => void accounting.openDocument(document.id)}
                  />
                </div>
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
    </div>
  )
}

function FinancialReport({ accounting }: { accounting: ReturnType<typeof useAccounting> }) {
  const { tokens } = useTheme()
  return (
    <div className="accounting-report">
      <DocumentFilters accounting={accounting} />
      <ResourceState resource={accounting.report} onRetry={() => void accounting.refreshReport()}>
        {(report) => (
          <div className="accounting-report-content">
            <ReportTable rows={report.rows} />
            <div className="accounting-row">
              <span style={{ color: tokens.color.textTertiary }}>زمان تهیه گزارش</span>
              <PersianDateText value={report.generatedAt} />
            </div>
            <TransactionList
              documents={report.items}
              onPress={(document) => void accounting.openDocument(document.id)}
            />
          </div>
        )}
      </ResourceState>
    </div>
  )
}

function DocumentDetail({ document }: { document: AccountingDocument }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <div className="accounting-detail">
        <h2 style={{ color: tokens.color.textPrimary }}>{document.code}</h2>
        <div className="accounting-row">
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
        </div>
        <span style={{ color: tokens.color.textSecondary }}>{document.counterparty_name}</span>
        <MoneyText amount={document.total.amount} currency={document.total.currency} />
        <div className="accounting-row">
          <span style={{ color: tokens.color.textTertiary }}>صدور</span>
          <PersianDateText value={document.issued_at} />
        </div>
        <div className="accounting-row">
          <span style={{ color: tokens.color.textTertiary }}>به‌روزرسانی</span>
          <PersianDateText value={document.updated_at} />
        </div>
        <p style={{ color: tokens.color.textPrimary }}>{document.description}</p>
      </div>
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
      <section
        className="accounting-screen"
        style={{ gap: tokens.spacing.md }}
        aria-label="جزئیات سند مالی"
      >
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
      </section>
    )
  }

  return (
    <section
      className="accounting-screen"
      style={{ gap: tokens.spacing.md }}
      aria-label="حسابداری فقط‌خواندنی"
    >
      <header className="accounting-header">
        <div>
          <h2>حسابداری</h2>
          <span style={{ color: tokens.color.textTertiary }}>داده مالی فقط‌خواندنی</span>
        </div>
        <Badge label="بدون عملیات نوشتن" tone="neutral" />
        <Button
          label="به‌روزرسانی"
          variant="secondary"
          size="sm"
          onPress={() => void refreshActive()}
        />
      </header>
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
    </section>
  )
}
