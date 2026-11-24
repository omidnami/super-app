import { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useTheme } from '@superapp/theme'
import { readableOnColor, type ThemeTokens } from '@superapp/design-tokens'
import { formatMoney, formatPersianDate } from '../src/format'
import type {
  AvatarProps,
  BadgeProps,
  BadgeTone,
  ButtonProps,
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

function toneColor(tokens: ThemeTokens, tone: BadgeTone) {
  return {
    neutral: tokens.color.surfaceMuted,
    primary: tokens.color.primary,
    success: tokens.color.success,
    warning: tokens.color.warning,
    danger: tokens.color.danger,
    info: tokens.color.info,
  }[tone]
}

function toneTextColor(tokens: ThemeTokens, tone: BadgeTone) {
  if (tone === 'primary') return tokens.color.onPrimary
  if (tone === 'neutral') return tokens.color.textSecondary
  return readableOnColor(toneColor(tokens, tone))
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
  const background = {
    primary: tokens.color.primary,
    secondary: tokens.color.surfaceMuted,
    ghost: 'transparent',
    danger: tokens.color.danger,
  }[variant]
  const foreground = {
    primary: tokens.color.onPrimary,
    secondary: tokens.color.textPrimary,
    ghost: tokens.color.primary,
    danger: readableOnColor(tokens.color.danger),
  }[variant]
  const height = { sm: 36, md: 44, lg: 52 }[size]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? tokens.color.border : 'transparent',
          borderRadius: tokens.radius.md,
          height,
          paddingHorizontal: tokens.spacing.lg,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} size="small" /> : icon}
      <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.iconButton,
        {
          backgroundColor: variant === 'secondary' ? tokens.color.surfaceMuted : 'transparent',
          borderColor: tokens.color.border,
          borderRadius: tokens.radius.md,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon}
    </Pressable>
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
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      {label ? (
        <Text style={[styles.label, { color: tokens.color.textSecondary }]}>{label}</Text>
      ) : null}
      <TextInput
        accessibilityLabel={accessibilityLabel || label || placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            backgroundColor: tokens.color.surface,
            borderColor: error ? tokens.color.danger : tokens.color.border,
            borderRadius: tokens.radius.md,
            color: tokens.color.textPrimary,
            paddingHorizontal: tokens.spacing.sm,
          },
        ]}
      />
      {error ? <Text style={[styles.helper, { color: tokens.color.danger }]}>{error}</Text> : null}
      {!error && hint ? (
        <Text style={[styles.helper, { color: tokens.color.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
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
    <View
      style={[
        styles.searchBar,
        {
          backgroundColor: tokens.color.surfaceMuted,
          borderColor: tokens.color.border,
          borderRadius: tokens.radius.md,
        },
      ]}
    >
      <Text style={{ color: tokens.color.textTertiary }}>⌕</Text>
      <TextInput
        accessibilityLabel="جستجو"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.textTertiary}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        style={[styles.searchInput, { color: tokens.color.textPrimary }]}
      />
    </View>
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
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      {label ? (
        <Text style={[styles.label, { color: tokens.color.textSecondary }]}>{label}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || 'انتخاب'}
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          {
            backgroundColor: tokens.color.surface,
            borderColor: error ? tokens.color.danger : tokens.color.border,
            borderRadius: tokens.radius.md,
          },
        ]}
      >
        <Text style={{ color: selected ? tokens.color.textPrimary : tokens.color.textTertiary }}>
          {selected?.label || placeholder}
        </Text>
        <Text style={{ color: tokens.color.textTertiary }}>⌄</Text>
      </Pressable>
      {error ? <Text style={[styles.helper, { color: tokens.color.danger }]}>{error}</Text> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: tokens.color.overlay }]}
          onPress={() => setOpen(false)}
        >
          <View
            style={[
              styles.optionSheet,
              { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.lg },
            ]}
          >
            {options.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                onPress={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                style={[styles.optionRow, { borderBottomColor: tokens.color.border }]}
              >
                <Text style={{ color: tokens.color.textPrimary }}>{option.label}</Text>
                {option.value === value ? (
                  <Text style={{ color: tokens.color.primary }}>✓</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
}: DatePickerProps) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType="default"
    />
  )
}

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const { tokens } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`فیلتر ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? tokens.color.primary : tokens.color.surfaceMuted,
          borderColor: selected ? tokens.color.primary : tokens.color.border,
          borderRadius: tokens.radius.full,
        },
      ]}
    >
      <Text style={{ color: selected ? tokens.color.onPrimary : tokens.color.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  )
}

export function Tabs<T extends string>({ items, value, onChange }: TabsProps<T>) {
  const { tokens } = useTheme()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsRow}
    >
      {items.map((item) => {
        const selected = item.value === value
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.value)}
            style={[
              styles.tab,
              { borderBottomColor: selected ? tokens.color.primary : 'transparent' },
            ]}
          >
            <Text style={{ color: selected ? tokens.color.primary : tokens.color.textSecondary }}>
              {item.label}
            </Text>
            {item.badge ? (
              <Text style={[styles.tabBadge, { color: tokens.color.textTertiary }]}>
                {item.badge}
              </Text>
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

export function Card({ children, onPress, accessibilityLabel }: CardProps) {
  const { tokens } = useTheme()
  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.color.surface,
          borderColor: tokens.color.border,
          borderRadius: tokens.radius.lg,
          padding: tokens.spacing.lg,
        },
      ]}
    >
      {children}
    </View>
  )
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
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
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel || title}
      onPress={onPress}
      style={[
        styles.listItem,
        { borderBottomColor: tokens.color.border, paddingVertical: tokens.spacing.sm },
      ]}
    >
      {leading}
      <View style={styles.listItemContent}>
        <Text style={{ color: tokens.color.textPrimary }}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.helper, { color: tokens.color.textTertiary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  )
}

export function Avatar({ label, size = 'md' }: AvatarProps) {
  const { tokens } = useTheme()
  const dimension = { sm: 32, md: 40, lg: 56 }[size]
  return (
    <View
      accessibilityLabel={label}
      style={[
        styles.avatar,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: tokens.color.primary,
        },
      ]}
    >
      <Text style={{ color: tokens.color.onPrimary, fontWeight: '700' }}>{label.slice(0, 2)}</Text>
    </View>
  )
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { tokens } = useTheme()
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: toneColor(tokens, tone), borderRadius: tokens.radius.full },
      ]}
    >
      <Text style={{ color: toneTextColor(tokens, tone) }}>{label}</Text>
    </View>
  )
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const { tokens } = useTheme()
  return (
    <View style={styles.statusPill}>
      <View style={[styles.statusDot, { backgroundColor: toneColor(tokens, tone) }]} />
      <Text style={{ color: tokens.color.textSecondary }}>{label}</Text>
    </View>
  )
}

export function MoneyText({ amount, currency = 'IRR' }: MoneyTextProps) {
  const { tokens } = useTheme()
  return <Text style={{ color: tokens.color.textPrimary }}>{formatMoney(amount, currency)}</Text>
}

export function PersianDateText({ value }: PersianDateTextProps) {
  const { tokens } = useTheme()
  return <Text style={{ color: tokens.color.textSecondary }}>{formatPersianDate(value)}</Text>
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  buttonText: { fontWeight: '700', textAlign: 'center' },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: { fontSize: 12 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helper: { fontSize: 11 },
  searchBar: {
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, textAlign: 'right' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  optionSheet: { overflow: 'hidden' },
  optionRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1 },
  tabsRow: { gap: 4 },
  tab: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 2,
  },
  tabBadge: { fontSize: 10 },
  card: { borderWidth: 1 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemContent: { flex: 1, gap: 2 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
})
