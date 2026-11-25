import type {
  ChatSource,
  Conversation,
  ConversationStatus,
  SupportLevel,
} from '@superapp/chat-contracts'
import type { InboxFilters } from './types'

export const SUPPORT_LEVEL_LABELS: Record<SupportLevel, string> = {
  level_1: 'سطح یک',
  level_2: 'سطح دو',
  level_3: 'سطح سه',
}

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'باز',
  assigned: 'واگذاری‌شده',
  pending_customer: 'منتظر مشتری',
  escalated: 'ارجاع‌شده',
  closed: 'بسته',
}

export const CHAT_SOURCE_LABELS: Record<ChatSource, string> = {
  bale: 'بله',
  chat: 'چت سایت',
  rubika: 'روبیکا',
  telegram: 'تلگرام',
  whatsapp: 'واتساپ',
  instagram: 'اینستاگرام',
  eitaa: 'ایتا',
}

export const SUPPORT_LEVEL_OPTIONS = (Object.keys(SUPPORT_LEVEL_LABELS) as SupportLevel[]).map(
  (value) => ({ value, label: SUPPORT_LEVEL_LABELS[value] }),
)

export const CONVERSATION_STATUS_OPTIONS = (
  Object.keys(CONVERSATION_STATUS_LABELS) as ConversationStatus[]
).map((value) => ({ value, label: CONVERSATION_STATUS_LABELS[value] }))

export const CHAT_SOURCE_OPTIONS = (Object.keys(CHAT_SOURCE_LABELS) as ChatSource[]).map(
  (value) => ({
    value,
    label: CHAT_SOURCE_LABELS[value],
  }),
)

export const INBOX_PAGE_SIZE = 30

export function countActiveFilters(filters: InboxFilters) {
  return [
    filters.source,
    filters.support_level,
    filters.status,
    filters.assignee_operator_id,
    filters.unread_only ? true : undefined,
  ].filter(Boolean).length
}

export function formatInboxTimestamp(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  return new Intl.DateTimeFormat('fa-IR', {
    ...(sameDay ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' }),
  }).format(date)
}

export function conversationTitle(conversation: Conversation) {
  return conversation.customer.display_name || `گفتگوی ${conversation.chat_id}`
}

export function assigneeName(conversation: Conversation) {
  return conversation.assignee?.name || 'بدون اپراتور'
}
