import type { CSSProperties } from 'react'
import { DEFAULT_ACCENT_COLOR, normalizeHexColor } from '@superapp/design-tokens'
import { useTheme } from '@superapp/theme'
import { AccentColorPicker, ThemeModeSelector } from '@superapp/ui'

export function ThemeControls() {
  const { accentColor, setAccentColor, setThemeMode, themeMode, tokens } = useTheme()

  return (
    <section className="theme-section" aria-labelledby="theme-controls-title">
      <h2 id="theme-controls-title">تنظیمات تم</h2>

      <div className="control-group">
        <p className="control-label">حالت تم</p>
        <div className="theme-mode-row">
          <ThemeModeSelector
            value={themeMode}
            onChange={setThemeMode}
            renderOption={({ label, selected, accessibilityLabel, onPress }) => (
              <button
                key={label}
                type="button"
                className="theme-mode-button"
                aria-label={accessibilityLabel}
                aria-pressed={selected}
                onClick={onPress}
                style={
                  {
                    '--button-background': selected
                      ? tokens.color.primary
                      : tokens.color.surfaceMuted,
                    '--button-border': selected ? tokens.color.primary : tokens.color.border,
                    '--button-text': selected ? tokens.color.onPrimary : tokens.color.textSecondary,
                  } as CSSProperties
                }
              >
                {label}
              </button>
            )}
          />
        </div>
      </div>

      <div className="control-group">
        <p className="control-label">رنگ برند</p>
        <div className="accent-row">
          <AccentColorPicker
            value={accentColor}
            onChange={setAccentColor}
            renderPreset={({ preset, selected, accessibilityLabel, onPress }) => (
              <button
                key={preset.id}
                type="button"
                className="accent-swatch"
                aria-label={accessibilityLabel}
                aria-pressed={selected}
                onClick={onPress}
                style={
                  {
                    '--swatch-color': preset.color,
                    '--swatch-border': selected ? tokens.color.primary : 'transparent',
                  } as CSSProperties
                }
              />
            )}
            renderCustomInput={({ value, accessibilityLabel, onChange }) => (
              <div className="custom-color-controls">
                <input
                  type="color"
                  aria-label="انتخاب رنگ سفارشی"
                  value={normalizeHexColor(value) || DEFAULT_ACCENT_COLOR}
                  onChange={(event) => onChange(event.target.value)}
                />
                <input
                  key={accentColor}
                  type="text"
                  dir="ltr"
                  className="hex-input"
                  aria-label={accessibilityLabel}
                  defaultValue={value}
                  maxLength={7}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    if (normalizeHexColor(nextValue)) onChange(nextValue)
                  }}
                />
              </div>
            )}
          />
        </div>
      </div>
    </section>
  )
}
