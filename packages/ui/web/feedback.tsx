import { readableOnColor } from '@superapp/design-tokens'
import { useTheme } from '@superapp/theme'
import { formatPersianDateTime } from '../src/format'
import type {
  EmptyStateProps,
  ErrorStateProps,
  OfflineBannerProps,
  SkeletonProps,
  SyncStatusBarProps,
  ToastProps,
} from '../src/types'

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  const { tokens } = useTheme()
  return (
    <div className="ui-empty">
      {icon}
      <strong style={{ color: tokens.color.textPrimary }}>{title}</strong>
      {description ? <p style={{ color: tokens.color.textTertiary }}>{description}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          className="ui-button"
          onClick={onAction}
          style={{
            background: tokens.color.primary,
            color: tokens.color.onPrimary,
            borderColor: 'transparent',
            borderRadius: tokens.radius.md,
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function ErrorState({
  title = 'خطایی رخ داد',
  message,
  retryLabel = 'تلاش دوباره',
  onRetry,
}: ErrorStateProps) {
  const { tokens } = useTheme()
  return (
    <div
      className="ui-error"
      style={{ borderColor: tokens.color.danger, borderRadius: tokens.radius.lg }}
    >
      <strong style={{ color: tokens.color.danger }}>{title}</strong>
      <p style={{ color: tokens.color.textSecondary }}>{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="ui-button"
          onClick={onRetry}
          style={{
            background: 'transparent',
            color: tokens.color.danger,
            borderColor: tokens.color.danger,
            borderRadius: tokens.radius.md,
          }}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

export function Skeleton({ width = '100%', height = 16, rounded = 8 }: SkeletonProps) {
  const { tokens } = useTheme()
  return (
    <span
      className="ui-skeleton"
      style={{ width, height, borderRadius: rounded, background: tokens.color.skeleton }}
    />
  )
}

export function OfflineBanner({ visible, onRetry }: OfflineBannerProps) {
  const { tokens } = useTheme()
  if (!visible) return null
  return (
    <button
      type="button"
      className="ui-banner"
      onClick={onRetry}
      style={{
        background: tokens.color.warning,
        color: readableOnColor(tokens.color.warning),
        borderRadius: tokens.radius.md,
      }}
    >
      آفلاین هستید؛ داده‌های ذخیره‌شده نمایش داده می‌شوند.
    </button>
  )
}

export function SyncStatusBar({ status, lastSyncedAt, onPress }: SyncStatusBarProps) {
  const { tokens } = useTheme()
  const label = {
    idle: 'آماده سینک',
    syncing: 'در حال سینک...',
    success: lastSyncedAt ? `آخرین سینک: ${formatPersianDateTime(lastSyncedAt)}` : 'همگام شد',
    stale: lastSyncedAt
      ? `داده قدیمی · آخرین سینک: ${formatPersianDateTime(lastSyncedAt)}`
      : 'داده قدیمی',
    error: 'سینک ناموفق',
  }[status]
  const color =
    status === 'error'
      ? tokens.color.danger
      : status === 'success'
        ? tokens.color.success
        : status === 'stale'
          ? tokens.color.warning
          : tokens.color.info
  return (
    <button
      type="button"
      className="ui-sync"
      onClick={onPress}
      style={{ borderColor: tokens.color.border, borderRadius: tokens.radius.md }}
    >
      <span
        className={status === 'syncing' ? 'ui-spinner' : 'ui-dot'}
        style={
          status === 'syncing'
            ? { borderColor: color, borderTopColor: 'transparent' }
            : { background: color }
        }
      />
      <span style={{ color: tokens.color.textSecondary }}>{label}</span>
    </button>
  )
}

export function Toast({ message, tone = 'neutral', onDismiss }: ToastProps) {
  const { tokens } = useTheme()
  const background =
    tone === 'error'
      ? tokens.color.danger
      : tone === 'success'
        ? tokens.color.success
        : tokens.color.textPrimary
  return (
    <button
      type="button"
      className="ui-toast"
      onClick={onDismiss}
      style={{ background, color: readableOnColor(background), borderRadius: tokens.radius.lg }}
    >
      {message}
    </button>
  )
}
