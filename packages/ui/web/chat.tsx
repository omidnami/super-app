import { useEffect, useRef, useState } from 'react'
import type { ConversationApi } from '@superapp/api-client'
import type { CanonicalMessage, Conversation, DeliveryStatus } from '@superapp/chat-contracts'
import { type MessageCache, useChat } from '@superapp/chat'
import { conversationTitle } from '@superapp/conversation-inbox'
import { useTheme } from '@superapp/theme'
import { Badge, Button } from './primitives'
import { EmptyState, ErrorState, OfflineBanner, Skeleton } from './feedback'

export interface ChatScreenProps {
  conversation: Conversation
  api: ConversationApi
  ownerId: string
  operatorId: string
  accessToken?: string
  cache?: MessageCache
  isOnline?: boolean
  onBack: () => void
}

const statusLabels: Record<DeliveryStatus, string> = {
  pending: 'در حال ارسال',
  sent: 'ارسال‌شده',
  failed: 'خطا',
  unknown: 'نامشخص',
}

export function MessageStatus({
  status,
  inverse = false,
}: {
  status: DeliveryStatus
  inverse?: boolean
}) {
  const { tokens } = useTheme()
  const color = inverse
    ? tokens.color.onPrimary
    : status === 'sent'
      ? tokens.color.success
      : status === 'failed'
        ? tokens.color.danger
        : tokens.color.textTertiary
  return (
    <span
      style={{
        color,
        fontSize: 12,
      }}
    >
      {statusLabels[status]}
    </span>
  )
}

export function EmojiButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)
  const emojis = ['😀', '😊', '👍', '❤️', '🙏']

  return (
    <div className="chat-emoji">
      <Button
        label="ایموجی"
        variant="ghost"
        size="sm"
        accessibilityLabel="افزودن ایموجی"
        onPress={() => setOpen((value) => !value)}
      />
      {open ? (
        <div
          className="chat-emoji-row"
          style={{ background: tokens.color.surface, borderColor: tokens.color.border }}
        >
          {emojis.map((emoji) => (
            <Button
              key={emoji}
              label={emoji}
              variant="secondary"
              size="sm"
              accessibilityLabel={`ایموجی ${emoji}`}
              onPress={() => {
                onSelect(emoji)
                setOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function MessageComposer({
  value,
  onChangeText,
  onSend,
  disabled,
  sending,
}: {
  value: string
  onChangeText: (value: string) => void
  onSend: () => void
  disabled: boolean
  sending: boolean
}) {
  const { tokens } = useTheme()
  const tooLong = value.length > 4000

  return (
    <div className="chat-composer" style={{ borderTopColor: tokens.color.border }}>
      <div className="chat-composer-row">
        <EmojiButton onSelect={(emoji) => onChangeText(`${value}${emoji}`)} />
        <textarea
          aria-label="متن پیام"
          value={value}
          onChange={(event) => onChangeText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSend()
            }
          }}
          placeholder="پیام خود را بنویسید..."
          maxLength={5000}
          disabled={disabled}
          style={{
            background: tokens.color.surfaceMuted,
            borderColor: tooLong ? tokens.color.danger : tokens.color.border,
            borderRadius: tokens.radius.md,
            color: tokens.color.textPrimary,
          }}
        />
        <Button
          label="ارسال"
          onPress={onSend}
          loading={sending}
          disabled={disabled || sending || !value.trim() || tooLong}
        />
      </div>
      {tooLong ? (
        <span className="chat-composer-hint" style={{ color: tokens.color.danger }}>
          حداکثر ۴۰۰۰ کاراکتر مجاز است.
        </span>
      ) : value.length > 3500 ? (
        <span className="chat-composer-hint" style={{ color: tokens.color.textTertiary }}>
          {value.length.toLocaleString('fa-IR')} / ۴۰۰۰
        </span>
      ) : null}
    </div>
  )
}

export function ChatBubble({ message }: { message: CanonicalMessage }) {
  const { tokens } = useTheme()
  const own = message.sender === 'operator'
  const time = new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(message.sent_at))

  return (
    <article
      aria-label={`${own ? 'شما' : 'مشتری'}: ${message.text}`}
      className={`chat-bubble ${own ? 'chat-bubble-own' : ''}`}
      style={{
        background: own ? tokens.color.primary : tokens.color.surfaceMuted,
        color: own ? tokens.color.onPrimary : tokens.color.textPrimary,
        borderRadius: tokens.radius.lg,
      }}
    >
      <p>{message.text}</p>
      <div className="chat-bubble-meta">
        <span style={{ opacity: 0.8 }}>{time}</span>
        {own ? <MessageStatus status={message.delivery_status} inverse /> : null}
      </div>
    </article>
  )
}

function LoadingMessages() {
  return (
    <div className="chat-loading" aria-label="در حال بارگذاری پیام‌ها">
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} width={item % 2 ? '70%' : '85%'} height={52} rounded={16} />
      ))}
    </div>
  )
}

export function ChatScreen({
  conversation,
  api,
  ownerId,
  operatorId,
  accessToken,
  cache,
  isOnline = true,
  onBack,
}: ChatScreenProps) {
  const { tokens } = useTheme()
  const chat = useChat({ conversation, api, ownerId, operatorId, accessToken, cache, isOnline })
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chat.messages.length, chat.isSending])

  const submit = async () => {
    const result = await chat.send(text)
    if (result.ok) setText('')
  }

  return (
    <section className="chat-screen" aria-label="صفحه گفتگو">
      <header className="chat-header" style={{ borderBottomColor: tokens.color.border }}>
        <Button label="بازگشت" variant="secondary" size="sm" onPress={onBack} />
        <div className="chat-heading">
          <h2>{conversationTitle(conversation)}</h2>
          <span style={{ color: tokens.color.textTertiary }}>
            {chat.isOffline ? 'آفلاین' : 'آنلاین'}
          </span>
        </div>
        <Badge
          label={chat.isOffline ? 'قطع' : 'متصل'}
          tone={chat.isOffline ? 'warning' : 'success'}
        />
      </header>

      <div ref={scrollRef} className="chat-messages" aria-label="تاریخچه پیام‌ها">
        <OfflineBanner visible={chat.dataSource === 'cache'} onRetry={() => void chat.retry()} />
        {chat.hasMore ? (
          <Button
            label="پیام‌های قدیمی‌تر"
            variant="ghost"
            size="sm"
            loading={chat.isLoadingMore}
            onPress={() => void chat.loadMore()}
          />
        ) : null}
        {chat.status === 'loading' && chat.messages.length === 0 ? (
          <LoadingMessages />
        ) : chat.status === 'error' && chat.messages.length === 0 ? (
          <ErrorState
            message={chat.error || 'دریافت پیام‌ها ناموفق شد.'}
            onRetry={() => void chat.retry()}
          />
        ) : chat.messages.length === 0 ? (
          <EmptyState title="هنوز پیامی نیست" description="اولین پیام این گفتگو را ارسال کنید." />
        ) : (
          chat.messages.map((message) => <ChatBubble key={message.id} message={message} />)
        )}
        {chat.error && chat.messages.length > 0 ? (
          <ErrorState message={chat.error} onRetry={() => void chat.retry()} />
        ) : null}
      </div>

      <MessageComposer
        value={text}
        onChangeText={setText}
        onSend={() => void submit()}
        disabled={chat.isOffline}
        sending={chat.isSending}
      />
    </section>
  )
}
