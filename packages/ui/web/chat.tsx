import { useEffect, useRef, useState } from 'react'
import type { ConversationApi } from '@superapp/api-client'
import type {
  Attachment,
  CanonicalMessage,
  Conversation,
  DeliveryStatus,
} from '@superapp/chat-contracts'
import { type MessageCache, useChat } from '@superapp/chat'
import { conversationTitle } from '@superapp/conversation-inbox'
import { canSendVoice, formatFileSize, useMediaUpload, type MediaFile } from '@superapp/media'
import { useTheme } from '@superapp/theme'
import { Badge, Button } from './primitives'
import { AttachmentPicker, FileBubble, UploadProgress, VoiceRecorder } from './media'
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
  allowEmpty = false,
}: {
  value: string
  onChangeText: (value: string) => void
  onSend: () => void
  disabled: boolean
  sending: boolean
  allowEmpty?: boolean
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
          disabled={disabled || sending || (!allowEmpty && !value.trim()) || tooLong}
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

export function ChatBubble({
  message,
  media,
}: {
  message: CanonicalMessage
  media?: {
    api: ConversationApi
    conversationId: string
    accessToken?: string
    isOnline: boolean
  }
}) {
  const { tokens } = useTheme()
  const own = message.sender === 'operator'
  const contentLabel = message.text || message.attachment?.file_name || 'پیام'
  const time = new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(message.sent_at))

  return (
    <article
      aria-label={`${own ? 'شما' : 'مشتری'}: ${contentLabel}`}
      className={`chat-bubble ${own ? 'chat-bubble-own' : ''}`}
      style={{
        background: own ? tokens.color.primary : tokens.color.surfaceMuted,
        color: own ? tokens.color.onPrimary : tokens.color.textPrimary,
        borderRadius: tokens.radius.lg,
      }}
    >
      {message.attachment && media ? (
        <FileBubble
          key={message.attachment.id}
          attachment={message.attachment}
          api={media.api}
          conversationId={media.conversationId}
          accessToken={media.accessToken}
          isOnline={media.isOnline}
        />
      ) : message.text ? (
        <p>{message.text}</p>
      ) : null}
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
  const [pendingFile, setPendingFile] = useState<MediaFile | null>(null)
  const [readyAttachment, setReadyAttachment] = useState<Attachment | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const upload = useMediaUpload({
    api,
    conversationId: conversation.id,
    ownerId,
    accessToken,
    isOnline,
    source: conversation.source,
    onUploaded: setReadyAttachment,
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chat.messages.length, chat.isSending])

  const submit = async () => {
    let attachment = readyAttachment
    if (pendingFile && !attachment) {
      const uploaded = await upload.upload(pendingFile)
      if (!uploaded.ok || !uploaded.attachment) return
      attachment = uploaded.attachment
      setReadyAttachment(attachment)
    }
    const result = await chat.send(text, attachment || undefined)
    if (result.ok && result.deliveryStatus === 'sent') {
      setText('')
      setPendingFile(null)
      setReadyAttachment(null)
      upload.reset()
    }
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
          chat.messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              media={{ api, conversationId: conversation.id, accessToken, isOnline }}
            />
          ))
        )}
        {chat.error && chat.messages.length > 0 ? (
          <ErrorState message={chat.error} onRetry={() => void chat.retry()} />
        ) : null}
      </div>

      <div className="chat-media-controls">
        <div className="chat-media-buttons">
          <AttachmentPicker
            disabled={chat.isOffline || upload.status === 'uploading'}
            onSelect={(file) => {
              setPendingFile(file)
              setReadyAttachment(null)
              setMediaError(null)
              upload.reset()
            }}
            onError={(error) => setMediaError(error.message)}
          />
          {canSendVoice(conversation.source) ? (
            <VoiceRecorder
              disabled={chat.isOffline || upload.status === 'uploading'}
              onRecorded={(file) => {
                setPendingFile(file)
                setReadyAttachment(null)
                setMediaError(null)
                upload.reset()
              }}
              onError={(error) => setMediaError(error.message)}
            />
          ) : null}
        </div>
        <UploadProgress
          status={upload.status}
          progress={upload.progress}
          error={upload.error || mediaError || undefined}
          onCancel={upload.cancel}
          onRetry={() => void upload.retry()}
        />
        {pendingFile ? (
          <div className="chat-pending-file" style={{ borderColor: tokens.color.border }}>
            <span>
              {pendingFile.name} · {formatFileSize(pendingFile.size)}
            </span>
            <Button
              label="حذف"
              variant="ghost"
              size="sm"
              disabled={upload.status === 'uploading'}
              onPress={() => {
                setPendingFile(null)
                setReadyAttachment(null)
                upload.reset()
              }}
            />
          </div>
        ) : null}
      </div>

      <MessageComposer
        value={text}
        onChangeText={setText}
        onSend={() => void submit()}
        disabled={chat.isOffline}
        sending={chat.isSending || upload.status === 'uploading'}
        allowEmpty={Boolean(pendingFile)}
      />
    </section>
  )
}
