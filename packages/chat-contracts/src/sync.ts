import type { CursorPageQuery, EntityId, ISODateTime, Nullable, Paginated } from './common'
import type { CanonicalMessage, Conversation } from './chat'

export type SyncEntity = 'conversation' | 'message'
export type SyncOperation = 'upsert' | 'delete'

export interface SyncChange<
  T extends Conversation | CanonicalMessage = Conversation | CanonicalMessage,
> {
  entity: SyncEntity
  id: EntityId
  op: SyncOperation
  version: number
  updated_at: ISODateTime
  deleted_at: Nullable<ISODateTime>
  data: Nullable<T>
}

export interface SyncQuery extends CursorPageQuery {
  project_id?: EntityId
}

export interface SyncResult {
  changes: SyncChange[]
  next_cursor: string
  server_time: ISODateTime
  has_more: boolean
}

export type SyncPage = Paginated<SyncChange>
