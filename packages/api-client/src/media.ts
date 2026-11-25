import type { Attachment, AttachmentType, UploadAttachmentRequest } from '@superapp/chat-contracts'
import attachmentFixtures from '../mocks/fixtures/attachments.json'
import messageFixtures from '../mocks/fixtures/messages.json'

export type AttachmentUploadSource =
  | { kind: 'blob'; blob: Blob; name: string; type: string }
  | { kind: 'native'; uri: string; name: string; type: string }

export interface MediaRequestContext {
  accessToken?: string
  conversationId: string
  signal?: AbortSignal
  uploadSource?: AttachmentUploadSource
}

export interface MediaContentResult {
  attachment: Attachment
  blob?: Blob
  downloadUrl?: string
  mockFile?: boolean
}

export interface ConversationMediaApi {
  uploadAttachment(
    request: UploadAttachmentRequest,
    context: MediaRequestContext & { onProgress?: (percent: number) => void },
  ): Promise<Attachment>
  getAttachment(id: string, context: MediaRequestContext): Promise<Attachment>
  getAttachmentContent(id: string, context: MediaRequestContext): Promise<MediaContentResult>
}

export class PlanetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'PlanetApiError'
  }
}

export interface PlanetMediaApiOptions {
  baseUrl: string
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  fetch?: typeof fetch
}

const ATTACHMENT_TYPES: AttachmentType[] = ['photo', 'voice', 'audio', 'video', 'document']
const MOCK_PROGRESS_STEPS = [10, 35, 65, 85]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isAttachmentType(value: unknown): value is AttachmentType {
  return typeof value === 'string' && ATTACHMENT_TYPES.includes(value as AttachmentType)
}

function isAttachment(value: unknown): value is Attachment {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.provider === 'planet' || value.provider === 'bale') &&
    isAttachmentType(value.type) &&
    typeof value.file_name === 'string' &&
    typeof value.mime_type === 'string' &&
    typeof value.file_size === 'number' &&
    Number.isFinite(value.file_size) &&
    value.file_size >= 0 &&
    (value.duration === undefined ||
      value.duration === null ||
      (typeof value.duration === 'number' && Number.isFinite(value.duration))) &&
    (value.url === undefined || isNullableString(value.url)) &&
    typeof value.created_at === 'string'
  )
}

function isUploadAttachmentRequest(value: unknown): value is UploadAttachmentRequest {
  if (!isRecord(value)) return false
  return (
    isAttachmentType(value.kind) &&
    typeof value.file_name === 'string' &&
    typeof value.mime_type === 'string' &&
    typeof value.file_size === 'number' &&
    Number.isFinite(value.file_size) &&
    value.file_size >= 0 &&
    (value.duration === undefined ||
      (typeof value.duration === 'number' && Number.isFinite(value.duration)))
  )
}

function withoutProviderUrl(attachment: Attachment): Attachment {
  return {
    id: attachment.id,
    provider: attachment.provider,
    type: attachment.type,
    file_name: attachment.file_name,
    mime_type: attachment.mime_type,
    file_size: attachment.file_size,
    duration: attachment.duration ?? null,
    url: null,
    created_at: attachment.created_at,
  }
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  if (signal.reason !== undefined) throw signal.reason
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  throw error
}

function reportProgress(onProgress: ((percent: number) => void) | undefined, percent: number) {
  if (!onProgress || !Number.isFinite(percent)) return
  onProgress(Math.min(100, Math.max(0, Math.round(percent))))
}

function waitForMockProgress(milliseconds: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      if (signal?.reason !== undefined) reject(signal.reason)
      else {
        const error = new Error('The operation was aborted.')
        error.name = 'AbortError'
        reject(error)
      }
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function assertRequest(request: UploadAttachmentRequest, context: MediaRequestContext) {
  throwIfAborted(context.signal)
  if (!context.conversationId.trim()) {
    throw new PlanetApiError('شناسه گفتگو برای ارسال فایل لازم است.', 400)
  }
  if (!isUploadAttachmentRequest(request)) {
    throw new PlanetApiError('اطلاعات فایل معتبر نیست.', 400)
  }
}

export function createMockMediaApi(): ConversationMediaApi {
  const attachments = new Map<string, { conversationId: string; attachment: Attachment }>()
  for (const fixture of attachmentFixtures as unknown as Attachment[]) {
    const message = (
      messageFixtures as unknown as { conversation_id: string; attachment: Attachment | null }[]
    ).find((item) => item.attachment?.id === fixture.id)
    if (message)
      attachments.set(fixture.id, { conversationId: message.conversation_id, attachment: fixture })
  }
  let nextId = 1

  function findAttachment(id: string, context: MediaRequestContext) {
    throwIfAborted(context.signal)
    if (!context.conversationId.trim()) {
      throw new PlanetApiError('شناسه گفتگو برای دریافت فایل لازم است.', 400)
    }
    const stored = attachments.get(id)
    if (!stored) throw new PlanetApiError('فایل پیدا نشد.', 404)
    if (stored.conversationId !== context.conversationId) {
      throw new PlanetApiError('دسترسی به این فایل مجاز نیست.', 403)
    }
    return stored.attachment
  }

  return {
    async uploadAttachment(request, context) {
      assertRequest(request, context)
      for (const percent of MOCK_PROGRESS_STEPS) {
        await waitForMockProgress(20, context.signal)
        throwIfAborted(context.signal)
        reportProgress(context.onProgress, percent)
      }
      throwIfAborted(context.signal)

      const isVoice = request.kind === 'voice'
      const attachment: Attachment = {
        id: `mock_attachment_${String(nextId++).padStart(4, '0')}`,
        provider: 'planet',
        type: request.kind,
        file_name: isVoice
          ? `${request.file_name.replace(/\.[^.]+$/, '') || 'voice'}.ogg`
          : request.file_name,
        mime_type: isVoice ? 'audio/ogg' : request.mime_type,
        file_size: request.file_size,
        duration: request.duration ?? null,
        url: null,
        created_at: new Date().toISOString(),
      }
      attachments.set(attachment.id, { conversationId: context.conversationId, attachment })
      reportProgress(context.onProgress, 100)
      return { ...attachment }
    },

    async getAttachment(id, context) {
      return { ...findAttachment(id, context) }
    },

    async getAttachmentContent(id, context) {
      const attachment = { ...findAttachment(id, context) }
      return {
        attachment,
        mockFile: true,
        blob: new Blob([JSON.stringify(attachment)], { type: attachment.mime_type }),
      }
    },
  }
}

function invalidPayload(status: number): PlanetApiError {
  return new PlanetApiError('پاسخ Planet معتبر نیست.', status)
}

async function responseData(response: Response, signal?: AbortSignal): Promise<unknown> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throwIfAborted(signal)
    if (isAbortError(error)) throw error
    throw invalidPayload(response.status)
  }
  if (!isRecord(payload) || payload.status !== true || !('data' in payload)) {
    throw invalidPayload(response.status)
  }
  return payload.data
}

function contentFromPayload(payload: unknown, status: number): MediaContentResult {
  if (!isRecord(payload) || !isAttachment(payload.attachment)) throw invalidPayload(status)
  const result: MediaContentResult = { attachment: withoutProviderUrl(payload.attachment) }
  const downloadUrl = payload.download_url ?? payload.downloadUrl ?? payload.url
  if (downloadUrl !== undefined && typeof downloadUrl !== 'string') throw invalidPayload(status)
  if (typeof downloadUrl === 'string' && downloadUrl.length > 0) result.downloadUrl = downloadUrl
  if (payload.mock_file !== undefined && typeof payload.mock_file !== 'boolean') {
    throw invalidPayload(status)
  }
  if (payload.mock_file === true) result.mockFile = true
  if (!result.downloadUrl && !result.mockFile) throw invalidPayload(status)
  return result
}

export function createPlanetMediaApi({
  baseUrl,
  getAccessToken,
  fetch: fetchImpl = globalThis.fetch,
}: PlanetMediaApiOptions): ConversationMediaApi {
  const root = baseUrl.replace(/\/$/, '')

  function urlFor(path: string, context: MediaRequestContext) {
    const url = new URL(`${root}${path}`)
    url.searchParams.set('conversation_id', context.conversationId)
    return url
  }

  async function request(
    path: string,
    init: RequestInit,
    context: MediaRequestContext,
  ): Promise<Response> {
    throwIfAborted(context.signal)
    if (!context.conversationId.trim()) {
      throw new PlanetApiError('شناسه گفتگو برای دریافت فایل لازم است.', 400)
    }
    const accessToken = context.accessToken || (getAccessToken ? await getAccessToken() : undefined)
    throwIfAborted(context.signal)
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    const response = await fetchImpl(urlFor(path, context), {
      ...init,
      headers,
      signal: context.signal,
    })
    throwIfAborted(context.signal)
    if (!response.ok) {
      throw new PlanetApiError('دریافت فایل از Planet ناموفق بود.', response.status)
    }
    return response
  }

  async function getAttachment(id: string, context: MediaRequestContext): Promise<Attachment> {
    const response = await request(
      `/api/v1/chat/attachments/${encodeURIComponent(id)}`,
      {},
      context,
    )
    const payload = await responseData(response, context.signal)
    if (!isAttachment(payload)) throw invalidPayload(response.status)
    return withoutProviderUrl(payload)
  }

  return {
    async uploadAttachment(requestBody, context) {
      assertRequest(requestBody, context)
      const headers = new Headers({ Accept: 'application/json' })
      let body: BodyInit
      if (context.uploadSource) {
        const form = new FormData()
        const source = context.uploadSource
        if (source.kind === 'blob') {
          form.append('file', source.blob, source.name)
        } else {
          form.append('file', {
            uri: source.uri,
            name: source.name,
            type: source.type,
          } as unknown as Blob)
        }
        form.append('kind', requestBody.kind)
        form.append('file_name', requestBody.file_name)
        form.append('mime_type', requestBody.mime_type)
        form.append('file_size', String(requestBody.file_size))
        if (requestBody.duration !== undefined)
          form.append('duration', String(requestBody.duration))
        body = form
      } else {
        headers.set('Content-Type', 'application/json')
        body = JSON.stringify(requestBody)
      }
      const response = await request(
        '/api/v1/chat/attachments',
        { method: 'POST', headers, body },
        context,
      )
      const payload = await responseData(response, context.signal)
      if (!isAttachment(payload)) throw invalidPayload(response.status)
      throwIfAborted(context.signal)
      reportProgress(context.onProgress, 100)
      return withoutProviderUrl(payload)
    },

    getAttachment,

    async getAttachmentContent(id, context) {
      const response = await request(
        `/api/v1/chat/attachments/${encodeURIComponent(id)}/content`,
        {},
        context,
      )
      const contentType = response.headers.get('content-type')?.toLowerCase() || ''
      if (contentType.includes('json')) {
        return contentFromPayload(await responseData(response, context.signal), response.status)
      }

      throwIfAborted(context.signal)
      const blob = await response.blob()
      throwIfAborted(context.signal)
      return { attachment: await getAttachment(id, context), blob }
    },
  }
}
