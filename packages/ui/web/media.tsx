import { type ChangeEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ConversationApi } from '@superapp/api-client'
import type { Attachment, AttachmentType } from '@superapp/chat-contracts'
import type { MediaFile } from '@superapp/media'
import { useTheme } from '@superapp/theme'
import { Button } from './primitives'

const DEFAULT_MIME_TYPE = 'application/octet-stream'

const attachmentTypeLabels: Record<AttachmentType, string> = {
  photo: 'تصویر',
  voice: 'پیام صوتی',
  audio: 'صدا',
  video: 'ویدیو',
  document: 'سند',
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string' && error.trim()) return new Error(error)
  return new Error('عملیات ناموفق بود.')
}

function errorText(error: unknown): string {
  const normalized = toError(error)
  return normalized.message || 'عملیات ناموفق بود.'
}

function fileExtension(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() || '' : ''
}

function inferAttachmentType(file: Pick<File, 'name' | 'type'>): AttachmentType {
  const mimeType = file.type.trim().toLowerCase()
  const extension = fileExtension(file.name)

  if (mimeType.startsWith('image/')) return 'photo'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'avif', 'svg'].includes(extension)) {
    return 'photo'
  }
  if (['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'ogv'].includes(extension)) return 'video'
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'].includes(extension)) return 'audio'
  return 'document'
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '۰ بایت'
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت']
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / 1024 ** exponent
  return `${value.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} ${units[exponent]}`
}

function formatDuration(duration: number | null | undefined): string {
  if (duration === null || duration === undefined || !Number.isFinite(duration) || duration < 0) {
    return ''
  }
  const totalSeconds = Math.floor(duration)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const number = new Intl.NumberFormat('fa-IR', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  })
  const minuteText = number.format(minutes)
  const secondText = number.format(seconds)
  return hours > 0
    ? `${number.format(hours)}:${minuteText}:${secondText}`
    : `${minuteText}:${secondText}`
}

export interface AttachmentPickerProps {
  disabled?: boolean
  onSelect: (file: MediaFile) => void
  onError?: (error: Error) => void
}

export function AttachmentPicker({ disabled = false, onSelect, onError }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    try {
      onSelect({
        uri: '',
        name: file.name || 'فایل بدون نام',
        mimeType: file.type || DEFAULT_MIME_TYPE,
        size: file.size,
        type: inferAttachmentType(file),
      })
    } catch (error) {
      onError?.(toError(error))
    }
  }

  return (
    <div className="chat-attachment-picker">
      <input
        ref={inputRef}
        id={inputId}
        className="chat-attachment-input"
        type="file"
        aria-label="انتخاب فایل"
        hidden
        disabled={disabled}
        onChange={handleChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
      />
      <Button
        label="افزودن فایل"
        variant="secondary"
        accessibilityLabel="انتخاب فایل برای ارسال"
        disabled={disabled}
        onPress={() => inputRef.current?.click()}
        icon={<span aria-hidden="true">＋</span>}
      />
    </div>
  )
}

export type UploadStatus =
  | 'idle'
  | 'pending'
  | 'uploading'
  | 'complete'
  | 'completed'
  | 'success'
  | 'done'
  | 'uploaded'
  | 'error'
  | 'failed'
  | 'cancelled'
  | 'canceled'

export interface UploadProgressProps {
  status: UploadStatus
  /** A ratio from 0 to 1, or a percentage greater than 1. */
  progress: number
  error?: string | null
  onCancel?: () => void
  onRetry?: () => void
}

export function UploadProgress({
  status,
  progress,
  error,
  onCancel,
  onRetry,
}: UploadProgressProps) {
  const { tokens } = useTheme()
  const failed = status === 'error' || status === 'failed'
  const complete = ['complete', 'completed', 'success', 'done', 'uploaded'].includes(status)
  const cancelled = status === 'cancelled' || status === 'canceled'
  const numericProgress = Number.isFinite(progress) ? progress : 0
  const percentage = complete
    ? 100
    : Math.min(100, Math.max(0, numericProgress <= 1 ? numericProgress * 100 : numericProgress))
  const statusLabel = failed
    ? 'ارسال ناموفق شد'
    : complete
      ? 'ارسال شد'
      : cancelled
        ? 'ارسال لغو شد'
        : status === 'idle'
          ? 'در انتظار ارسال'
          : status === 'pending'
            ? 'در صف ارسال'
            : 'در حال ارسال'
  const progressColor = failed
    ? tokens.color.danger
    : complete
      ? tokens.color.success
      : cancelled
        ? tokens.color.textSecondary
        : tokens.color.primary
  const message = failed ? error || statusLabel : ''

  return (
    <div
      className="chat-upload-progress"
      role="group"
      aria-label="وضعیت ارسال فایل"
      style={{ color: tokens.color.textPrimary }}
    >
      <div className="chat-upload-progress-header">
        <span role="status" aria-live="polite">
          {statusLabel}
        </span>
        <span>{percentage.toLocaleString('fa-IR', { maximumFractionDigits: 0 })}٪</span>
      </div>
      <div
        className="chat-upload-progress-track"
        role="progressbar"
        aria-label="پیشرفت ارسال فایل"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentage)}
        aria-valuetext={`${statusLabel}، ${Math.round(percentage).toLocaleString('fa-IR')} درصد`}
        style={{ background: tokens.color.surfaceMuted }}
      >
        <span
          className="chat-upload-progress-fill"
          style={{ width: `${percentage}%`, background: progressColor }}
        />
      </div>
      {message ? (
        <p role="alert" style={{ color: tokens.color.danger }}>
          {message}
        </p>
      ) : null}
      {(failed || cancelled) && onRetry ? (
        <div className="chat-upload-progress-actions">
          <Button label="تلاش دوباره" size="sm" onPress={onRetry} />
        </div>
      ) : (status === 'uploading' || status === 'pending') && onCancel ? (
        <div className="chat-upload-progress-actions">
          <Button label="لغو ارسال" variant="secondary" size="sm" onPress={onCancel} />
        </div>
      ) : null}
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

async function contentToBlob(content: unknown, signal?: AbortSignal): Promise<Blob> {
  const payload = isRecord(content) && isRecord(content.data) ? content.data : content
  if (typeof Blob !== 'undefined' && payload instanceof Blob) return payload

  if (typeof Response !== 'undefined' && payload instanceof Response) {
    if (!payload.ok) throw new Error('دریافت محتوای فایل ناموفق بود.')
    return payload.blob()
  }

  if (isRecord(payload)) {
    if (typeof Blob !== 'undefined' && payload.blob instanceof Blob) return payload.blob
    if (typeof Blob !== 'undefined' && payload.content instanceof Blob) return payload.content
    if (typeof Blob !== 'undefined' && payload.data instanceof Blob) return payload.data

    // A short-lived URL returned by the secure API may be exchanged for a Blob.
    // Provider URLs from the attachment itself are deliberately never read or persisted.
    const downloadUrl = [payload.downloadUrl, payload.download_url, payload.url, payload.uri].find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    if (downloadUrl) {
      const response = await fetch(downloadUrl, { signal })
      if (!response.ok) throw new Error('دریافت محتوای فایل ناموفق بود.')
      return response.blob()
    }
  }

  if (typeof payload === 'string' && payload.length > 0) {
    const response = await fetch(payload, { signal })
    if (!response.ok) throw new Error('دریافت محتوای فایل ناموفق بود.')
    return response.blob()
  }

  throw new Error('محتوای فایل معتبر نیست.')
}

type FileLoadState =
  | { identity: string; attempt: number; status: 'loading' | 'ready' }
  | { identity: string; attempt: number; status: 'error'; message: string }

export interface FileBubbleProps {
  attachment: Attachment
  api: ConversationApi
  conversationId: string
  accessToken?: string
  isOnline?: boolean
  onError?: (error: Error) => void
}

export function FileBubble({
  attachment,
  api,
  conversationId,
  accessToken,
  isOnline = true,
  onError,
}: FileBubbleProps) {
  const { tokens } = useTheme()
  const identity = JSON.stringify([conversationId, attachment.id])
  const [state, setState] = useState<FileLoadState>({ identity, attempt: 0, status: 'loading' })
  const [loaded, setLoaded] = useState<{ identity: string; url: string } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const sourceRef = useRef<string | null>(null)
  const sourceIdentityRef = useRef<string | null>(null)
  const onErrorRef = useRef(onError)
  const source = loaded?.identity === identity ? loaded.url : undefined
  const currentState = state.identity === identity && state.attempt === attempt ? state : null
  const phase = source
    ? 'ready'
    : !isOnline
      ? 'offline'
      : currentState?.status === 'error'
        ? 'error'
        : 'loading'
  const ready = phase === 'ready'
  const loadError = currentState?.status === 'error' ? currentState.message : ''

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    return () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current)
      sourceRef.current = null
      sourceIdentityRef.current = null
    }
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    if (sourceIdentityRef.current && sourceIdentityRef.current !== identity && sourceRef.current) {
      URL.revokeObjectURL(sourceRef.current)
      sourceRef.current = null
      sourceIdentityRef.current = null
    }

    if (sourceRef.current && sourceIdentityRef.current === identity) {
      return () => {
        active = false
        controller.abort()
      }
    }

    if (!isOnline) {
      return () => {
        active = false
        controller.abort()
      }
    }

    const load = async () => {
      setState({ identity, attempt, status: 'loading' })
      try {
        const mediaApi = api.media
        if (!mediaApi || typeof mediaApi.getAttachmentContent !== 'function') {
          throw new Error('دریافت امن فایل پشتیبانی نمی‌شود.')
        }
        const content: unknown = await mediaApi.getAttachmentContent(attachment.id, {
          accessToken,
          conversationId,
          signal: controller.signal,
        })
        const blob = await contentToBlob(content, controller.signal)
        if (!active || controller.signal.aborted) return

        const normalizedBlob = blob.type
          ? blob
          : new Blob([blob], { type: attachment.mime_type || DEFAULT_MIME_TYPE })
        const url = URL.createObjectURL(normalizedBlob)
        sourceRef.current = url
        sourceIdentityRef.current = identity
        setLoaded({ identity, url })
        setState({ identity, attempt, status: 'ready' })
      } catch (error) {
        if (!active || controller.signal.aborted) return
        const normalized = toError(error)
        setState({ identity, attempt, status: 'error', message: errorText(normalized) })
        onErrorRef.current?.(normalized)
      }
    }

    void load()
    return () => {
      active = false
      controller.abort()
    }
  }, [
    accessToken,
    api,
    attachment.id,
    attachment.mime_type,
    conversationId,
    identity,
    isOnline,
    attempt,
  ])

  const statusText = ready
    ? isOnline
      ? 'آماده'
      : 'آماده • آفلاین'
    : phase === 'loading'
      ? 'در حال دریافت فایل...'
      : phase === 'error'
        ? loadError
        : 'نیاز به اینترنت'

  return (
    <article
      className="chat-file-bubble"
      aria-label={`${attachmentTypeLabels[attachment.type]}: ${attachment.file_name}`}
      style={{
        background: tokens.color.surface,
        color: tokens.color.textPrimary,
        borderColor: tokens.color.border,
        borderRadius: tokens.radius.lg,
      }}
    >
      <div className="chat-file-bubble-header">
        <span className="chat-file-bubble-icon" aria-hidden="true">
          {attachment.type === 'photo' ? '▧' : attachment.type === 'video' ? '▶' : '⌁'}
        </span>
        <div className="chat-file-bubble-heading">
          <strong className="chat-file-bubble-name" title={attachment.file_name}>
            {attachment.file_name}
          </strong>
          <span className="chat-file-bubble-meta" style={{ color: tokens.color.textTertiary }}>
            {attachmentTypeLabels[attachment.type]} • {formatFileSize(attachment.file_size)}
          </span>
        </div>
      </div>

      {!ready ? (
        <div className="chat-file-bubble-status" role="status" aria-live="polite">
          <span
            style={{
              color: phase === 'error' ? tokens.color.danger : tokens.color.textSecondary,
            }}
          >
            {statusText}
          </span>
          {phase === 'error' && isOnline ? (
            <Button
              label="تلاش دوباره"
              variant="ghost"
              size="sm"
              onPress={() => setAttempt((value) => value + 1)}
            />
          ) : null}
        </div>
      ) : null}

      {ready && source ? (
        <>
          <span className="chat-file-bubble-meta" style={{ color: tokens.color.textTertiary }}>
            {statusText}
          </span>
          {attachment.type === 'photo' ? (
            <>
              <img
                className="chat-file-preview"
                src={source}
                alt={attachment.file_name}
                style={{ borderRadius: tokens.radius.md }}
              />
              <a
                className="chat-file-download"
                href={source}
                download={attachment.file_name}
                aria-label={`دریافت ${attachment.file_name}`}
                style={{
                  color: tokens.color.primary,
                  borderColor: tokens.color.border,
                  background: tokens.color.surfaceMuted,
                }}
              >
                دریافت تصویر
              </a>
            </>
          ) : attachment.type === 'video' ? (
            <video
              className="chat-file-video"
              src={source}
              controls
              preload="metadata"
              aria-label={attachment.file_name}
              style={{ borderRadius: tokens.radius.md, background: tokens.color.surfaceMuted }}
            />
          ) : attachment.type === 'voice' || attachment.type === 'audio' ? (
            <>
              <VoicePlayer attachment={attachment} source={source} isOnline={isOnline} />
              <a
                className="chat-file-download"
                href={source}
                download={attachment.file_name}
                aria-label={`دریافت ${attachment.file_name}`}
                style={{
                  color: tokens.color.primary,
                  borderColor: tokens.color.border,
                  background: tokens.color.surfaceMuted,
                }}
              >
                دریافت فایل صوتی
              </a>
            </>
          ) : (
            <a
              className="chat-file-download"
              href={source}
              download={attachment.file_name}
              aria-label={`دریافت ${attachment.file_name}`}
              style={{
                color: tokens.color.primary,
                borderColor: tokens.color.border,
                background: tokens.color.surfaceMuted,
              }}
            >
              دریافت فایل
            </a>
          )}
        </>
      ) : null}
    </article>
  )
}

function recordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

function preferredAudioMimeType(): string {
  const candidates = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm']
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate
    } catch {
      // Try the next supported browser format.
    }
  }
  return ''
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export interface VoiceRecorderProps {
  disabled?: boolean
  onRecorded: (file: MediaFile) => void
  onError?: (error: Error) => void
}

type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopping'

export function VoiceRecorder({ disabled = false, onRecorded, onError }: VoiceRecorderProps) {
  const { tokens } = useTheme()
  const [supported] = useState(recordingSupported)
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionRef = useRef(0)
  const disabledRef = useRef(disabled)
  const onRecordedRef = useRef(onRecorded)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    disabledRef.current = disabled
    onRecordedRef.current = onRecorded
    onErrorRef.current = onError
  }, [disabled, onError, onRecorded])

  const cleanupRecording = useCallback(() => {
    if (durationTimerRef.current !== null) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // The recorder may already have stopped after a browser-level error.
        }
      }
    }
    stopStream(streamRef.current)
    streamRef.current = null
    chunksRef.current = []
    startedAtRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      sessionRef.current += 1
      cleanupRecording()
    }
  }, [cleanupRecording])

  const fail = (reason: unknown) => {
    const normalized = toError(reason)
    cleanupRecording()
    setStatus('idle')
    setError(normalized.message)
    onErrorRef.current?.(normalized)
  }

  const start = async () => {
    if (disabled || status !== 'idle' || !supported) return
    const session = ++sessionRef.current
    chunksRef.current = []
    setError('')
    setDuration(0)
    setStatus('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (session !== sessionRef.current || disabledRef.current) {
        stopStream(stream)
        if (session === sessionRef.current) setStatus('idle')
        return
      }
      streamRef.current = stream
      const mimeType = preferredAudioMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      const chunks: Blob[] = []
      chunksRef.current = chunks
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (session === sessionRef.current && event.data.size > 0) chunks.push(event.data)
      }
      recorder.onerror = () => {
        if (session === sessionRef.current) fail(new Error('ضبط صدا ناموفق بود.'))
      }
      recorder.onstop = () => {
        if (session !== sessionRef.current) return
        const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: recordedMimeType })
        const recordedDuration =
          startedAtRef.current === null
            ? 0
            : Math.round((Date.now() - startedAtRef.current) / 10) / 100
        cleanupRecording()
        setStatus('idle')
        setDuration(Math.floor(recordedDuration))

        if (blob.size === 0) {
          fail(new Error('صدایی ضبط نشد.'))
          return
        }

        try {
          const extension = recordedMimeType.includes('ogg') ? 'ogg' : 'webm'
          const uri = URL.createObjectURL(blob)
          try {
            onRecordedRef.current({
              uri,
              name: `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
              mimeType: recordedMimeType,
              size: blob.size,
              type: 'voice',
              duration: recordedDuration,
            })
          } catch (reason) {
            URL.revokeObjectURL(uri)
            throw reason
          }
        } catch (reason) {
          fail(reason)
        }
      }

      recorder.start(250)
      startedAtRef.current = Date.now()
      setStatus('recording')
      durationTimerRef.current = setInterval(() => {
        if (startedAtRef.current !== null) {
          setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000))
        }
      }, 250)
    } catch (reason) {
      if (session === sessionRef.current) fail(reason)
    }
  }

  const stop = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    setStatus('stopping')
    recorder.stop()
  }

  const cancel = () => {
    if (status === 'idle') return
    sessionRef.current += 1
    cleanupRecording()
    setStatus('idle')
    setDuration(0)
    setError('')
  }

  if (!supported) return null

  const statusLabel =
    status === 'requesting'
      ? 'در حال آماده‌سازی میکروفن...'
      : status === 'recording'
        ? 'در حال ضبط'
        : status === 'stopping'
          ? 'در حال پایان ضبط'
          : 'آماده ضبط'

  return (
    <div
      className="chat-voice-recorder"
      role="group"
      aria-label="ضبط پیام صوتی"
      style={{ color: tokens.color.textPrimary }}
    >
      <span className="chat-voice-recorder-status" role="status" aria-live="polite">
        {status === 'recording' ? (
          <span
            className="chat-recording-dot"
            aria-hidden="true"
            style={{ background: tokens.color.danger }}
          />
        ) : null}
        {statusLabel}
      </span>
      <span className="chat-voice-recorder-duration" aria-label="مدت ضبط">
        {formatDuration(duration)}
      </span>
      <Button
        label={status === 'idle' ? 'شروع ضبط' : status === 'requesting' ? 'آماده‌سازی' : 'ضبط'}
        size="sm"
        onPress={() => void start()}
        loading={status === 'requesting'}
        disabled={disabled || status !== 'idle'}
      />
      <Button
        label="پایان ضبط"
        variant="secondary"
        size="sm"
        onPress={stop}
        disabled={status !== 'recording'}
      />
      <Button label="لغو" variant="ghost" size="sm" onPress={cancel} disabled={status === 'idle'} />
      {error ? (
        <p
          className="chat-voice-recorder-error"
          role="alert"
          style={{ color: tokens.color.danger }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface VoicePlayerProps {
  attachment: Attachment
  source?: string
  isOnline?: boolean
  disabled?: boolean
}

export function VoicePlayer({
  attachment,
  source,
  isOnline = true,
  disabled = false,
}: VoicePlayerProps) {
  const { tokens } = useTheme()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playback, setPlayback] = useState<{
    source?: string
    playing: boolean
    error: string
  }>({ source, playing: false, error: '' })
  const currentPlayback = playback.source === source ? playback : null
  const playing = currentPlayback?.playing ?? false
  const playbackError = currentPlayback?.error ?? ''
  const needsInternet = !isOnline && !source

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      if (audio.readyState > 0) audio.currentTime = 0
    }
  }, [source])

  useEffect(() => {
    if (disabled) audioRef.current?.pause()
  }, [disabled])

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio || disabled || needsInternet || !source) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    setPlayback({ source, playing: false, error: '' })
    try {
      await audio.play()
    } catch {
      setPlayback({ source, playing: false, error: 'پخش صدا ناموفق بود.' })
    }
  }

  const statusText = needsInternet
    ? 'نیاز به اینترنت'
    : playbackError
      ? playbackError
      : playing
        ? 'در حال پخش'
        : source
          ? isOnline
            ? 'آماده پخش'
            : 'آماده پخش آفلاین'
          : 'در حال دریافت منبع'
  const duration = formatDuration(attachment.duration)

  return (
    <div
      className="chat-voice-player"
      role="group"
      aria-label={`پخش ${attachment.file_name}`}
      style={{ color: tokens.color.textPrimary }}
    >
      <audio
        ref={audioRef}
        src={source}
        preload="metadata"
        aria-label={`صدای ${attachment.file_name}`}
        onPlay={() => setPlayback({ source, playing: true, error: '' })}
        onPause={() =>
          setPlayback((current) => ({
            source,
            playing: false,
            error: current.source === source ? current.error : '',
          }))
        }
        onEnded={() => setPlayback({ source, playing: false, error: '' })}
        onError={() => {
          if (source) setPlayback({ source, playing: false, error: 'پخش صدا ناموفق بود.' })
        }}
      />
      <div className="chat-voice-player-button">
        <Button
          label={playing ? 'توقف' : 'پخش'}
          size="sm"
          accessibilityLabel={
            needsInternet
              ? 'نیاز به اینترنت'
              : !source
                ? 'در حال دریافت منبع'
                : playing
                  ? 'توقف پخش صدا'
                  : 'پخش صدا'
          }
          disabled={disabled || needsInternet || !source}
          onPress={() => void togglePlayback()}
          icon={<span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>}
        />
      </div>
      <div className="chat-voice-player-content">
        <span className="chat-voice-player-name" title={attachment.file_name}>
          {attachment.file_name}
        </span>
        <span
          className="chat-voice-player-status"
          style={{
            color:
              playbackError || needsInternet ? tokens.color.danger : tokens.color.textSecondary,
          }}
        >
          <span role="status" aria-live="polite" aria-atomic="true">
            {statusText}
          </span>
          {duration ? <span aria-label="مدت فایل صوتی">{` • ${duration}`}</span> : null}
        </span>
      </div>
    </div>
  )
}
