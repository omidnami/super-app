import type { ReactNode } from 'react'
import type { ThemeMode } from '@superapp/design-tokens'

export const THEME_MODE_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: 'system', label: 'سیستم' },
  { mode: 'light', label: 'روشن' },
  { mode: 'dark', label: 'تاریک' },
]

export interface ThemeModeSelectorProps {
  value: ThemeMode
  onChange: (mode: ThemeMode) => void
  renderOption: (options: {
    mode: ThemeMode
    label: string
    selected: boolean
    accessibilityLabel: string
    onPress: () => void
  }) => ReactNode
}

export function ThemeModeSelector({ value, onChange, renderOption }: ThemeModeSelectorProps) {
  return (
    <>
      {THEME_MODE_OPTIONS.map((option) => {
        const selected = value === option.mode
        return renderOption({
          ...option,
          selected,
          accessibilityLabel: `انتخاب تم ${option.label}`,
          onPress: () => onChange(option.mode),
        })
      })}
    </>
  )
}
