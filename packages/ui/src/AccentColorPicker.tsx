import type { ReactNode } from 'react'
import { ACCENT_PRESETS, type AccentPreset } from '@superapp/design-tokens'

export interface AccentColorPickerProps {
  value: string
  onChange: (color: string) => void
  presets?: AccentPreset[]
  renderPreset: (options: {
    preset: AccentPreset
    selected: boolean
    accessibilityLabel: string
    onPress: () => void
  }) => ReactNode
  renderCustomInput: (options: {
    value: string
    accessibilityLabel: string
    onChange: (color: string) => void
  }) => ReactNode
}

export function AccentColorPicker({
  value,
  onChange,
  presets = ACCENT_PRESETS,
  renderPreset,
  renderCustomInput,
}: AccentColorPickerProps) {
  const normalizedValue = value.toUpperCase()
  return (
    <>
      {presets.map((preset) =>
        renderPreset({
          preset,
          selected: preset.color.toUpperCase() === normalizedValue,
          accessibilityLabel: `انتخاب رنگ ${preset.label}`,
          onPress: () => onChange(preset.color),
        }),
      )}
      {renderCustomInput({
        value,
        accessibilityLabel: 'رنگ سفارشی با کد HEX',
        onChange,
      })}
    </>
  )
}
