import type {
  Attachment,
  CanonicalMessage,
  Conversation,
  HubMessage,
} from '@superapp/chat-contracts'

function attachmentSignature(attachment: HubMessage['file']) {
  if (typeof attachment === 'string') return attachment
  if (!attachment) return null
  return [
    attachment.id,
    attachment.provider,
    attachment.type,
    attachment.file_name,
    attachment.mime_type,
    attachment.file_size,
    attachment.duration,
    attachment.url,
    attachment.created_at,
  ]
}

export function hubMessageSignature(message: HubMessage) {
  return JSON.stringify([
    message.source,
    message.robot_id,
    message.user_id,
    message.sender,
    message.timestamp,
    message.text,
    attachmentSignature(message.file),
  ])
}

function signatureHash(signature: string) {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < signature.length; index += 1) {
    const code = signature.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0)
    .toString(16)
    .padStart(8, '0')}`
}

function timestamp(value: number) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const DELIVERY_RANK: Record<CanonicalMessage['delivery_status'], number> = {
  pending: 0,
  unknown: 1,
  failed: 2,
  sent: 3,
}

function preferMessage(existing: CanonicalMessage, candidate: CanonicalMessage) {
  const existingRank = DELIVERY_RANK[existing.delivery_status]
  const candidateRank = DELIVERY_RANK[candidate.delivery_status]
  if (existingRank !== candidateRank) return existingRank > candidateRank ? existing : candidate
  const existingUpdatedAt = Date.parse(existing.updated_at) || 0
  const candidateUpdatedAt = Date.parse(candidate.updated_at) || 0
  return candidateUpdatedAt >= existingUpdatedAt ? candidate : existing
}

export function mergeCanonicalMessages(
  current: CanonicalMessage[],
  incoming: CanonicalMessage[],
): CanonicalMessage[] {
  const byId = new Map<string, CanonicalMessage>()
  const byClientMutationId = new Map<string, CanonicalMessage>()

  const add = (candidate: CanonicalMessage) => {
    const mutationMatch = candidate.client_mutation_id
      ? byClientMutationId.get(candidate.client_mutation_id)
      : undefined
    const existing = [byId.get(candidate.id), mutationMatch]
      .filter((message): message is CanonicalMessage => Boolean(message))
      .reduce<CanonicalMessage | undefined>((selected, message) => {
        if (!selected) return message
        return preferMessage(selected, message) === selected ? selected : message
      }, undefined)

    if (existing && preferMessage(existing, candidate) === existing) return

    if (existing) {
      byId.delete(existing.id)
      if (
        existing.client_mutation_id &&
        byClientMutationId.get(existing.client_mutation_id) === existing
      ) {
        byClientMutationId.delete(existing.client_mutation_id)
      }
    }
    byId.set(candidate.id, candidate)
    if (candidate.client_mutation_id) {
      byClientMutationId.set(candidate.client_mutation_id, candidate)
    }
  }

  current.forEach(add)
  incoming.forEach(add)
  return Array.from(byId.values()).sort(
    (first, second) =>
      (Date.parse(first.sent_at) || 0) - (Date.parse(second.sent_at) || 0) ||
      first.id.localeCompare(second.id),
  )
}

export function normalizeHubMessage(
  message: HubMessage,
  conversation: Conversation,
  ownerId: string,
): CanonicalMessage | null {
  if (
    message.source !== conversation.source ||
    message.robot_id !== conversation.robot_id ||
    message.user_id !== conversation.chat_id
  ) {
    return null
  }
  const sentAt = timestamp(message.timestamp)
  if (!sentAt) return null
  const attachment: Attachment | null = typeof message.file === 'string' ? null : message.file

  return {
    id: `hub_${signatureHash(hubMessageSignature(message))}`,
    conversation_id: conversation.id,
    client_mutation_id: null,
    sender: message.sender,
    sender_id: message.sender === 'operator' ? ownerId : message.user_id,
    text: message.text,
    attachment,
    sent_at: sentAt,
    created_at: sentAt,
    updated_at: sentAt,
    deleted_at: null,
    delivery_status: 'sent',
  }
}

export function createOptimisticMessage(
  conversation: Conversation,
  ownerId: string,
  text: string,
  clientMutationId: string,
  sentAt = new Date().toISOString(),
): CanonicalMessage {
  return {
    id: `optimistic:${clientMutationId}`,
    conversation_id: conversation.id,
    client_mutation_id: clientMutationId,
    sender: 'operator',
    sender_id: ownerId,
    text,
    attachment: null,
    sent_at: sentAt,
    created_at: sentAt,
    updated_at: sentAt,
    deleted_at: null,
    delivery_status: 'pending',
  }
}

export function generateClientMutationId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `cm_${globalThis.crypto.randomUUID()}`
  }
  return `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}
