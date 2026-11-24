import type { ReactNode } from 'react'
import type { AppModule } from '@superapp/domain'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  accessibilityLabel?: string
}

export interface IconButtonProps {
  icon: ReactNode
  accessibilityLabel: string
  onPress?: () => void
  disabled?: boolean
  variant?: ButtonVariant
}

export interface TextFieldProps {
  label?: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  error?: string
  hint?: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'
  accessibilityLabel?: string
}

export interface SearchBarProps {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  onSubmit?: () => void
}

export interface SelectOption {
  label: string
  value: string
}

export interface SelectProps {
  label?: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  error?: string
}

export interface DatePickerProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export interface FilterChipProps {
  label: string
  selected: boolean
  onPress: () => void
}

export interface TabsProps<T extends string = string> {
  items: Array<{ value: T; label: string; badge?: number }>
  value: T
  onChange: (value: T) => void
}

export interface CardProps {
  children: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
}

export interface ListItemProps {
  title: string
  subtitle?: string
  leading?: ReactNode
  trailing?: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
}

export interface AvatarProps {
  label: string
  size?: 'sm' | 'md' | 'lg'
}

export interface BadgeProps {
  label: string
  tone?: BadgeTone
}

export interface StatusPillProps {
  label: string
  tone?: BadgeTone
}

export interface MoneyTextProps {
  amount: number
  currency?: 'IRR'
  style?: unknown
}

export interface PersianDateTextProps {
  value: string | Date
  style?: unknown
}

export interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}

export interface ErrorStateProps {
  title?: string
  message: string
  retryLabel?: string
  onRetry?: () => void
}

export interface SkeletonProps {
  width?: number | string
  height?: number
  rounded?: number
}

export interface InfiniteListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  keyExtractor: (item: T, index: number) => string
  onEndReached?: () => void
  loading?: boolean
  hasMore?: boolean
  emptyState?: ReactNode
  accessibilityLabel?: string
}

export interface PaginationListProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export interface ModalProps {
  visible: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export interface BottomSheetProps extends ModalProps {
  maxHeight?: number | string
}

export interface ConfirmDialogProps {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

export interface ToastProps {
  message: string
  tone?: 'neutral' | 'success' | 'error'
  onDismiss?: () => void
}

export interface OfflineBannerProps {
  visible: boolean
  onRetry?: () => void
}

export interface SyncStatusBarProps {
  status: 'idle' | 'syncing' | 'success' | 'error'
  lastSyncedAt?: string
  onPress?: () => void
}

export interface ScreenProps {
  children: ReactNode
  scroll?: boolean
  accessibilityLabel?: string
}

export interface HeaderProps {
  title: string
  subtitle?: string
  leading?: ReactNode
  trailing?: ReactNode
}

export interface MiniAppHeaderProps {
  module: AppModule
  title: string
  subtitle?: string
  trailing?: ReactNode
}

export interface NavigationItem {
  module: AppModule
  label: string
}

export interface MobileNavigationProps {
  activeModule: AppModule
  onModuleChange: (module: AppModule) => void
  items?: NavigationItem[]
}

export interface DesktopSidebarProps extends MobileNavigationProps {
  title?: string
}

export interface MiniAppShellProps {
  module: AppModule
  title: string
  subtitle?: string
  children: ReactNode
  navigation?: ReactNode
  mobileNavigation?: ReactNode
  trailing?: ReactNode
}
