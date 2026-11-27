import type { AccountingDocumentStatus, AccountingDocumentType } from '@superapp/chat-contracts'
import type { AccountingReport, AccountingReportRow } from './types'

export const DOCUMENT_TYPE_LABELS: Record<AccountingDocumentType, string> = {
  invoice: 'فاکتور فروش',
  receipt: 'رسید',
  payment: 'پرداخت',
  journal: 'سند روزانه',
}

export const DOCUMENT_STATUS_LABELS: Record<AccountingDocumentStatus, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تأییدشده',
  cancelled: 'لغوشده',
}

export const DOCUMENT_TYPE_OPTIONS = (
  Object.keys(DOCUMENT_TYPE_LABELS) as AccountingDocumentType[]
).map((value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] }))

export const DOCUMENT_STATUS_OPTIONS = (
  Object.keys(DOCUMENT_STATUS_LABELS) as AccountingDocumentStatus[]
).map((value) => ({ value, label: DOCUMENT_STATUS_LABELS[value] }))

export function buildAccountingReport(
  items: UseAccountingReportItems,
  generatedAt = new Date().toISOString(),
): AccountingReport {
  const totals = new Map<AccountingDocumentType, { count: number; amount: number }>()
  for (const document of items) {
    const current = totals.get(document.type) || { count: 0, amount: 0 }
    current.count += 1
    current.amount += document.total.amount
    totals.set(document.type, current)
  }
  const rows: AccountingReportRow[] = DOCUMENT_TYPE_OPTIONS.map(({ value }) => {
    const total = totals.get(value) || { count: 0, amount: 0 }
    return { type: value, count: total.count, total: { amount: total.amount, currency: 'IRR' } }
  })
  return { items: [...items], rows, generatedAt }
}

type UseAccountingReportItems = AccountingReport['items']
