import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  AccountingDashboard,
  AccountingDocument,
  AccountingDocumentPage,
} from '@superapp/chat-contracts'
import type { AccountingApi } from '@superapp/api-client'
import type { AccountingCache } from '@superapp/accounting'
import { AccountingScreen } from '@superapp/ui/web'
import { AppThemeProvider } from '../theme/AppThemeProvider'

const lastSyncedAt = '2026-11-26T09:59:00.000Z'
const invoice: AccountingDocument = {
  id: 'acc_6001',
  code: 'INV-2026-1108',
  type: 'invoice',
  status: 'confirmed',
  counterparty_name: 'علی محمدی',
  total: { amount: 12989000, currency: 'IRR' },
  issued_at: '2026-11-24T08:25:00.000Z',
  updated_at: '2026-11-24T10:45:00.000Z',
  deleted_at: null,
  description: 'فاکتور فروش سفارش TK-1008',
}
const receipt: AccountingDocument = {
  ...invoice,
  id: 'acc_6002',
  code: 'RCPT-2026-1109',
  type: 'receipt',
  counterparty_name: 'شرکت آلفا',
  total: { amount: 2500000, currency: 'IRR' },
  issued_at: '2026-11-23T09:30:00.000Z',
  description: 'رسید پیش پرداخت',
}
const dashboard: AccountingDashboard = {
  total_receivable: { amount: 4500000, currency: 'IRR' },
  total_payable: { amount: 3200000, currency: 'IRR' },
  current_balance: { amount: 18539000, currency: 'IRR' },
  documents_count: 2,
  balances: [
    {
      account_id: 'accnt_1',
      title: 'صندوق',
      balance: { amount: 6200000, currency: 'IRR' },
      updated_at: '2026-11-24T10:45:00.000Z',
    },
    {
      account_id: 'accnt_2',
      title: 'بانک',
      balance: { amount: 12339000, currency: 'IRR' },
      updated_at: '2026-11-25T11:45:00.000Z',
    },
  ],
  updated_at: '2026-11-24T10:45:00.000Z',
}
const documentsPage: AccountingDocumentPage = {
  items: [invoice, receipt],
  next_cursor: null,
  has_more: false,
}

function api(): AccountingApi {
  return {
    dashboard: vi.fn(async () => dashboard),
    listDocuments: vi.fn(async () => documentsPage),
    getDocument: vi.fn(async () => invoice),
  }
}

function cache(): AccountingCache {
  return {
    getDashboard: vi.fn(async () => dashboard),
    saveDashboard: vi.fn(async () => undefined),
    listDocuments: vi.fn(async () => documentsPage),
    saveDocuments: vi.fn(async () => undefined),
    getDocument: vi.fn(async () => invoice),
    getSyncState: vi.fn(async () => ({ last_synced_at: lastSyncedAt })),
    clear: vi.fn(async () => undefined),
  }
}

function renderAccounting(
  accountingApi: AccountingApi,
  accountingCache: AccountingCache,
  isOnline = true,
  canRead = true,
) {
  return render(
    <AppThemeProvider>
      <AccountingScreen
        api={accountingApi}
        ownerId="scope_1"
        cache={accountingCache}
        isOnline={isOnline}
        canRead={canRead}
      />
    </AppThemeProvider>,
  )
}

function persianMoney(amount: number) {
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(amount)} تومان`
}

function persianDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}

describe('AccountingScreen', () => {
  it('shows the stale badge, last sync time, and offline cache banner', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    renderAccounting(accountingApi, accountingCache, false)

    expect(await screen.findByText('مبلغ قابل دریافت')).toBeInTheDocument()
    expect(screen.getByText('داده قدیمی')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /آخرین سینک:/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /آفلاین هستید/ })).toBeInTheDocument()
    expect(accountingCache.getDashboard).toHaveBeenCalledWith('scope_1')
    expect(accountingCache.listDocuments).toHaveBeenCalledWith('scope_1', { limit: 30 })
    expect(accountingApi.dashboard).not.toHaveBeenCalled()
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
    expect(accountingApi.getDocument).not.toHaveBeenCalled()
  })

  it('formats financial amounts, counts, and dates in Persian', async () => {
    renderAccounting(api(), cache(), false)

    expect(await screen.findByText('مبلغ قابل دریافت')).toBeInTheDocument()
    expect(screen.getByText(persianMoney(dashboard.total_receivable.amount))).toBeInTheDocument()
    expect(screen.getByText(persianMoney(dashboard.current_balance.amount))).toBeInTheDocument()
    expect(screen.getByText(dashboard.documents_count.toLocaleString('fa-IR'))).toBeInTheDocument()
    expect(
      screen.getAllByText(persianDate(dashboard.balances[0]!.updated_at)).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(persianDate(dashboard.balances[1]!.updated_at))).toBeInTheDocument()
  })

  it('blocks the accounting UI and all API or cache reads without accounting.read', async () => {
    const accountingApi = api()
    const accountingCache = cache()
    renderAccounting(accountingApi, accountingCache, true, false)

    expect(await screen.findByText('دسترسی مالی مجاز نیست')).toBeInTheDocument()
    expect(screen.getByText(/مجوز accounting.read/)).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'داشبورد' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('حسابداری فقط‌خواندنی')).not.toBeInTheDocument()
    expect(accountingApi.dashboard).not.toHaveBeenCalled()
    expect(accountingApi.listDocuments).not.toHaveBeenCalled()
    expect(accountingApi.getDocument).not.toHaveBeenCalled()
    expect(accountingCache.getDashboard).not.toHaveBeenCalled()
    expect(accountingCache.listDocuments).not.toHaveBeenCalled()
    expect(accountingCache.getDocument).not.toHaveBeenCalled()
    expect(accountingCache.getSyncState).not.toHaveBeenCalled()
  })

  it('displays the aggregate report and transactions without write actions', async () => {
    const accountingApi = api()
    renderAccounting(accountingApi, cache())
    expect(await screen.findByText('مبلغ قابل دریافت')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'گزارش' }))

    const table = await screen.findByRole('table', { name: 'گزارش تجمیعی اسناد مالی' })
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['فاکتور فروش', 'رسید', 'پرداخت', 'سند روزانه'])
    const invoiceRow = within(table).getByRole('row', { name: /فاکتور فروش/ })
    expect(within(invoiceRow).getByRole('cell', { name: '۱' })).toBeInTheDocument()
    expect(
      within(invoiceRow).getByRole('cell', { name: persianMoney(invoice.total.amount) }),
    ).toBeInTheDocument()
    const receiptRow = within(table).getByRole('row', { name: /رسید/ })
    expect(within(receiptRow).getByRole('cell', { name: '۱' })).toBeInTheDocument()
    expect(
      within(receiptRow).getByRole('cell', { name: persianMoney(receipt.total.amount) }),
    ).toBeInTheDocument()

    const invoiceTransaction = screen.getByRole('button', { name: `تراکنش ${invoice.code}` })
    const receiptTransaction = screen.getByRole('button', { name: `تراکنش ${receipt.code}` })
    expect(within(invoiceTransaction).getByText(invoice.counterparty_name)).toBeInTheDocument()
    expect(
      within(invoiceTransaction).getByText(persianMoney(invoice.total.amount)),
    ).toBeInTheDocument()
    expect(within(receiptTransaction).getByText(receipt.counterparty_name)).toBeInTheDocument()
    expect(screen.getByText('زمان تهیه گزارش')).toBeInTheDocument()

    expect(screen.getByText('بدون عملیات نوشتن')).toBeInTheDocument()
    expect(screen.getByText('داده مالی فقط‌خواندنی')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /ایجاد سند|ویرایش سند|حذف سند|ثبت سند|پرداخت سند/,
      }),
    ).not.toBeInTheDocument()
    expect(accountingApi.listDocuments).toHaveBeenCalledTimes(2)
  })
})
