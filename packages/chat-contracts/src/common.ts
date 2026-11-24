export type ISODateTime = string
export type EntityId = string
export type Nullable<T> = T | null

export interface ApiSuccess<T> {
  status: true
  data: T
}

export interface Paginated<T> {
  items: T[]
  next_cursor: Nullable<string>
  has_more: boolean
  total?: number
}

export interface CursorPageQuery {
  cursor?: string
  limit?: number
}
