import type { Conversation } from '@superapp/chat-contracts'
import type { ConversationInboxController } from './useConversationInbox'

export interface ConversationListProps {
  inbox: ConversationInboxController
  onOpenConversation: (conversation: Conversation) => void
}

export interface ConversationRouteProps {
  conversation: Conversation
  onBack: () => void
}
