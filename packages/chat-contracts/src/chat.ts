import type { CursorPageQuery, EntityId, ISODateTime, Nullable, Paginated } from './common'
import type { ChatSource, ConnectionTicketClaims } from './ticket'
import type { SupportLevel } from './auth'
import type { Attachment } from './media'

export type ConversationStatus = 'open' | 'assigned' | 'pending_customer' | 'escalated' | 'closed'
export type MessageSender = 'client' | 'operator'
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'unknown'

export interface CustomerSummary {
  id: Nullable<EntityId>
  display_name: string
  mobile?: string
  initials: string
}

export interface OperatorSummary {
  id: EntityId
  name: string
}

export interface Conversation {
  id: EntityId
  project_id: EntityId
  source: ChatSource
  robot_id: string
  chat_id: string
  customer: CustomerSummary
  support_level: SupportLevel
  status: ConversationStatus
  assignee: Nullable<OperatorSummary>
  last_message: string
  last_message_at: Nullable<ISODateTime>
  unread_count: number
  created_at: ISODateTime
  updated_at: ISODateTime
  deleted_at: Nullable<ISODateTime>
}

export interface CanonicalMessage {
  id: EntityId
  conversation_id: EntityId
  client_mutation_id: Nullable<string>
  sender: MessageSender
  sender_id: EntityId
  text: string
  attachment: Nullable<Attachment>
  sent_at: ISODateTime
  created_at: ISODateTime
  updated_at: ISODateTime
  deleted_at: Nullable<ISODateTime>
  delivery_status: DeliveryStatus
}

export interface HubMessage {
  user_id: string
  sender: MessageSender
  text: string
  file: Nullable<Attachment | string>
  robot_id: string
  timestamp: number
  source: ChatSource
}

export interface ConversationListQuery extends CursorPageQuery {
  search?: string
  source?: ChatSource
  support_level?: SupportLevel
  status?: ConversationStatus
  assignee_operator_id?: EntityId
  unread_only?: boolean
}

export interface MessageListQuery extends CursorPageQuery {
  before?: EntityId
}

export interface MessagePage {
  items: CanonicalMessage[]
  next_cursor: Nullable<string>
  has_more: boolean
  conversation: Conversation
}

export interface SendMessageRequest {
  source: ChatSource
  robot_id: string
  channel_chat_id: string
  sender: MessageSender
  text?: string
  attachment?: Nullable<Attachment>
  client_mutation_id: string
  sent_at?: ISODateTime
}

export interface SendMessageResult {
  created: boolean
  conversation: Conversation
  message: CanonicalMessage
}

export interface UpdateMessageStatusRequest {
  status: 'sent' | 'failed'
}

export interface AssignConversationRequest {
  operator_id: EntityId
}

export interface EscalateConversationRequest {
  support_level: SupportLevel
  reason?: string
}

export interface UpdateConversationStatusRequest {
  status: ConversationStatus
}

export interface MarkConversationReadRequest {
  message_id?: EntityId
}

export function toHubMessage(message: CanonicalMessage, conversation: Conversation): HubMessage {
  return {
    user_id: conversation.chat_id,
    sender: message.sender,
    text: message.text,
    file: message.attachment,
    robot_id: conversation.robot_id,
    timestamp: Date.parse(message.sent_at),
    source: conversation.source,
  }
}

export function isConnectionTicketClaims(value: unknown): value is ConnectionTicketClaims {
  if (!value || typeof value !== 'object') return false
  const ticket = value as Partial<ConnectionTicketClaims>
  return (
    ticket.iss === 'planet' &&
    ticket.aud === 'support-hub' &&
    typeof ticket.sub === 'string' &&
    typeof ticket.project_id === 'string' &&
    typeof ticket.support_level === 'string' &&
    Array.isArray(ticket.allowed_sources) &&
    typeof ticket.iat === 'number' &&
    typeof ticket.exp === 'number' &&
    typeof ticket.jti === 'string'
  )
}

export type ConversationPage = Paginated<Conversation>
