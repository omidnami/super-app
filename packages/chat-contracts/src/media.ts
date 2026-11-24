import type { EntityId, ISODateTime, Nullable } from './common'

export type AttachmentType = 'photo' | 'voice' | 'audio' | 'video' | 'document'

export interface Attachment {
  id: EntityId
  provider: 'planet' | 'bale'
  type: AttachmentType
  file_name: string
  mime_type: string
  file_size: number
  duration: Nullable<number>
  url: Nullable<string>
  created_at: ISODateTime
}

export interface UploadAttachmentRequest {
  kind: AttachmentType
  file_name: string
  mime_type: string
  file_size: number
  duration?: number
}
