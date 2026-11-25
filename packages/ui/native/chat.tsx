import { useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native'
import type { ConversationApi } from '@superapp/api-client'
import type {
  Attachment,
  CanonicalMessage,
  Conversation,
  DeliveryStatus,
} from '@superapp/chat-contracts'
import { type MessageCache, useChat } from '@superapp/chat'
import { conversationTitle } from '@superapp/conversation-inbox'
import {
  canSendVoice,
  createMediaCacheKey,
  formatFileSize,
  useMediaUpload,
  type MediaFile,
} from '@superapp/media'
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
  sendTimeoutMs?: number
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
    <Text
      style={{
        ...tokens.typography.caption,
        color,
      }}
    >
      {statusLabels[status]}
    </Text>
  )
}

export function EmojiButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { tokens } = useTheme()
  const [open, setOpen] = useState(false)
  const emojis = ['😀', '😊', '👍', '❤️', '🙏']

  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Button
        label="ایموجی"
        variant="ghost"
        size="sm"
        accessibilityLabel="افزودن ایموجی"
        onPress={() => setOpen((value) => !value)}
      />
      {open ? (
        <View style={styles.emojiRow}>
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
        </View>
      ) : null}
    </View>
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
    <View style={[styles.composer, { borderTopColor: tokens.color.border }]}>
      <View style={styles.composerRow}>
        <EmojiButton onSelect={(emoji) => onChangeText(`${value}${emoji}`)} />
        <TextInput
          accessibilityLabel="متن پیام"
          value={value}
          onChangeText={onChangeText}
          placeholder="پیام خود را بنویسید..."
          placeholderTextColor={tokens.color.textTertiary}
          multiline
          maxLength={5000}
          editable={!disabled}
          style={[
            styles.input,
            {
              backgroundColor: tokens.color.surfaceMuted,
              borderColor: tooLong ? tokens.color.danger : tokens.color.border,
              borderRadius: tokens.radius.md,
              color: tokens.color.textPrimary,
            },
          ]}
        />
        <Button
          label="ارسال"
          onPress={onSend}
          loading={sending}
          disabled={disabled || sending || (!allowEmpty && !value.trim()) || tooLong}
        />
      </View>
      {tooLong ? (
        <Text style={{ ...tokens.typography.caption, color: tokens.color.danger }}>
          حداکثر ۴۰۰۰ کاراکتر مجاز است.
        </Text>
      ) : value.length > 3500 ? (
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
          {value.length.toLocaleString('fa-IR')} / ۴۰۰۰
        </Text>
      ) : null}
    </View>
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
    cacheKey: string
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
    <View
      accessible
      accessibilityLabel={`${own ? 'شما' : 'مشتری'}: ${contentLabel}`}
      style={[
        styles.bubble,
        {
          alignSelf: own ? 'flex-end' : 'flex-start',
          backgroundColor: own ? tokens.color.primary : tokens.color.surfaceMuted,
          borderRadius: tokens.radius.lg,
        },
      ]}
    >
      {message.attachment && media ? (
        <FileBubble
          key={message.attachment.id}
          attachment={message.attachment}
          api={media.api}
          conversationId={media.conversationId}
          accessToken={media.accessToken}
          isOnline={media.isOnline}
          cacheKey={media.cacheKey}
        />
      ) : message.text ? (
        <Text
          style={{
            ...tokens.typography.body,
            color: own ? tokens.color.onPrimary : tokens.color.textPrimary,
          }}
        >
          {message.text}
        </Text>
      ) : null}
      <View style={styles.bubbleMeta}>
        <Text
          style={{
            ...tokens.typography.caption,
            color: own ? tokens.color.onPrimary : tokens.color.textTertiary,
          }}
        >
          {time}
        </Text>
        {own ? <MessageStatus status={message.delivery_status} inverse /> : null}
      </View>
    </View>
  )
}

function LoadingMessages() {
  return (
    <View style={{ gap: 12 }} accessibilityLabel="در حال بارگذاری پیام‌ها">
      {[0, 1, 2].map((item) => (
        <Skeleton key={item} width={item % 2 ? '70%' : '85%'} height={52} rounded={16} />
      ))}
    </View>
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
  sendTimeoutMs,
  onBack,
}: ChatScreenProps) {
  const { tokens } = useTheme()
  const chat = useChat({
    conversation,
    api,
    ownerId,
    operatorId,
    accessToken,
    cache,
    isOnline,
    sendTimeoutMs,
  })
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState<MediaFile | null>(null)
  const [readyAttachment, setReadyAttachment] = useState<Attachment | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [sendingMutationId, setSendingMutationId] = useState<string | null>(null)
  const submittedTextRef = useRef('')
  const upload = useMediaUpload({
    api,
    conversationId: conversation.id,
    ownerId,
    accessToken,
    isOnline,
    source: conversation.source,
    onUploaded: setReadyAttachment,
  })
  const resetUpload = upload.reset
  const scrollRef = useRef<ScrollViewInstance>(null)
  const mediaCacheKey = createMediaCacheKey(ownerId, operatorId, conversation.id)

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [chat.messages.length, chat.isSending])

  useEffect(() => {
    if (!sendingMutationId || chat.lastDeliveredMutationId !== sendingMutationId) return
    setText((current) => (current === submittedTextRef.current ? '' : current))
    setPendingFile(null)
    setReadyAttachment(null)
    setSendingMutationId(null)
    resetUpload()
  }, [chat.lastDeliveredMutationId, sendingMutationId, resetUpload])

  const submit = async () => {
    let attachment = readyAttachment
    if (pendingFile && !attachment) {
      const uploaded = await upload.upload(pendingFile)
      if (!uploaded.ok || !uploaded.attachment) return
      attachment = uploaded.attachment
      setReadyAttachment(attachment)
    }
    submittedTextRef.current = text
    const result = await chat.send(text, attachment || undefined)
    if (result.ok && result.clientMutationId) setSendingMutationId(result.clientMutationId)
    if (result.ok && result.deliveryStatus === 'sent') {
      setText('')
      setPendingFile(null)
      setReadyAttachment(null)
      setSendingMutationId(null)
      resetUpload()
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: tokens.color.border }]}>
        <Button label="بازگشت" variant="secondary" size="sm" onPress={onBack} />
        <View style={styles.headerContent}>
          <Text
            numberOfLines={1}
            style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}
          >
            {conversationTitle(conversation)}
          </Text>
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
            {chat.isOffline ? 'آفلاین' : 'آنلاین'}
          </Text>
        </View>
        <Badge
          label={chat.isOffline ? 'قطع' : 'متصل'}
          tone={chat.isOffline ? 'warning' : 'success'}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        accessibilityLabel="تاریخچه پیام‌ها"
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
      >
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
              media={{
                api,
                conversationId: conversation.id,
                accessToken,
                isOnline,
                cacheKey: mediaCacheKey,
              }}
            />
          ))
        )}
        {chat.error && chat.messages.length > 0 ? (
          <ErrorState message={chat.error} onRetry={() => void chat.retry()} />
        ) : null}
      </ScrollView>

      <View style={{ gap: tokens.spacing.xs }}>
        <View style={styles.mediaControls}>
          <AttachmentPicker
            disabled={chat.isOffline || upload.status === 'uploading'}
            onSelect={(file) => {
              setPendingFile(file)
              setReadyAttachment(null)
              setSendingMutationId(null)
              setMediaError(null)
              resetUpload()
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
                resetUpload()
              }}
              onError={(error) => setMediaError(error.message)}
            />
          ) : null}
        </View>
        <UploadProgress
          status={upload.status}
          progress={upload.progress}
          error={upload.error || mediaError || undefined}
          onCancel={upload.cancel}
          onRetry={() => void upload.retry()}
        />
        {pendingFile ? (
          <View style={[styles.pendingFile, { borderColor: tokens.color.border }]}>
            <Text
              numberOfLines={1}
              style={{ ...tokens.typography.caption, color: tokens.color.textSecondary, flex: 1 }}
            >
              {pendingFile.name} · {formatFileSize(pendingFile.size)}
            </Text>
            <Button
              label="حذف"
              variant="ghost"
              size="sm"
              disabled={upload.status === 'uploading'}
              onPress={() => {
                setPendingFile(null)
                setReadyAttachment(null)
                setSendingMutationId(null)
                resetUpload()
              }}
            />
          </View>
        ) : null}
      </View>

      <MessageComposer
        value={text}
        onChangeText={setText}
        onSend={() => void submit()}
        disabled={chat.isOffline}
        sending={chat.isSending || upload.status === 'uploading'}
        allowEmpty={Boolean(pendingFile)}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: { flex: 1, gap: 2 },
  messages: { padding: 16, gap: 10, paddingBottom: 24 },
  composer: { padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  mediaControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pendingFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  bubble: { maxWidth: '85%', padding: 12, gap: 6 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
})
