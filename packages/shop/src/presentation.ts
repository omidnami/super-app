import type { OrderStatus, PaymentStatus, Product } from '@superapp/chat-contracts'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت‌شده',
  processing: 'در حال پردازش',
  shipped: 'ارسال‌شده',
  delivered: 'تحویل‌شده',
  cancelled: 'لغو‌شده',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'در انتظار پرداخت',
  paid: 'پرداخت‌شده',
  failed: 'ناموفق',
  refunded: 'بازپرداخت‌شده',
}

export const PRODUCT_STATUS_LABELS: Record<Product['status'], string> = {
  active: 'فعال',
  draft: 'پیش‌نویس',
  archived: 'آرشیو',
}

export const ORDER_STATUS_OPTIONS = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map(
  (value) => ({ value, label: ORDER_STATUS_LABELS[value] }),
)

export const PRODUCT_STATUS_OPTIONS = (
  Object.keys(PRODUCT_STATUS_LABELS) as Product['status'][]
).map((value) => ({ value, label: PRODUCT_STATUS_LABELS[value] }))
