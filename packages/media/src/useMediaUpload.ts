import { useCallback, useEffect, useRef, useState } from 'react'
import type { UploadAttachmentRequest } from '@superapp/chat-contracts'
import { validateMediaFile } from './validation'
import type {
  MediaFile,
  MediaUploadErrorCode,
  MediaUploadResult,
  MediaUploadState,
  UseMediaUploadOptions,
  UseMediaUploadResult,
} from './types'

const INITIAL_STATE: MediaUploadState = {
  status: 'idle',
  progress: 0,
  error: null,
  attachment: null,
  file: null,
}

const VALIDATION_ERRORS: Record<'UNSUPPORTED_TYPE' | 'TOO_LARGE' | 'UNSUPPORTED_VOICE', string> = {
  UNSUPPORTED_TYPE: 'نوع فایل پشتیبانی نمی‌شود.',
  TOO_LARGE: 'حجم فایل بیش از حد مجاز است.',
  UNSUPPORTED_VOICE: 'ارسال پیام صوتی فقط از بله امکان‌پذیر است.',
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

function errorCodeMessage(code: MediaUploadErrorCode) {
  if (code in VALIDATION_ERRORS) {
    return VALIDATION_ERRORS[code as keyof typeof VALIDATION_ERRORS]
  }
  if (code === 'OFFLINE') return 'ارتباط اینترنت برقرار نیست.'
  if (code === 'CANCELLED') return null
  return 'ارسال فایل ناموفق بود. دوباره تلاش کنید.'
}

export function useMediaUpload({
  api,
  conversationId,
  ownerId,
  accessToken,
  isOnline = true,
  source,
  onUploaded,
}: UseMediaUploadOptions): UseMediaUploadResult {
  const [state, setState] = useState<MediaUploadState>(INITIAL_STATE)
  const controllerRef = useRef<AbortController | null>(null)
  const lastFileRef = useRef<MediaFile | null>(null)
  const generationRef = useRef(0)
  const mountedRef = useRef(true)
  const scopeRef = useRef({ conversationId, ownerId })

  useEffect(() => {
    scopeRef.current = { conversationId, ownerId }
  }, [conversationId, ownerId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    const controller = controllerRef.current
    if (!controller || controller.signal.aborted) return
    generationRef.current += 1
    controller.abort()
    controllerRef.current = null
    setState((current) =>
      current.status === 'uploading'
        ? { ...current, status: 'cancelled', error: null, attachment: null }
        : current,
    )
  }, [])

  const reset = useCallback(() => {
    generationRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    lastFileRef.current = null
    setState(INITIAL_STATE)
  }, [])

  const upload = useCallback(
    async (file: MediaFile): Promise<MediaUploadResult> => {
      lastFileRef.current = file
      generationRef.current += 1
      controllerRef.current?.abort()
      const generation = generationRef.current
      const controller = new AbortController()
      controllerRef.current = controller

      const isCurrent = () => {
        const scope = scopeRef.current
        return (
          mountedRef.current &&
          generationRef.current === generation &&
          scope.conversationId === conversationId &&
          scope.ownerId === ownerId &&
          !controller.signal.aborted
        )
      }
      const fail = (code: MediaUploadErrorCode): MediaUploadResult => {
        if (isCurrent()) {
          setState({
            status: code === 'CANCELLED' ? 'cancelled' : 'error',
            progress: 0,
            error: errorCodeMessage(code),
            attachment: null,
            file,
          })
        }
        return { ok: false, code }
      }

      try {
        const validation = validateMediaFile(file, source, file.type)
        if (!validation.ok) return fail(validation.code)
        if (!isOnline) return fail('OFFLINE')
        if (!api.media) return fail('FAILED')

        setState({
          status: 'uploading',
          progress: 0,
          error: null,
          attachment: null,
          file,
        })
        const request: UploadAttachmentRequest = {
          kind: file.type,
          file_name: file.name,
          mime_type: file.mimeType,
          file_size: file.size,
          ...(file.duration === undefined ? {} : { duration: file.duration }),
        }
        const attachment = await api.media.uploadAttachment(request, {
          conversationId,
          accessToken,
          signal: controller.signal,
          onProgress: (percent) => {
            if (!isCurrent() || !Number.isFinite(percent)) return
            const progress = Math.min(100, Math.max(0, Math.round(percent)))
            setState((current) => ({ ...current, progress }))
          },
        })
        if (!isCurrent()) return { ok: false, code: 'CANCELLED' }

        setState({
          status: 'success',
          progress: 100,
          error: null,
          attachment,
          file,
        })
        try {
          onUploaded(attachment)
        } catch {
          // The upload already completed; a consumer callback cannot change its result.
        }
        return { ok: true, attachment }
      } catch (error) {
        if (!isCurrent()) return { ok: false, code: 'CANCELLED' }
        if (controller.signal.aborted || isAbortError(error)) return fail('CANCELLED')
        return fail('FAILED')
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    },
    [accessToken, api, conversationId, isOnline, onUploaded, ownerId, source],
  )

  const retry = useCallback(
    async (file?: MediaFile): Promise<MediaUploadResult> => {
      const nextFile = file || lastFileRef.current
      if (!nextFile) return { ok: false, code: 'FAILED' }
      return upload(nextFile)
    },
    [upload],
  )

  return { ...state, upload, cancel, retry, reset }
}
