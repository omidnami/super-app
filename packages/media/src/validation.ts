import type { AttachmentType } from '@superapp/chat-contracts'
import type { MediaFile, MediaValidationResult } from './types'

const MEGABYTE = 1024 * 1024
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
])
const DOCUMENT_EXTENSION = /\.(pdf|doc|docx|txt|xls|xlsx|zip)$/i
const VOICE_INPUT_MIME_TYPES = new Set(['audio/ogg', 'audio/mp4', 'audio/webm'])

export function canSendVoice(source: string | undefined): boolean {
  return source === 'bale'
}

function normalizedMimeType(mimeType: string) {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() || ''
}

function isSupportedDocument(file: MediaFile, mimeType: string) {
  if (DOCUMENT_MIME_TYPES.has(mimeType)) return true
  return (
    (mimeType === '' || mimeType === 'application/octet-stream') &&
    DOCUMENT_EXTENSION.test(file.name.trim())
  )
}

export function validateMediaFile(
  file: MediaFile,
  source?: string,
  kind?: AttachmentType,
): MediaValidationResult {
  const type = kind || file.type
  const mimeType = normalizedMimeType(file.mimeType)
  const maxBytes = {
    photo: 10 * MEGABYTE,
    video: 25 * MEGABYTE,
    audio: 15 * MEGABYTE,
    document: 20 * MEGABYTE,
    voice: 5 * MEGABYTE,
  }[type]

  if (type === 'voice' && source !== undefined && !canSendVoice(source)) {
    return { ok: false, code: 'UNSUPPORTED_VOICE' }
  }

  const supported =
    (type === 'photo' && mimeType.startsWith('image/')) ||
    (type === 'video' && mimeType.startsWith('video/')) ||
    (type === 'audio' && mimeType.startsWith('audio/')) ||
    (type === 'voice' && VOICE_INPUT_MIME_TYPES.has(mimeType)) ||
    (type === 'document' && isSupportedDocument(file, mimeType))

  if (!supported || !Number.isFinite(maxBytes)) {
    return { ok: false, code: 'UNSUPPORTED_TYPE' }
  }
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > maxBytes) {
    return { ok: false, code: 'TOO_LARGE' }
  }
  return { ok: true }
}

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  if (size < 1024) return `${Math.round(size)} B`

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let exponent = 0
  let value = size
  while (value >= 1024 && exponent < units.length - 1) {
    value /= 1024
    exponent += 1
  }
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')
  return `${formatted} ${units[exponent]}`
}
