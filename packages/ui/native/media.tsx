import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioSource,
  type RecordingStatus,
} from 'expo-audio'
import { File, Paths } from 'expo-file-system'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import type { ConversationApi, ConversationMediaApi } from '@superapp/api-client'
import type { Attachment, AttachmentType } from '@superapp/chat-contracts'
import type { MediaFile } from '@superapp/media'
import { useTheme } from '@superapp/theme'
import { Button } from './primitives'

export interface AttachmentPickerProps {
  disabled?: boolean
  onSelect: (file: MediaFile) => void
  onError: (error: Error) => void
}

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'cancelled'

export interface UploadProgressProps {
  status: UploadStatus
  progress: number
  error?: string
  onCancel?: () => void
  onRetry?: () => void
}

export interface FileBubbleProps {
  attachment: Attachment
  api: ConversationApi
  conversationId: string
  accessToken?: string
  isOnline?: boolean
  cacheKey?: string
  onError?: (error: Error) => void
}

export interface VoiceRecorderProps {
  disabled?: boolean
  onRecorded: (file: MediaFile) => void
  onError: (error: Error) => void
}

export interface VoicePlayerProps {
  attachment: Attachment
  source?: AudioSource
  isOnline?: boolean
  disabled?: boolean
}

type DownloadPhase = 'checking' | 'idle' | 'downloading' | 'ready' | 'error'

interface DownloadState {
  phase: DownloadPhase
  localUri: string | null
  error: string | null
}

const attachmentTypeLabels: Record<AttachmentType, string> = {
  photo: 'تصویر',
  video: 'ویدیو',
  audio: 'صدا',
  voice: 'پیام صوتی',
  document: 'سند',
}

const mimeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'application/pdf': 'pdf',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error
  if (typeof error === 'string' && error.trim()) return new Error(error)
  return new Error(fallback)
}

function httpStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined
  if (typeof error.status === 'number') return error.status
  if (typeof error.statusCode === 'number') return error.statusCode
  if (isRecord(error.response) && typeof error.response.status === 'number') {
    return error.response.status
  }
  return undefined
}

function formatDuration(seconds: number): string {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  const minuteText = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const secondText = String(remainingSeconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${minuteText}:${secondText}` : `${minuteText}:${secondText}`
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '۰ بایت'
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex
  const amount = value.toLocaleString('fa-IR', {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  })
  return `${amount} ${units[unitIndex] ?? 'بایت'}`
}

function progressPercent(progress: number, status: UploadStatus): number {
  if (status === 'success') return 100
  if (!Number.isFinite(progress)) return 0
  const normalized = progress >= 0 && progress <= 1 ? progress * 100 : progress
  return Math.min(100, Math.max(0, normalized))
}

function inferMimeType(name: string, mimeType?: string): string {
  const normalizedMime = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (normalizedMime && normalizedMime !== 'application/octet-stream') return normalizedMime

  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase()
  const inferred: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
    pdf: 'application/pdf',
  }
  return (extension ? inferred[extension] : undefined) ?? 'application/octet-stream'
}

function inferAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) return 'photo'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

async function pickedFileSize(asset: DocumentPicker.DocumentPickerAsset): Promise<number> {
  if (typeof asset.size === 'number' && Number.isFinite(asset.size)) return asset.size
  const info = await FileSystem.getInfoAsync(asset.uri)
  if (!info.exists || info.isDirectory) throw new Error('اطلاعات فایل انتخاب‌شده در دسترس نیست.')
  return info.size
}

function safePathSegment(value: string, fallback: string): string {
  const sanitized = Array.from(value)
    .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .trim()
  return sanitized.slice(0, 100) || fallback
}

function cachedFileName(attachment: Attachment, cacheKey: string): string {
  const extensionFromName = /\.([a-z0-9]{1,10})$/i.exec(attachment.file_name)?.[1]?.toLowerCase()
  const mimeType = attachment.mime_type.split(';')[0]?.trim().toLowerCase() ?? ''
  const extension = extensionFromName ?? mimeExtensions[mimeType] ?? 'bin'
  const baseName = attachment.file_name.replace(/\.[^.]+$/, '') || 'attachment'
  return `${safePathSegment(cacheKey, 'scope')}-${safePathSegment(baseName, 'attachment')}-${safePathSegment(attachment.id, 'file')}.${extension}`
}

function secureMediaApi(api: ConversationApi): ConversationMediaApi {
  const media = api.media
  if (!media || typeof media.getAttachmentContent !== 'function') {
    throw new Error('دریافت امن فایل در دسترس نیست.')
  }
  return media
}

type ResolvedAttachmentContent =
  { kind: 'url'; url: string; headers?: Record<string, string> } | { kind: 'blob'; blob: Blob }

function resolveAttachmentContent(content: unknown): ResolvedAttachmentContent {
  const payload = isRecord(content) && isRecord(content.data) ? content.data : content
  if (typeof payload === 'string') {
    if (!/^https?:\/\//i.test(payload)) throw new Error('نشانی دانلود فایل معتبر نیست.')
    return { kind: 'url', url: payload }
  }
  if (!isRecord(payload)) throw new Error('پاسخ دریافت فایل معتبر نیست.')

  if (typeof Blob !== 'undefined' && payload.blob instanceof Blob) {
    return { kind: 'blob', blob: payload.blob }
  }

  const candidate = payload.url ?? payload.download_url ?? payload.downloadUrl ?? payload.uri
  if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) {
    let headers: Record<string, string> | undefined
    if (isRecord(payload.headers)) {
      const entries = Object.entries(payload.headers).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      )
      if (entries.length > 0) headers = Object.fromEntries(entries)
    }
    return headers ? { kind: 'url', url: candidate, headers } : { kind: 'url', url: candidate }
  }

  if (payload.mockFile === true) {
    throw new Error('این پیوست آزمایشی فایل قابل دانلودی ندارد.')
  }
  throw new Error('محتوای فایل معتبر نیست.')
}

async function saveBlobToCache(
  blob: Blob,
  attachment: Attachment,
  cacheDirectory: string,
  cacheKey: string,
): Promise<string> {
  await FileSystem.makeDirectoryAsync(cacheDirectory, { intermediates: true })
  const fileName = cachedFileName(attachment, cacheKey)
  const temporaryPath = `${cacheDirectory}${fileName}.part`
  const localPath = `${cacheDirectory}${fileName}`
  const file = new File(Paths.cache, `superapp-media/${fileName}.part`)
  file.create({ overwrite: true })
  await file.write(new Uint8Array(await blob.arrayBuffer()))
  await FileSystem.moveAsync({ from: temporaryPath, to: localPath })
  return localPath
}

function downloadErrorMessage(error: unknown): string {
  const status = httpStatus(error)
  if (status === 403) return 'دسترسی به فایل منقضی شده است. دوباره تلاش کنید.'
  if (status === 404) return 'فایل در سرور یافت نشد.'
  return toError(error, 'دانلود فایل ناموفق بود.').message
}

function localAudioSource(source?: AudioSource): AudioSource {
  if (typeof source === 'string') {
    if (!source || /^https?:/i.test(source)) return null
    return /^[a-z][a-z\d+.-]*:/i.test(source) && !/^(file|content):/i.test(source) ? null : source
  }
  if (typeof source === 'number') return source
  if (source && typeof source === 'object' && typeof source.uri === 'string') {
    return localAudioSource(source.uri)
  }
  return null
}

export function AttachmentPicker({ disabled, onSelect, onError }: AttachmentPickerProps) {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const pick = async () => {
    if (disabled || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
      })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset) throw new Error('فایلی انتخاب نشد.')
      if (!mountedRef.current) return

      const name = asset.name || 'attachment'
      const mimeType = inferMimeType(name, asset.mimeType)
      const size = await pickedFileSize(asset)
      if (!mountedRef.current) return
      onSelect({
        uri: asset.uri,
        name,
        mimeType,
        size,
        type: inferAttachmentType(mimeType),
      })
    } catch (error) {
      if (mountedRef.current) {
        onErrorRef.current(toError(error, 'انتخاب فایل ناموفق بود.'))
      }
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  return (
    <Button
      label="افزودن فایل"
      accessibilityLabel="انتخاب فایل پیوست"
      variant="secondary"
      onPress={() => void pick()}
      disabled={disabled}
      loading={busy}
    />
  )
}

export function UploadProgress({
  status,
  progress,
  error,
  onCancel,
  onRetry,
}: UploadProgressProps) {
  const { tokens } = useTheme()
  const percent = progressPercent(progress, status)
  const statusLabel: Record<UploadStatus, string> = {
    idle: 'در انتظار ارسال',
    uploading: 'در حال ارسال…',
    success: 'ارسال شد',
    error: 'ارسال ناموفق',
    cancelled: 'ارسال لغو شد',
  }
  const fillColor =
    status === 'success'
      ? tokens.color.success
      : status === 'error'
        ? tokens.color.danger
        : status === 'cancelled'
          ? tokens.color.textSecondary
          : tokens.color.primary

  return (
    <View style={{ gap: tokens.spacing.sm }} accessibilityLiveRegion="polite">
      <View style={styles.progressHeader}>
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textSecondary }}>
          {statusLabel[status]}
        </Text>
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textSecondary }}>
          {Math.round(percent).toLocaleString('fa-IR')}٪
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`پیشرفت ارسال: ${statusLabel[status]}`}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(percent),
          text: statusLabel[status],
        }}
        style={[
          styles.progressTrack,
          {
            backgroundColor: tokens.color.surfaceMuted,
            borderRadius: tokens.radius.full,
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: fillColor,
              borderRadius: tokens.radius.full,
              width: `${percent}%`,
            },
          ]}
        />
      </View>
      {status === 'error' && error ? (
        <Text style={{ ...tokens.typography.caption, color: tokens.color.danger }}>{error}</Text>
      ) : null}
      {status === 'uploading' && onCancel ? (
        <Button
          label="لغو ارسال"
          accessibilityLabel="لغو ارسال فایل"
          variant="secondary"
          size="sm"
          onPress={onCancel}
        />
      ) : null}
      {(status === 'error' || status === 'cancelled') && onRetry ? (
        <Button
          label="تلاش دوباره"
          accessibilityLabel="تلاش دوباره برای ارسال فایل"
          size="sm"
          onPress={onRetry}
        />
      ) : null}
    </View>
  )
}

export function FileBubble({
  attachment,
  api,
  conversationId,
  accessToken,
  isOnline = true,
  cacheKey = conversationId,
  onError,
}: FileBubbleProps) {
  const { tokens } = useTheme()
  const cacheDirectory = `${FileSystem.cacheDirectory ?? Paths.cache.uri}superapp-media/`
  const localPath = `${cacheDirectory}${cachedFileName(attachment, cacheKey)}`
  const [downloadState, setDownloadState] = useState<DownloadState>({
    phase: 'checking',
    localUri: null,
    error: null,
  })
  const [sharing, setSharing] = useState(false)
  const mountedRef = useRef(true)
  const busyRef = useRef(false)
  const operationRef = useRef(0)
  const requestRef = useRef<AbortController | null>(null)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      operationRef.current += 1
      requestRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const operation = ++operationRef.current
    requestRef.current?.abort()
    busyRef.current = false

    let cancelled = false
    void FileSystem.getInfoAsync(localPath)
      .then((info) => {
        if (cancelled || !mountedRef.current || operationRef.current !== operation) return
        setDownloadState(
          info.exists && !info.isDirectory && info.size > 0
            ? { phase: 'ready', localUri: info.uri, error: null }
            : { phase: 'idle', localUri: null, error: null },
        )
      })
      .catch(() => {
        if (!cancelled && mountedRef.current && operationRef.current === operation) {
          setDownloadState({ phase: 'idle', localUri: null, error: null })
        }
      })

    return () => {
      cancelled = true
    }
  }, [localPath])

  const download = useCallback(async () => {
    if (busyRef.current) return
    if (!isOnline) {
      setDownloadState((current) => ({ ...current, error: 'نیاز به اینترنت' }))
      return
    }
    busyRef.current = true
    const operation = ++operationRef.current
    const controller = new AbortController()
    requestRef.current = controller
    setDownloadState({ phase: 'downloading', localUri: null, error: null })
    const isCurrent = () => mountedRef.current && operationRef.current === operation

    try {
      // The provider URL stays in this async scope and is never written to message or component state.
      const content = await secureMediaApi(api).getAttachmentContent(attachment.id, {
        conversationId,
        accessToken,
        signal: controller.signal,
      })
      if (!isCurrent()) return
      const resolvedContent = resolveAttachmentContent(content)
      let localUri: string
      if (resolvedContent.kind === 'url') {
        await FileSystem.makeDirectoryAsync(cacheDirectory, { intermediates: true })
        const temporaryPath = `${localPath}.part`
        const result = await FileSystem.downloadAsync(
          resolvedContent.url,
          temporaryPath,
          resolvedContent.headers ? { headers: resolvedContent.headers } : undefined,
        )
        if (!isCurrent()) return
        if (typeof result.status === 'number' && (result.status < 200 || result.status >= 300)) {
          const error = new Error(`دانلود فایل با کد ${result.status} ناموفق بود.`)
          Object.assign(error, { status: result.status })
          throw error
        }
        await FileSystem.moveAsync({ from: temporaryPath, to: localPath })
        localUri = localPath
      } else {
        localUri = await saveBlobToCache(resolvedContent.blob, attachment, cacheDirectory, cacheKey)
      }
      if (!isCurrent()) return
      setDownloadState({ phase: 'ready', localUri, error: null })
    } catch (caught) {
      const error = toError(caught, 'دانلود فایل ناموفق بود.')
      if (controller.signal.aborted || error.name === 'AbortError' || !isCurrent()) return
      try {
        await FileSystem.deleteAsync(localPath, { idempotent: true })
        await FileSystem.deleteAsync(`${localPath}.part`, { idempotent: true })
      } catch {
        // A failed cleanup must not hide the original download error.
      }
      if (!isCurrent()) return
      setDownloadState({
        phase: 'error',
        localUri: null,
        error: downloadErrorMessage(error),
      })
      onErrorRef.current?.(error)
    } finally {
      if (isCurrent()) {
        busyRef.current = false
        requestRef.current = null
      }
    }
  }, [accessToken, api, attachment, cacheDirectory, cacheKey, conversationId, isOnline, localPath])

  const share = async () => {
    const localUri = downloadState.localUri
    if (!localUri || sharing) return
    setSharing(true)
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('اشتراک‌گذاری فایل در این دستگاه در دسترس نیست.')
      }
      await Sharing.shareAsync(localUri, {
        mimeType: attachment.mime_type,
        dialogTitle: attachment.file_name,
      })
    } catch (error) {
      if (mountedRef.current) {
        onErrorRef.current?.(toError(error, 'اشتراک‌گذاری فایل ناموفق بود.'))
      }
    } finally {
      if (mountedRef.current) setSharing(false)
    }
  }

  const isReady = downloadState.phase === 'ready' && Boolean(downloadState.localUri)
  const isAudio = attachment.type === 'voice' || attachment.type === 'audio'
  const statusLabel = isReady
    ? isOnline
      ? 'آماده'
      : 'آماده • آفلاین'
    : !isOnline
      ? 'آفلاین'
      : downloadState.phase === 'checking'
        ? 'در حال بررسی فایل'
        : downloadState.phase === 'downloading'
          ? 'در حال دانلود'
          : downloadState.phase === 'error'
            ? 'دانلود ناموفق'
            : 'نیاز به اینترنت'
  const statusMessage = isReady
    ? isOnline
      ? 'فایل روی این دستگاه ذخیره شده است.'
      : 'آماده • آفلاین — فایل روی این دستگاه ذخیره شده است.'
    : !isOnline
      ? 'نیاز به اینترنت'
      : downloadState.phase === 'checking'
        ? 'در حال بررسی نسخه ذخیره‌شده…'
        : downloadState.phase === 'downloading'
          ? 'در حال دریافت امن فایل…'
          : downloadState.phase === 'error'
            ? downloadState.error
            : 'برای دانلود فایل به اینترنت نیاز دارید.'

  return (
    <View
      style={[
        styles.fileBubble,
        {
          backgroundColor: tokens.color.surface,
          borderColor: tokens.color.border,
          borderRadius: tokens.radius.lg,
          padding: tokens.spacing.md,
          gap: tokens.spacing.sm,
        },
      ]}
    >
      <View style={styles.fileHeader}>
        <View
          accessible
          accessibilityLabel={attachmentTypeLabels[attachment.type]}
          style={[
            styles.fileType,
            {
              backgroundColor: tokens.color.surfaceMuted,
              borderRadius: tokens.radius.md,
            },
          ]}
        >
          <Text style={{ ...tokens.typography.caption, color: tokens.color.primary }}>
            {attachmentTypeLabels[attachment.type]}
          </Text>
        </View>
        <View style={styles.fileContent}>
          <Text
            numberOfLines={2}
            style={{ ...tokens.typography.body, color: tokens.color.textPrimary }}
          >
            {attachment.file_name}
          </Text>
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
            {formatBytes(attachment.file_size)}
            {attachment.duration ? ` · ${formatDuration(attachment.duration)}` : ''}
          </Text>
        </View>
      </View>

      <Text
        accessibilityLiveRegion="polite"
        accessibilityLabel={`وضعیت فایل: ${statusLabel}`}
        style={{
          ...tokens.typography.caption,
          color:
            downloadState.phase === 'error'
              ? tokens.color.danger
              : isReady
                ? tokens.color.success
                : tokens.color.textSecondary,
        }}
      >
        {statusMessage || statusLabel}
      </Text>

      {isAudio && isReady && downloadState.localUri ? (
        <VoicePlayer attachment={attachment} source={downloadState.localUri} isOnline={isOnline} />
      ) : null}

      <View style={styles.fileActions}>
        {!isReady ? (
          <Button
            label={downloadState.phase === 'error' ? 'دانلود دوباره' : 'دانلود فایل'}
            accessibilityLabel={
              downloadState.phase === 'error' ? 'تلاش دوباره برای دانلود فایل' : 'دانلود امن فایل'
            }
            variant="secondary"
            size="sm"
            onPress={() => void download()}
            disabled={!isOnline || downloadState.phase === 'checking'}
            loading={downloadState.phase === 'downloading'}
          />
        ) : (
          <Button
            label="اشتراک‌گذاری"
            accessibilityLabel={`اشتراک‌گذاری فایل ${attachment.file_name}`}
            variant="secondary"
            size="sm"
            onPress={() => void share()}
            loading={sharing}
          />
        )}
      </View>
    </View>
  )
}

export function VoiceRecorder({ disabled, onRecorded, onError }: VoiceRecorderProps) {
  const { tokens } = useTheme()
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const mountedRef = useRef(true)
  const busyRef = useRef(false)
  const disabledRef = useRef(disabled)
  const onRecordedRef = useRef(onRecorded)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    disabledRef.current = disabled
    onRecordedRef.current = onRecorded
    onErrorRef.current = onError
  }, [disabled, onError, onRecorded])

  const reportError = useCallback((error: unknown) => {
    if (mountedRef.current) {
      onErrorRef.current(toError(error, 'ضبط پیام صوتی ناموفق بود.'))
    }
  }, [])

  const handleRecordingStatus = useCallback(
    (status: RecordingStatus) => {
      if (status.hasError) reportError(new Error(status.error || 'ضبط پیام صوتی ناموفق بود.'))
    },
    [reportError],
  )

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, handleRecordingStatus)
  const recorderState = useAudioRecorderState(recorder, 250)
  const recorderStateRef = useRef(recorderState)

  useEffect(() => {
    recorderStateRef.current = recorderState
  }, [recorderState])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (recorder.isRecording) {
        void recorder.stop().catch(() => undefined)
      }
    }
  }, [recorder])

  const startRecording = async () => {
    if (disabledRef.current || busyRef.current || recorder.isRecording) return
    busyRef.current = true
    setBusy(true)
    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!mountedRef.current) return
      if (!permission.granted) throw new Error('دسترسی به میکروفون مجاز نشد.')
      if (disabledRef.current) return

      await recorder.prepareToRecordAsync()
      if (!mountedRef.current || disabledRef.current) return
      recorder.record()
      if (mountedRef.current) setRecording(true)
    } catch (error) {
      if (mountedRef.current) setRecording(false)
      reportError(error)
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }

  const finishRecording = useCallback(
    async (emitRecording: boolean) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      try {
        const recordedDuration = Math.max(
          recorderStateRef.current.durationMillis,
          recorder.getStatus().durationMillis,
        )
        await recorder.stop()
        if (!mountedRef.current) return
        setRecording(false)
        if (!emitRecording) return

        const uri = recorder.uri
        if (!uri) throw new Error('فایل ضبط‌شده در دسترس نیست.')
        const info = await FileSystem.getInfoAsync(uri)
        if (!mountedRef.current) return
        if (!info.exists || info.isDirectory) {
          throw new Error('فایل ضبط‌شده در دسترس نیست.')
        }

        let durationMillis = recordedDuration
        try {
          durationMillis = Math.max(durationMillis, recorder.getStatus().durationMillis)
        } catch {
          // The pre-stop status still provides a duration if the recorder has already unloaded.
        }
        onRecordedRef.current({
          uri,
          name: `voice-${Date.now()}.m4a`,
          mimeType: 'audio/mp4',
          size: info.size,
          type: 'voice',
          duration: durationMillis / 1000,
        })
      } catch (error) {
        if (mountedRef.current) setRecording(false)
        reportError(error)
      } finally {
        busyRef.current = false
        if (mountedRef.current) setBusy(false)
      }
    },
    [recorder, reportError],
  )

  useEffect(() => {
    if (disabled && !busyRef.current && (recording || recorderState.isRecording)) {
      void finishRecording(false)
    }
  }, [disabled, finishRecording, recorderState.isRecording, recording])

  const active = recording || recorderState.isRecording
  const durationSeconds = recorderState.durationMillis / 1000

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <View style={styles.recorderStatus} accessibilityLiveRegion="polite">
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[
            styles.recordingDot,
            { backgroundColor: active ? tokens.color.danger : tokens.color.borderStrong },
          ]}
        />
        <Text style={{ ...tokens.typography.body, color: tokens.color.textPrimary }}>
          {active ? 'در حال ضبط…' : 'آماده ضبط'}
        </Text>
        <Text
          accessibilityLabel={`مدت ضبط: ${formatDuration(durationSeconds)}`}
          style={{ ...tokens.typography.caption, color: tokens.color.textSecondary }}
        >
          {formatDuration(durationSeconds)}
        </Text>
      </View>
      <Button
        label={active ? 'پایان ضبط' : 'شروع ضبط'}
        accessibilityLabel={active ? 'پایان ضبط پیام صوتی' : 'شروع ضبط پیام صوتی'}
        variant={active ? 'danger' : 'primary'}
        onPress={() => void (active ? finishRecording(true) : startRecording())}
        disabled={disabled}
        loading={busy}
      />
    </View>
  )
}

export function VoicePlayer({ attachment, source, isOnline = true, disabled }: VoicePlayerProps) {
  const { tokens } = useTheme()
  const resolvedSource = localAudioSource(source)
  const player = useAudioPlayer(resolvedSource, { updateInterval: 250 })
  const status = useAudioPlayerStatus(player)
  const hasSource = resolvedSource !== null
  const duration =
    Number.isFinite(status.duration) && status.duration > 0
      ? status.duration
      : (attachment.duration ?? 0)
  const currentTime = status.didJustFinish ? duration : Math.min(status.currentTime, duration || 0)
  const percent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0
  const message = status.error
    ? status.error
    : !hasSource
      ? isOnline
        ? 'برای پخش، فایل را دانلود کنید.'
        : 'نیاز به اینترنت'
      : !isOnline
        ? 'آماده پخش آفلاین'
        : null

  useEffect(() => {
    if (disabled && status.playing) player.pause()
  }, [disabled, player, status.playing])

  const togglePlayback = () => {
    if (disabled || !hasSource) return
    try {
      if (status.playing) player.pause()
      else player.play()
    } catch {
      // expo-audio reports asynchronous playback failures through the player status.
    }
  }

  return (
    <View style={[styles.voicePlayer, { borderTopColor: tokens.color.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'توقف پیام صوتی' : 'پخش پیام صوتی'}
        accessibilityState={{ disabled: Boolean(disabled || !hasSource) }}
        disabled={Boolean(disabled || !hasSource)}
        onPress={togglePlayback}
        style={[
          styles.playButton,
          {
            backgroundColor: tokens.color.primary,
            borderRadius: tokens.radius.full,
            opacity: disabled || !hasSource ? 0.5 : 1,
          },
        ]}
      >
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ color: tokens.color.onPrimary, fontSize: 16 }}
        >
          {status.playing ? 'Ⅱ' : '▶'}
        </Text>
      </Pressable>
      <View style={styles.voiceContent}>
        <Text
          numberOfLines={1}
          style={{ ...tokens.typography.caption, color: tokens.color.textPrimary }}
        >
          {attachment.file_name || 'پیام صوتی'}
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="پیشرفت پخش پیام صوتی"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(percent),
            text: `${formatDuration(currentTime)} از ${formatDuration(duration)}`,
          }}
          style={[
            styles.voiceProgressTrack,
            {
              backgroundColor: tokens.color.surfaceMuted,
              borderRadius: tokens.radius.full,
            },
          ]}
        >
          <View
            style={[
              styles.voiceProgressFill,
              {
                backgroundColor: tokens.color.primary,
                borderRadius: tokens.radius.full,
                width: `${percent}%`,
              },
            ]}
          />
        </View>
        <View style={styles.voiceMeta}>
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textSecondary }}>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </Text>
          {message ? (
            <Text
              style={{
                ...tokens.typography.caption,
                color: status.error ? tokens.color.danger : tokens.color.textSecondary,
              }}
            >
              {message}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressTrack: { height: 6, overflow: 'hidden' },
  progressFill: { height: '100%' },
  fileBubble: { maxWidth: '100%', borderWidth: 1 },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileType: { paddingHorizontal: 10, paddingVertical: 6 },
  fileContent: { flex: 1, gap: 2 },
  fileActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  recorderStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4 },
  voicePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  playButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  voiceContent: { flex: 1, gap: 6 },
  voiceProgressTrack: { height: 5, overflow: 'hidden' },
  voiceProgressFill: { height: '100%' },
  voiceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
})
