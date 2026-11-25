import type { Attachment, AttachmentType } from '@superapp/chat-contracts'
import type { ConversationApi } from '@superapp/api-client'

export interface MediaFile {
  uri: string
  name: string
  mimeType: string
  size: number
  type: AttachmentType
  duration?: number
}

export type MediaUploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'cancelled'

export type MediaUploadErrorCode =
  'UNSUPPORTED_TYPE' | 'TOO_LARGE' | 'UNSUPPORTED_VOICE' | 'OFFLINE' | 'FAILED' | 'CANCELLED'

export interface MediaUploadResult {
  ok: boolean
  code?: MediaUploadErrorCode
  attachment?: Attachment
}

export type MediaValidationResult =
  { ok: true } | { ok: false; code: 'UNSUPPORTED_TYPE' | 'TOO_LARGE' | 'UNSUPPORTED_VOICE' }

export interface UseMediaUploadOptions {
  api: ConversationApi
  conversationId: string
  ownerId: string
  accessToken?: string
  isOnline?: boolean
  source?: string
  onUploaded: (attachment: Attachment) => void
}

export interface MediaUploadState {
  status: MediaUploadStatus
  progress: number
  error: string | null
  attachment: Attachment | null
  file: MediaFile | null
}

export interface UseMediaUploadResult extends MediaUploadState {
  upload: (file: MediaFile) => Promise<MediaUploadResult>
  cancel: () => void
  retry: (file?: MediaFile) => Promise<MediaUploadResult>
  reset: () => void
}
