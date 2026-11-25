import { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import type { Conversation } from '@superapp/chat-contracts'
import {
  createConversationCacheScope,
  INBOX_PAGE_SIZE,
  useConversationInbox,
} from '@superapp/conversation-inbox'
import {
  createMockHubTransport,
  createMockTicketAdapter,
  HubConnectionProvider,
  useHubConnection,
} from '@superapp/hub-client'
import { useServiceSession } from '@superapp/ui'
import { useTheme } from '@superapp/theme'
import {
  Badge,
  Button,
  Card,
  ChatScreen,
  ConversationList,
  StatusPill,
  Tabs,
} from '@superapp/ui/native'
import { conversationApi } from '../conversations/api'
import { createMobileConversationCache } from '../conversations/cache'
import { useNetworkStatus } from '../conversations/useNetworkStatus'

const ticketAdapter = createMockTicketAdapter()
const mockHub = createMockHubTransport()

const stateLabels = {
  disconnected: 'قطع',
  connecting: 'در حال اتصال',
  connected: 'متصل',
  reconnecting: 'اتصال مجدد',
  expired: 'Ticket منقضی',
  error: 'خطا',
}

function HubDemo() {
  const { tokens } = useTheme()
  const {
    state,
    error,
    ticketExpiresAt,
    bufferedCount,
    retry,
    disconnect,
    sendMessage,
    subscribe,
  } = useHubConnection()
  const [lastMessage, setLastMessage] = useState('')

  useEffect(
    () => subscribe((message) => setLastMessage(message.text || 'پیوست دریافت شد')),
    [subscribe],
  )

  const sendTestMessage = async () => {
    await sendMessage({
      user_id: '501',
      sender: 'operator',
      text: 'پیام آزمایشی از اپ',
      file: null,
      robot_id: '987654',
      timestamp: Date.now(),
      source: 'bale',
    })
  }

  return (
    <Card>
      <View style={{ gap: tokens.spacing.xs }}>
        <Badge label="Support Hub · Mock" tone="primary" />
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          اتصال Real-Time
        </Text>
        <Text style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}>
          Ticket کوتاه‌عمر، reconnect کنترل‌شده و Buffer رویدادها فعال هستند.
        </Text>
      </View>
      <View style={{ marginTop: tokens.spacing.lg, gap: tokens.spacing.sm }}>
        <StatusPill
          label={stateLabels[state]}
          tone={
            state === 'connected'
              ? 'success'
              : state === 'error' || state === 'expired'
                ? 'danger'
                : 'warning'
          }
        />
        {error ? (
          <Text style={{ ...tokens.typography.caption, color: tokens.color.danger }}>{error}</Text>
        ) : null}
        {ticketExpiresAt ? (
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
            انقضای Ticket: {new Date(ticketExpiresAt).toLocaleTimeString('fa-IR')}
          </Text>
        ) : null}
        {bufferedCount > 0 ? (
          <Text style={{ ...tokens.typography.caption, color: tokens.color.info }}>
            {bufferedCount} رویداد در Buffer
          </Text>
        ) : null}
        {lastMessage ? (
          <Text style={{ ...tokens.typography.body, color: tokens.color.success }}>
            آخرین پیام: {lastMessage}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
          <Button
            label="ارسال پیام آزمایشی"
            disabled={state !== 'connected'}
            onPress={() => void sendTestMessage()}
          />
          {state === 'connected' ? (
            <Button label="قطع اتصال" variant="secondary" onPress={disconnect} />
          ) : (
            <Button label="تلاش دوباره" onPress={() => void retry()} />
          )}
        </View>
      </View>
    </Card>
  )
}

function MessagingInbox({
  onOpenConversation,
  cache,
}: {
  onOpenConversation: (conversation: Conversation) => void
  cache: ReturnType<typeof createMobileConversationCache> | undefined
}) {
  const { session } = useServiceSession()
  const scope = session
    ? createConversationCacheScope(session.context.operatorId, session.context.projectId)
    : ''
  const inbox = useConversationInbox({
    api: conversationApi,
    ownerId: scope,
    accessToken: session?.accessToken,
    cache,
    pageSize: INBOX_PAGE_SIZE,
  })

  if (!session) return null
  return <ConversationList inbox={inbox} onOpenConversation={onOpenConversation} />
}

export function MessagingHub() {
  const { session } = useServiceSession()
  const [activeTab, setActiveTab] = useState('inbox')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const scope = session
    ? createConversationCacheScope(session.context.operatorId, session.context.projectId)
    : ''
  const cache = useMemo(() => (scope ? createMobileConversationCache(scope) : undefined), [scope])
  const isOnline = useNetworkStatus()
  if (!session) return null

  return (
    <HubConnectionProvider
      session={session}
      ticketAdapter={ticketAdapter}
      transport={mockHub.transport}
    >
      <View style={{ flex: 1 }}>
        <Tabs
          items={[
            { value: 'inbox', label: 'گفتگوها' },
            { value: 'hub', label: 'اتصال Real-Time' },
          ]}
          value={activeTab}
          onChange={(value) => {
            setActiveTab(value)
            setConversation(null)
          }}
        />
        {conversation ? (
          <ChatScreen
            conversation={conversation}
            api={conversationApi}
            ownerId={scope}
            operatorId={session.context.operatorId}
            accessToken={session.accessToken}
            cache={cache}
            isOnline={isOnline}
            onBack={() => setConversation(null)}
          />
        ) : activeTab === 'inbox' ? (
          <MessagingInbox onOpenConversation={setConversation} cache={cache} />
        ) : (
          <HubDemo />
        )}
      </View>
    </HubConnectionProvider>
  )
}
