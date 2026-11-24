import type { CSSProperties } from 'react'
import { readableOnColor } from '@superapp/design-tokens'
import { useTheme } from '@superapp/theme'
import { formatMoney, formatPersianDate } from '../src/format'
import type {
  AvatarProps,
  BadgeProps,
  BadgeTone,
  ButtonProps,
  ButtonVariant,
  CardProps,
  DatePickerProps,
  FilterChipProps,
  IconButtonProps,
  ListItemProps,
  MoneyTextProps,
  PersianDateTextProps,
  SearchBarProps,
  SelectProps,
  StatusPillProps,
  TabsProps,
  TextFieldProps,
} from '../src/types'

function toneColor(tone: BadgeTone, tokens: ReturnType<typeof useTheme>['tokens']) {
  return {
    neutral: tokens.color.surfaceMuted,
    primary: tokens.color.primary,
    success: tokens.color.success,
    warning: tokens.color.warning,
    danger: tokens.color.danger,
    info: tokens.color.info,
  }[tone]
}

function toneTextColor(tone: BadgeTone, tokens: ReturnType<typeof useTheme>['tokens']) {
  if (tone === 'primary') return tokens.color.onPrimary
  if (tone === 'neutral') return tokens.color.textSecondary
  return readableOnColor(toneColor(tone, tokens))
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  accessibilityLabel,
}: ButtonProps) {
  const { tokens } = useTheme()
  const backgrounds: Record<ButtonVariant, string> = {
    primary: tokens.color.primary,
    secondary: tokens.color.surfaceMuted,
    ghost: 'transparent',
    danger: tokens.color.danger,
  }
  const foregrounds: Record<ButtonVariant, string> = {
    primary: tokens.color.onPrimary,
    secondary: tokens.color.textPrimary,
    ghost: tokens.color.primary,
    danger: readableOnColor(tokens.color.danger),
  }
  const heights = { sm: 36, md: 44, lg: 52 }
  return (
    <button
      type="button"
      className="ui-button"
      aria-label={accessibilityLabel || label}
      disabled={disabled || loading}
      onClick={onPress}
      style={{
        minHeight: heights[size],
        background: backgrounds[variant],
        color: foregrounds[variant],
        borderColor: variant === 'secondary' ? tokens.color.border : 'transparent',
        borderRadius: tokens.radius.md,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading ? <span className="ui-spinner" aria-label="در حال بارگذاری" /> : icon}
      <span>{label}</span>
    </button>
  )
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  variant = 'ghost',
}: IconButtonProps) {
  const { tokens } = useTheme()
  return (
    <button
      type="button"
      className="ui-icon-button"
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={onPress}
      style={{
        background: variant === 'secondary' ? tokens.color.surfaceMuted : 'transparent',
        borderColor: tokens.color.border,
        borderRadius: tokens.radius.md,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
    </button>
  )
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  secureTextEntry,
  keyboardType = 'default',
  accessibilityLabel,
}: TextFieldProps) {
  const { tokens } = useTheme()
  const type = secureTextEntry
    ? 'password'
    : keyboardType === 'email-address'
      ? 'email'
      : keyboardType === 'numeric' || keyboardType === 'phone-pad'
        ? 'tel'
        : 'text'
  return (
    <label className="ui-field">
      {label ? <span className="ui-label">{label}</span> : null}
      <input
        aria-label={accessibilityLabel || label || placeholder}
        aria-invalid={Boolean(error)}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChangeText(event.target.value)}
        style={{
          background: tokens.color.surface,
          color: tokens.color.textPrimary,
          borderColor: error ? tokens.color.danger : tokens.color.border,
          borderRadius: tokens.radius.md,
        }}
      />
      {error ? (
        <span className="ui-helper" style={{ color: tokens.color.danger }}>
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span className="ui-helper" style={{ color: tokens.color.textTertiary }}>
          {hint}
        </span>
      ) : null}
    </label>
  )
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'جستجو...',
  onSubmit,
}: SearchBarProps) {
  const { tokens } = useTheme()
  return (
    <div
      className="ui-search"
      style={{
        background: tokens.color.surfaceMuted,
        borderColor: tokens.color.border,
        borderRadius: tokens.radius.md,
      }}
    >
      <span aria-hidden="true">⌕</span>
      <input
        aria-label="جستجو"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChangeText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit?.()
        }}
        style={{ color: tokens.color.textPrimary }}
      />
    </div>
  )
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'انتخاب کنید',
  error,
}: SelectProps) {
  const { tokens } = useTheme()
  return (
    <label className="ui-field">
      {label ? <span className="ui-label">{label}</span> : null}
      <select
        aria-label={label || 'انتخاب'}
        aria-invalid={Boolean(error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          background: tokens.color.surface,
          color: value ? tokens.color.textPrimary : tokens.color.textTertiary,
          borderColor: error ? tokens.color.danger : tokens.color.border,
          borderRadius: tokens.radius.md,
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="ui-helper" style={{ color: tokens.color.danger }}>
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function DatePicker({ label, value, onChange, placeholder }: DatePickerProps) {
  const { tokens } = useTheme()
  return (
    <label className="ui-field">
      {label ? <span className="ui-label">{label}</span> : null}
      <input
        aria-label={label || 'انتخاب تاریخ'}
        type="date"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          background: tokens.color.surface,
          color: tokens.color.textPrimary,
          borderColor: tokens.color.border,
          borderRadius: tokens.radius.md,
        }}
      />
    </label>
  )
}

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const { tokens } = useTheme()
  return (
    <button
      type="button"
      className="ui-chip"
      aria-label={`فیلتر ${label}`}
      aria-pressed={selected}
      onClick={onPress}
      style={{
        background: selected ? tokens.color.primary : tokens.color.surfaceMuted,
        color: selected ? tokens.color.onPrimary : tokens.color.textSecondary,
        borderColor: selected ? tokens.color.primary : tokens.color.border,
        borderRadius: tokens.radius.full,
      }}
    >
      {label}
    </button>
  )
}

export function Tabs<T extends string>({ items, value, onChange }: TabsProps<T>) {
  const { tokens } = useTheme()
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-label={item.label}
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            style={{
              color: selected ? tokens.color.primary : tokens.color.textSecondary,
              borderBottomColor: selected ? tokens.color.primary : 'transparent',
            }}
          >
            {item.label}
            {item.badge ? <span>{item.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function Card({ children, onPress, accessibilityLabel }: CardProps) {
  const { tokens } = useTheme()
  const style: CSSProperties = {
    background: tokens.color.surface,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
  }
  return onPress ? (
    <button
      type="button"
      className="ui-card"
      aria-label={accessibilityLabel}
      onClick={onPress}
      style={style}
    >
      {children}
    </button>
  ) : (
    <div className="ui-card" style={style}>
      {children}
    </div>
  )
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
}: ListItemProps) {
  const { tokens } = useTheme()
  const content = (
    <>
      {leading}
      <span className="ui-list-content">
        <span style={{ color: tokens.color.textPrimary }}>{title}</span>
        {subtitle ? (
          <span className="ui-helper" style={{ color: tokens.color.textTertiary }}>
            {subtitle}
          </span>
        ) : null}
      </span>
      {trailing}
    </>
  )
  return onPress ? (
    <button
      type="button"
      className="ui-list-item"
      aria-label={accessibilityLabel || title}
      onClick={onPress}
      style={{ borderBottomColor: tokens.color.border }}
    >
      {content}
    </button>
  ) : (
    <div className="ui-list-item" style={{ borderBottomColor: tokens.color.border }}>
      {content}
    </div>
  )
}

export function Avatar({ label, size = 'md' }: AvatarProps) {
  const { tokens } = useTheme()
  const dimensions = { sm: 32, md: 40, lg: 56 }
  const dimension = dimensions[size]
  return (
    <span
      className="ui-avatar"
      aria-label={label}
      style={{
        width: dimension,
        height: dimension,
        background: tokens.color.primary,
        color: tokens.color.onPrimary,
        borderRadius: dimension / 2,
      }}
    >
      {label.slice(0, 2)}
    </span>
  )
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { tokens } = useTheme()
  return (
    <span
      className="ui-badge"
      style={{
        background: toneColor(tone, tokens),
        color: toneTextColor(tone, tokens),
        borderRadius: tokens.radius.full,
      }}
    >
      {label}
    </span>
  )
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const { tokens } = useTheme()
  return (
    <span className="ui-status">
      <span style={{ background: toneColor(tone, tokens), borderRadius: 999 }} />
      <span style={{ color: tokens.color.textSecondary }}>{label}</span>
    </span>
  )
}

export function MoneyText({ amount, currency = 'IRR' }: MoneyTextProps) {
  const { tokens } = useTheme()
  return <span style={{ color: tokens.color.textPrimary }}>{formatMoney(amount, currency)}</span>
}

export function PersianDateText({ value }: PersianDateTextProps) {
  const { tokens } = useTheme()
  return <span style={{ color: tokens.color.textSecondary }}>{formatPersianDate(value)}</span>
}
