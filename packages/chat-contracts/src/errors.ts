export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'TICKET_EXPIRED'
  | 'TICKET_INVALID'
  | 'CONVERSATION_FORBIDDEN'
  | 'CURSOR_EXPIRED'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_MUTATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'

export interface ApiError {
  status: false
  code: ApiErrorCode
  message: string
  retryable: boolean
  errors?: Record<string, string[]>
}
