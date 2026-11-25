import { PlanetApiError, type ConversationApi } from '@superapp/api-client'
import type {
  CanonicalMessage,
  Conversation,
  SyncChange,
  SyncQuery,
} from '@superapp/chat-contracts'
import { sanitizeAttachment } from './messages'
import type { BacklogCache, BacklogState } from './types'

export interface BacklogReconcileOptions {
  api: ConversationApi
  conversation: Conversation
  ownerId: string
  accessToken?: string
  cache?: BacklogCache
  cursor?: string | null
  signal?: AbortSignal
  deferFinalCommit?: boolean
}

export interface PendingBacklogCommit {
  changes: SyncChange[]
  nextCursor: string
  syncedAt: string
}

export interface PendingSnapshotCommit {
  messages: CanonicalMessage[]
  nextCursor: string
  syncedAt: string
}

export interface BacklogReconcileResult {
  changes: SyncChange[]
  snapshot: CanonicalMessage[] | null
  cursor: string | null
  lastSyncedAt: string | null
  pendingCommit?: PendingBacklogCommit
  pendingSnapshot?: PendingSnapshotCommit
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Backlog reconciliation aborted')
    error.name = 'AbortError'
    throw error
  }
}

function sanitizeChange(change: SyncChange): SyncChange {
  if (change.entity !== 'message' || !change.data) return change
  const message = change.data as CanonicalMessage
  return {
    ...change,
    data: { ...message, attachment: sanitizeAttachment(message.attachment) },
  }
}

function sanitizeSnapshot(items: CanonicalMessage[]) {
  return items.map((message) => ({
    ...message,
    attachment: sanitizeAttachment(message.attachment),
  }))
}

async function loadFullSnapshot(
  api: ConversationApi,
  conversation: Conversation,
  accessToken: string | undefined,
  signal?: AbortSignal,
) {
  const items: CanonicalMessage[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  let hasMore = true
  for (let page = 0; page < 100; page += 1) {
    throwIfAborted(signal)
    const result = await api.listMessages(
      conversation.id,
      { limit: 100, ...(cursor ? { cursor } : {}) },
      { accessToken, signal },
    )
    for (const message of result.items) {
      if (!seen.has(message.id)) {
        seen.add(message.id)
        items.push(message)
      }
    }
    hasMore = Boolean(result.has_more && result.next_cursor)
    if (!hasMore) break
    if (result.next_cursor === cursor) throw new Error('History cursor did not advance')
    cursor = result.next_cursor || undefined
  }
  if (hasMore) throw new Error('Full snapshot exceeded the safe page limit')
  return sanitizeSnapshot(items)
}

export async function reconcileBacklog({
  api,
  conversation,
  ownerId,
  accessToken,
  cache,
  cursor,
  signal,
  deferFinalCommit = false,
}: BacklogReconcileOptions): Promise<BacklogReconcileResult> {
  let state: BacklogState | null = null
  if (cache) state = await cache.getState(ownerId, conversation.id)
  let activeCursor = cursor === undefined ? state?.cursor : cursor
  const lastSyncedAt = state?.lastSyncedAt || state?.last_synced_at || null
  const changes: SyncChange[] = []

  if (!api.sync) {
    return { changes, snapshot: null, cursor: activeCursor || null, lastSyncedAt }
  }

  try {
    for (let page = 0; page < 100; page += 1) {
      throwIfAborted(signal)
      const query: SyncQuery = {
        conversation_id: conversation.id,
        project_id: conversation.project_id,
        limit: 100,
        ...(activeCursor ? { cursor: activeCursor } : {}),
      }
      const result = await api.sync(query, { accessToken, signal })
      throwIfAborted(signal)
      const pageChanges = result.changes.map(sanitizeChange)
      if (!result.has_more && deferFinalCommit && cache) {
        return {
          changes,
          snapshot: null,
          cursor: activeCursor || null,
          lastSyncedAt,
          pendingCommit: {
            changes: pageChanges,
            nextCursor: result.next_cursor,
            syncedAt: result.server_time,
          },
        }
      }
      if (cache) {
        await cache.applyChanges(
          ownerId,
          conversation.id,
          pageChanges,
          result.next_cursor,
          result.server_time,
        )
      }
      changes.push(...pageChanges)
      const previousCursor = activeCursor
      activeCursor = result.next_cursor
      if (!result.has_more) {
        return {
          changes,
          snapshot: null,
          cursor: activeCursor,
          lastSyncedAt: result.server_time,
        }
      }
      if (activeCursor === previousCursor) throw new Error('Sync cursor did not advance')
    }
    throw new Error('Sync page limit exceeded')
  } catch (error) {
    if (!(error instanceof PlanetApiError) || error.status !== 410) throw error
    const snapshot = await loadFullSnapshot(api, conversation, accessToken, signal)
    const syncedAt = new Date().toISOString()
    if (deferFinalCommit && cache) {
      return {
        changes: [],
        snapshot,
        cursor: activeCursor || null,
        lastSyncedAt,
        pendingSnapshot: { messages: snapshot, nextCursor: '', syncedAt },
      }
    }
    if (cache) await cache.replaceSnapshot(ownerId, conversation.id, snapshot, '', syncedAt)
    return { changes: [], snapshot, cursor: '', lastSyncedAt: syncedAt }
  }
}
