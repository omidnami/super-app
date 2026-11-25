import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
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
    <View style={styles.center}>
      {icon}
      <Text style={[styles.title, { color: tokens.color.textPrimary }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: tokens.color.textTertiary }]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={[
            styles.action,
            { backgroundColor: tokens.color.primary, borderRadius: tokens.radius.md },
          ]}
        >
          <Text style={{ color: tokens.color.onPrimary }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
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
    <View
      style={[
        styles.center,
        styles.errorBox,
        { borderColor: tokens.color.danger, borderRadius: tokens.radius.lg },
      ]}
    >
      <Text style={[styles.title, { color: tokens.color.danger }]}>{title}</Text>
      <Text style={[styles.description, { color: tokens.color.textSecondary }]}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={[
            styles.action,
            { borderColor: tokens.color.danger, borderRadius: tokens.radius.md },
          ]}
        >
          <Text style={{ color: tokens.color.danger }}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function Skeleton({ width = '100%', height = 16, rounded = 8 }: SkeletonProps) {
  const { tokens } = useTheme()
  return (
    <View
      style={[
        styles.skeleton,
        { width, height, borderRadius: rounded, backgroundColor: tokens.color.skeleton },
      ]}
    />
  )
}

export function OfflineBanner({ visible, onRetry }: OfflineBannerProps) {
  const { tokens } = useTheme()
  if (!visible) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="بازتلاش اتصال"
      onPress={onRetry}
      style={[
        styles.banner,
        { backgroundColor: tokens.color.warning, borderRadius: tokens.radius.md },
      ]}
    >
      <Text style={{ color: readableOnColor(tokens.color.warning) }}>
        آفلاین هستید؛ داده‌های ذخیره‌شده نمایش داده می‌شوند.
      </Text>
    </Pressable>
  )
}

export function SyncStatusBar({ status, lastSyncedAt, onPress }: SyncStatusBarProps) {
  const { tokens } = useTheme()
  const label = {
    idle: 'آماده سینک',
    syncing: 'در حال سینک...',
    success: lastSyncedAt ? `آخرین سینک: ${formatPersianDateTime(lastSyncedAt)}` : 'همگام شد',
    error: 'سینک ناموفق',
  }[status]
  const color =
    status === 'error'
      ? tokens.color.danger
      : status === 'success'
        ? tokens.color.success
        : tokens.color.info
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.syncBar, { borderColor: tokens.color.border, borderRadius: tokens.radius.md }]}
    >
      {status === 'syncing' ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={{ color: tokens.color.textSecondary }}>{label}</Text>
    </Pressable>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={message}
      onPress={onDismiss}
      style={[styles.toast, { backgroundColor: background, borderRadius: tokens.radius.lg }]}
    >
      <Text style={{ color: readableOnColor(background) }}>{message}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 12, lineHeight: 20, textAlign: 'center' },
  action: {
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  errorBox: { borderWidth: 1 },
  skeleton: { opacity: 0.7 },
  banner: { minHeight: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  syncBar: {
    minHeight: 40,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  toast: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
})
