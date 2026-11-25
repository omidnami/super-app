import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Attachment, UploadAttachmentRequest } from '@superapp/chat-contracts'
import {
  PlanetApiError,
  createConfiguredConversationApi,
  createMockConversationApi,
  createMockMediaApi,
  createPlanetConversationApi,
  createPlanetMediaApi,
  type ConversationApi,
  type ConversationMediaApi,
} from '../../../../packages/api-client/src'
import {
  canSendVoice,
  formatFileSize,
  useMediaUpload,
  validateMediaFile,
  type MediaFile,
  type MediaUploadResult,
} from '../../../../packages/media/src'

const MEGABYTE = 1024 * 1024

function mediaFile(overrides: Partial<MediaFile> = {}): MediaFile {
  return {
    uri: 'file:///photo.png',
    name: 'photo.png',
    mimeType: 'image/png',
    size: 2 * MEGABYTE,
    type: 'photo',
    ...overrides,
  }
}

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att_1',
    provider: 'planet',
    type: 'photo',
    file_name: 'photo.png',
    mime_type: 'image/png',
    file_size: 2 * MEGABYTE,
    duration: null,
    url: null,
    created_at: '2026-11-25T10:00:00.000Z',
    ...overrides,
  }
}

const uploadRequest: UploadAttachmentRequest = {
  kind: 'photo',
  file_name: 'photo.png',
  mime_type: 'image/png',
  file_size: 2 * MEGABYTE,
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ status: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function conversationApi(media?: ConversationMediaApi): ConversationApi {
  return {
    media,
    async list() {
      throw new Error('Not used in media tests')
    },
    async get() {
      throw new Error('Not used in media tests')
    },
    async listMessages() {
      throw new Error('Not used in media tests')
    },
  }
}

function mediaAdapter(
  uploadAttachment: ConversationMediaApi['uploadAttachment'],
): ConversationMediaApi {
  return {
    uploadAttachment,
    async getAttachment() {
      throw new Error('Not used in media hook tests')
    },
    async getAttachmentContent() {
      throw new Error('Not used in media hook tests')
    },
  }
}

describe('media validation', () => {
  it.each([
    { type: 'photo' as const, mimeType: 'image/jpeg', name: 'photo.jpg', limit: 10 },
    { type: 'video' as const, mimeType: 'video/mp4', name: 'video.mp4', limit: 25 },
    { type: 'audio' as const, mimeType: 'audio/mpeg', name: 'audio.mp3', limit: 15 },
    { type: 'document' as const, mimeType: 'application/pdf', name: 'file.pdf', limit: 20 },
  ])(
    'accepts $type at its size limit and rejects larger files',
    ({ type, mimeType, name, limit }) => {
      const file = mediaFile({ type, mimeType, name, size: limit * MEGABYTE })
      expect(validateMediaFile(file, 'chat')).toEqual({ ok: true })
      expect(validateMediaFile({ ...file, size: limit * MEGABYTE + 1 }, 'chat')).toEqual({
        ok: false,
        code: 'TOO_LARGE',
      })
    },
  )

  it.each([
    ['application/pdf', 'file.pdf'],
    ['application/msword', 'file.doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'file.docx'],
    ['text/plain', 'file.txt'],
    ['application/vnd.ms-excel', 'file.xls'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'file.xlsx'],
    ['application/zip', 'file.zip'],
  ])('accepts the common document type %s', (mimeType, name) => {
    expect(validateMediaFile(mediaFile({ type: 'document', mimeType, name }), 'chat')).toEqual({
      ok: true,
    })
  })

  it('rejects unsupported MIME types and extensions with a controlled code', () => {
    expect(
      validateMediaFile(
        mediaFile({ type: 'document', mimeType: 'application/x-executable', name: 'run.exe' }),
        'chat',
      ),
    ).toEqual({ ok: false, code: 'UNSUPPORTED_TYPE' })
    expect(
      validateMediaFile(mediaFile({ type: 'document', mimeType: '', name: 'run.exe' }), 'chat'),
    ).toEqual({ ok: false, code: 'UNSUPPORTED_TYPE' })
  })

  it('allows voice only for Bale and enforces the Ogg and 5 MB policy', () => {
    const voice = mediaFile({
      type: 'voice',
      name: 'voice.ogg',
      mimeType: 'audio/ogg',
      size: 5 * MEGABYTE,
    })
    expect(canSendVoice('bale')).toBe(true)
    expect(canSendVoice('eitaa')).toBe(false)
    expect(validateMediaFile(voice, 'bale')).toEqual({ ok: true })
    expect(
      validateMediaFile({ ...voice, name: 'voice.m4a', mimeType: 'audio/mp4' }, 'bale'),
    ).toEqual({ ok: true })
    expect(
      validateMediaFile({ ...voice, name: 'voice.webm', mimeType: 'audio/webm' }, 'bale'),
    ).toEqual({ ok: true })
    expect(validateMediaFile({ ...voice, size: 5 * MEGABYTE + 1 }, 'bale')).toEqual({
      ok: false,
      code: 'TOO_LARGE',
    })
    expect(validateMediaFile({ ...voice, mimeType: 'audio/mpeg' }, 'bale')).toEqual({
      ok: false,
      code: 'UNSUPPORTED_TYPE',
    })
    expect(validateMediaFile(voice, 'eitaa')).toEqual({
      ok: false,
      code: 'UNSUPPORTED_VOICE',
    })
  })

  it('formats byte sizes using readable binary units', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2 * MEGABYTE)).toBe('2 MB')
  })
})

describe('mock media adapter', () => {
  it('simulates progress, stores metadata, and returns mock file content', async () => {
    const media = createMockMediaApi()
    const progress: number[] = []
    const uploaded = await media.uploadAttachment(uploadRequest, {
      conversationId: 'conv_1',
      onProgress: (percent) => progress.push(percent),
    })

    expect(progress).toEqual([10, 35, 65, 85, 100])
    expect(uploaded).toMatchObject({
      provider: 'planet',
      type: 'photo',
      file_name: 'photo.png',
      mime_type: 'image/png',
      file_size: 2 * MEGABYTE,
      duration: null,
      url: null,
    })
    expect(await media.getAttachment(uploaded.id, { conversationId: 'conv_1' })).toEqual(uploaded)
    const content = await media.getAttachmentContent(uploaded.id, { conversationId: 'conv_1' })
    expect(content).toMatchObject({ attachment: uploaded, mockFile: true })
    expect(content.blob).toBeInstanceOf(Blob)
  })

  it('simulates Planet conversion of device voice recordings to Bale Ogg', async () => {
    const media = createMockMediaApi()
    const uploaded = await media.uploadAttachment(
      {
        kind: 'voice',
        file_name: 'voice.m4a',
        mime_type: 'audio/mp4',
        file_size: 24512,
        duration: 8,
      },
      { conversationId: 'conv_1' },
    )

    expect(uploaded).toMatchObject({
      type: 'voice',
      file_name: 'voice.ogg',
      mime_type: 'audio/ogg',
      duration: 8,
    })
  })

  it('keeps conversation storage separate and returns 403 for another conversation', async () => {
    const media = createMockMediaApi()
    const first = await media.uploadAttachment(uploadRequest, { conversationId: 'conv_1' })
    const second = await media.uploadAttachment(uploadRequest, { conversationId: 'conv_2' })

    expect(first.id).not.toBe(second.id)
    await expect(media.getAttachment(first.id, { conversationId: 'conv_2' })).rejects.toEqual(
      expect.objectContaining({ name: 'PlanetApiError', status: 403 }),
    )
    await expect(
      media.getAttachmentContent(first.id, { conversationId: 'conv_2' }),
    ).rejects.toEqual(expect.objectContaining({ name: 'PlanetApiError', status: 403 }))
    expect(await media.getAttachment(second.id, { conversationId: 'conv_2' })).toEqual(second)
  })

  it('returns 404 for an unknown attachment', async () => {
    const media = createMockMediaApi()
    await expect(media.getAttachment('missing', { conversationId: 'conv_1' })).rejects.toEqual(
      expect.objectContaining({ name: 'PlanetApiError', status: 404 }),
    )
  })

  it('exposes media from mock and configured conversation factories', () => {
    expect(createMockConversationApi().media).toBeDefined()
    expect(createConfiguredConversationApi().media).toBeDefined()
    expect(createConfiguredConversationApi('https://planet.example').media).toBeDefined()
  })
})

describe('Planet media adapter', () => {
  it('posts metadata with the conversation query, Bearer token, signal, and progress', async () => {
    const stored = attachment()
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(stored, 201))
    const media = createPlanetMediaApi({
      baseUrl: 'https://planet.example/',
      getAccessToken: () => 'fallback_token',
      fetch: fetchImpl,
    })
    const controller = new AbortController()
    const progress: number[] = []

    const result = await media.uploadAttachment(uploadRequest, {
      conversationId: 'conv /1',
      accessToken: 'explicit_token',
      signal: controller.signal,
      onProgress: (percent) => progress.push(percent),
    })

    expect(result).toEqual(stored)
    expect(progress).toEqual([100])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [input, init] = fetchImpl.mock.calls[0]!
    expect(String(input)).toBe(
      'https://planet.example/api/v1/chat/attachments?conversation_id=conv+%2F1',
    )
    expect(init?.method).toBe('POST')
    expect(init?.signal).toBe(controller.signal)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer explicit_token')
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual(uploadRequest)
  })

  it('gets metadata without persisting a provider URL', async () => {
    const providerUrl = 'https://provider.example/private/file.png'
    const providerAttachment = {
      ...attachment({ url: providerUrl }),
      download_url: 'https://provider.example/another-private-url',
    }
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(providerAttachment))
    const media = createPlanetMediaApi({
      baseUrl: 'https://planet.example',
      getAccessToken: async () => 'metadata_token',
      fetch: fetchImpl,
    })
    const controller = new AbortController()

    const result = await media.getAttachment('att /1', {
      conversationId: 'conv_1',
      signal: controller.signal,
    })

    expect(result).toEqual(attachment())
    expect(providerAttachment.url).toBe(providerUrl)
    const [input, init] = fetchImpl.mock.calls[0]!
    expect(String(input)).toBe(
      'https://planet.example/api/v1/chat/attachments/att%20%2F1?conversation_id=conv_1',
    )
    expect(init?.method).toBeUndefined()
    expect(init?.signal).toBe(controller.signal)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer metadata_token')
  })

  it('gets content and exposes the download URL only as a transient result', async () => {
    const downloadUrl = 'https://provider.example/signed-download'
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        attachment: attachment({ url: 'https://provider.example/persisted-url' }),
        download_url: downloadUrl,
        mock_file: false,
      }),
    )
    const media = createPlanetMediaApi({
      baseUrl: 'https://planet.example',
      fetch: fetchImpl,
    })
    const controller = new AbortController()

    const result = await media.getAttachmentContent('att_1', {
      conversationId: 'conv_1',
      accessToken: 'content_token',
      signal: controller.signal,
    })

    expect(result).toEqual({
      attachment: attachment(),
      downloadUrl,
    })
    const [input, init] = fetchImpl.mock.calls[0]!
    expect(String(input)).toBe(
      'https://planet.example/api/v1/chat/attachments/att_1/content?conversation_id=conv_1',
    )
    expect(init?.signal).toBe(controller.signal)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer content_token')
  })

  it('returns a Blob for binary content and loads its metadata separately', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('payload', { status: 200, headers: { 'Content-Type': 'image/png' } }),
      )
      .mockResolvedValueOnce(jsonResponse(attachment()))
    const media = createPlanetMediaApi({
      baseUrl: 'https://planet.example',
      fetch: fetchImpl,
    })

    const result = await media.getAttachmentContent('att_1', { conversationId: 'conv_1' })

    expect(result.attachment).toEqual(attachment())
    expect(result.blob).toBeDefined()
    expect(result.blob?.size).toBe(7)
    expect(result.blob?.type).toBe('image/png')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('surfaces HTTP and invalid payload failures as PlanetApiError', async () => {
    const httpMedia = createPlanetMediaApi({
      baseUrl: 'https://planet.example',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('forbidden', { status: 403 })),
    })
    await expect(httpMedia.getAttachment('att_1', { conversationId: 'conv_1' })).rejects.toEqual(
      expect.objectContaining({ name: 'PlanetApiError', status: 403 }),
    )

    const invalidMedia = createPlanetMediaApi({
      baseUrl: 'https://planet.example',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ id: 'incomplete' })),
    })
    await expect(
      invalidMedia.getAttachment('att_1', { conversationId: 'conv_1' }),
    ).rejects.toBeInstanceOf(PlanetApiError)
  })

  it('passes AbortSignal to fetch and propagates cancellation', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (signal?.aborted) {
          reject(signal.reason)
          return
        }
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    const media = createPlanetMediaApi({
      baseUrl: 'https://planet.example',
      fetch: fetchImpl,
    })
    const controller = new AbortController()
    const pending = media.uploadAttachment(uploadRequest, {
      conversationId: 'conv_1',
      signal: controller.signal,
    })

    expect(fetchImpl.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('exposes the real media adapter from Planet conversation factory', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(attachment()))
    const api = createPlanetConversationApi({
      baseUrl: 'https://planet.example',
      fetch: fetchImpl,
    })

    expect(api.media).toBeDefined()
    await api.media?.getAttachment('att_1', { conversationId: 'conv_1' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('useMediaUpload', () => {
  it('uploads metadata, reports progress, and returns the attachment atomically', async () => {
    const stored = attachment()
    let resolveUpload!: (value: Attachment) => void
    const uploadAttachment = vi.fn<ConversationMediaApi['uploadAttachment']>(
      (_request, context) => {
        context.onProgress?.(45)
        return new Promise<Attachment>((resolve) => {
          resolveUpload = resolve
        })
      },
    )
    const onUploaded = vi.fn()
    const { result } = renderHook(() =>
      useMediaUpload({
        api: conversationApi(mediaAdapter(uploadAttachment)),
        conversationId: 'conv_1',
        ownerId: 'op_1',
        accessToken: 'upload_token',
        onUploaded,
      }),
    )
    const file = mediaFile({ duration: 12 })
    let uploadResult!: MediaUploadResult

    act(() => {
      void result.current.upload(file).then((value) => {
        uploadResult = value
      })
    })

    expect(result.current.status).toBe('uploading')
    expect(result.current.progress).toBe(45)
    expect(result.current.file).toBe(file)
    const [request, context] = uploadAttachment.mock.calls[0]!
    expect(request).toEqual({ ...uploadRequest, duration: 12 })
    expect(context).toMatchObject({
      conversationId: 'conv_1',
      accessToken: 'upload_token',
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    })

    await act(async () => {
      resolveUpload(stored)
      await vi.waitFor(() => expect(uploadResult).toBeDefined())
    })

    expect(uploadResult).toEqual({ ok: true, attachment: stored })
    expect(onUploaded).toHaveBeenCalledWith(stored)
    expect(result.current).toMatchObject({
      status: 'success',
      progress: 100,
      error: null,
      attachment: stored,
      file,
    })
  })

  it('aborts an active upload and returns CANCELLED without calling onUploaded', async () => {
    const uploadAttachment = vi.fn<ConversationMediaApi['uploadAttachment']>(
      (_request, context) =>
        new Promise<Attachment>((_resolve, reject) => {
          const signal = context.signal
          if (signal?.aborted) {
            reject(signal.reason)
            return
          }
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    )
    const onUploaded = vi.fn()
    const { result } = renderHook(() =>
      useMediaUpload({
        api: conversationApi(mediaAdapter(uploadAttachment)),
        conversationId: 'conv_1',
        ownerId: 'op_1',
        onUploaded,
      }),
    )
    let pending!: Promise<MediaUploadResult>
    act(() => {
      pending = result.current.upload(mediaFile())
    })
    const signal = uploadAttachment.mock.calls[0]?.[1].signal
    expect(signal).toBeInstanceOf(AbortSignal)

    act(() => result.current.cancel())
    let uploadResult!: MediaUploadResult
    await act(async () => {
      uploadResult = await pending
    })

    expect(signal?.aborted).toBe(true)
    expect(uploadResult).toEqual({ ok: false, code: 'CANCELLED' })
    expect(onUploaded).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({
      status: 'cancelled',
      error: null,
      attachment: null,
    })
  })

  it('retries the last file and returns the uploaded attachment', async () => {
    const stored = attachment()
    const uploadAttachment = vi
      .fn<ConversationMediaApi['uploadAttachment']>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockImplementationOnce(async (_request, context) => {
        context.onProgress?.(100)
        return stored
      })
    const onUploaded = vi.fn()
    const { result } = renderHook(() =>
      useMediaUpload({
        api: conversationApi(mediaAdapter(uploadAttachment)),
        conversationId: 'conv_1',
        ownerId: 'op_1',
        onUploaded,
      }),
    )
    const file = mediaFile({ name: 'retry.png' })
    let firstResult!: MediaUploadResult
    await act(async () => {
      firstResult = await result.current.upload(file)
    })

    expect(firstResult).toEqual({ ok: false, code: 'FAILED' })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeTruthy()

    let retryResult!: MediaUploadResult
    await act(async () => {
      retryResult = await result.current.retry()
    })

    expect(retryResult).toEqual({ ok: true, attachment: stored })
    expect(uploadAttachment).toHaveBeenCalledTimes(2)
    expect(uploadAttachment.mock.calls[1]?.[0]).toEqual({
      kind: 'photo',
      file_name: 'retry.png',
      mime_type: 'image/png',
      file_size: file.size,
    })
    expect(onUploaded).toHaveBeenCalledTimes(1)
    expect(onUploaded).toHaveBeenCalledWith(stored)
    expect(result.current.status).toBe('success')
  })

  it('rejects invalid files before calling the adapter', async () => {
    const uploadAttachment = vi.fn<ConversationMediaApi['uploadAttachment']>()
    const { result } = renderHook(() =>
      useMediaUpload({
        api: conversationApi(mediaAdapter(uploadAttachment)),
        conversationId: 'conv_1',
        ownerId: 'op_1',
        onUploaded: vi.fn(),
      }),
    )
    const file = mediaFile({ size: 10 * MEGABYTE + 1 })
    let uploadResult!: MediaUploadResult
    await act(async () => {
      uploadResult = await result.current.upload(file)
    })

    expect(uploadResult).toEqual({ ok: false, code: 'TOO_LARGE' })
    expect(uploadAttachment).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({ status: 'error', file, attachment: null })
  })

  it('does not upload when the media adapter is missing or the client is offline', async () => {
    const uploadAttachment = vi.fn<ConversationMediaApi['uploadAttachment']>()
    const missing = renderHook(() =>
      useMediaUpload({
        api: conversationApi(),
        conversationId: 'conv_1',
        ownerId: 'op_1',
        onUploaded: vi.fn(),
      }),
    )
    let missingResult!: MediaUploadResult
    await act(async () => {
      missingResult = await missing.result.current.upload(mediaFile())
    })
    expect(missingResult).toEqual({ ok: false, code: 'FAILED' })
    expect(missing.result.current.status).toBe('error')

    const offline = renderHook(() =>
      useMediaUpload({
        api: conversationApi(mediaAdapter(uploadAttachment)),
        conversationId: 'conv_1',
        ownerId: 'op_1',
        isOnline: false,
        onUploaded: vi.fn(),
      }),
    )
    let offlineResult!: MediaUploadResult
    await act(async () => {
      offlineResult = await offline.result.current.upload(mediaFile())
    })
    expect(offlineResult).toEqual({ ok: false, code: 'OFFLINE' })
    expect(uploadAttachment).not.toHaveBeenCalled()
  })
})
