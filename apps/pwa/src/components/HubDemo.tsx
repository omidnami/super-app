import { useEffect, useState } from 'react'
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
} from '@superapp/ui/web'
import { conversationApi } from '../conversations/api'

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
      <div className="gallery-stack">
        <Badge label="Support Hub · Mock" tone="primary" />
        <h2>اتصال Real-Time</h2>
        <p>Ticket کوتاه‌عمر، reconnect کنترل‌شده و Buffer رویدادها فعال هستند.</p>
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
        {error ? <p style={{ color: tokens.color.danger }}>{error}</p> : null}
        {ticketExpiresAt ? (
          <p>انقضای Ticket: {new Date(ticketExpiresAt).toLocaleTimeString('fa-IR')}</p>
        ) : null}
        {bufferedCount > 0 ? <p>{bufferedCount} رویداد در Buffer</p> : null}
        {lastMessage ? (
          <p style={{ color: tokens.color.success }}>آخرین پیام: {lastMessage}</p>
        ) : null}
        <div className="gallery-row">
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
        </div>
      </div>
    </Card>
  )
}

function MessagingInbox({
  onOpenConversation,
}: {
  onOpenConversation: (conversation: Conversation) => void
}) {
  const { session } = useServiceSession()
  const inbox = useConversationInbox({
    api: conversationApi,
    ownerId: session
      ? createConversationCacheScope(session.context.operatorId, session.context.projectId)
      : '',
    accessToken: session?.accessToken,
    pageSize: INBOX_PAGE_SIZE,
  })

  if (!session) return null
  return <ConversationList inbox={inbox} onOpenConversation={onOpenConversation} />
}

export function MessagingHub() {
  const { session } = useServiceSession()
  const [activeTab, setActiveTab] = useState('inbox')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  if (!session) return null

  return (
    <HubConnectionProvider
      session={session}
      ticketAdapter={ticketAdapter}
      transport={mockHub.transport}
    >
      <div className="gallery-stack">
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
            ownerId={createConversationCacheScope(
              session.context.operatorId,
              session.context.projectId,
            )}
            operatorId={session.context.operatorId}
            accessToken={session.accessToken}
            isOnline={isOnline}
            onBack={() => setConversation(null)}
          />
        ) : activeTab === 'inbox' ? (
          <MessagingInbox onOpenConversation={setConversation} />
        ) : (
          <HubDemo />
        )}
      </div>
    </HubConnectionProvider>
  )
}
