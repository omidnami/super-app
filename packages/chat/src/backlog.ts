import { PlanetApiError, type ConversationApi } from '@superapp/api-client'
import type {
  CanonicalMessage,
  Conversation,
  SyncChange,
  SyncQuery,
} from '@superapp/chat-contracts'
import type { BacklogCache, BacklogState } from './types'

export interface BacklogReconcileOptions {
  api: ConversationApi
  conversation: Conversation
  ownerId: string
  accessToken?: string
  cache?: BacklogCache
  cursor?: string | null
  signal?: AbortSignal
}

export interface BacklogReconcileResult {
  changes: SyncChange[]
  snapshot: CanonicalMessage[] | null
  cursor: string | null
  lastSyncedAt: string | null
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Backlog reconciliation aborted')
    error.name = 'AbortError'
    throw error
  }
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
    if (!result.has_more || !result.next_cursor) break
    if (result.next_cursor === cursor) throw new Error('History cursor did not advance')
    cursor = result.next_cursor
  }
  return items
}

export async function reconcileBacklog({
  api,
  conversation,
  ownerId,
  accessToken,
  cache,
  cursor,
  signal,
}: BacklogReconcileOptions): Promise<BacklogReconcileResult> {
  let state: BacklogState | null = null
  if (cache) state = await cache.getState(ownerId, conversation.id)
  let activeCursor = cursor === undefined ? state?.cursor : cursor
  const changes: SyncChange[] = []

  if (!api.sync) {
    return {
      changes,
      snapshot: null,
      cursor: activeCursor || null,
      lastSyncedAt: state?.last_synced_at || state?.lastSyncedAt || null,
    }
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
      if (cache) {
        await cache.applyChanges(
          ownerId,
          conversation.id,
          result.changes,
          result.next_cursor,
          result.server_time,
        )
      }
      changes.push(...result.changes)
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
    if (cache) {
      await cache.replaceSnapshot(ownerId, conversation.id, snapshot, '', new Date().toISOString())
    }
    return {
      changes: [],
      snapshot,
      cursor: '',
      lastSyncedAt: new Date().toISOString(),
    }
  }
}
