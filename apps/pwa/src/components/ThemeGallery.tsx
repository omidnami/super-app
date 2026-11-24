import { useEffect, type CSSProperties } from 'react'
import { APP_NAME } from '@superapp/domain'
import type { ColorTokens } from '@superapp/design-tokens'
import { useTheme } from '@superapp/theme'
import { ThemeControls } from './ThemeControls'

const navItems = [
  { key: 'superapp', label: 'سوپرآپ' },
  { key: 'messenger', label: 'پیام‌رسان' },
  { key: 'account', label: 'مدیریت حساب' },
] as const

const colorEntries: Array<[keyof Omit<ColorTokens, 'nav'>, string]> = [
  ['background', 'Background'],
  ['surface', 'Surface'],
  ['surfaceElevated', 'Surface Elevated'],
  ['surfaceMuted', 'Surface Muted'],
  ['textPrimary', 'Text Primary'],
  ['textSecondary', 'Text Secondary'],
  ['textTertiary', 'Text Tertiary'],
  ['border', 'Border'],
  ['borderStrong', 'Border Strong'],
  ['primary', 'Primary'],
  ['primaryHover', 'Primary Hover'],
  ['primaryPressed', 'Primary Pressed'],
  ['onPrimary', 'On Primary'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['danger', 'Danger'],
  ['info', 'Info'],
  ['skeleton', 'Skeleton'],
]

export function ThemeGallery() {
  const { resolvedMode, tokens } = useTheme()

  useEffect(() => {
    document.documentElement.style.colorScheme = resolvedMode
    document.documentElement.dataset.theme = resolvedMode
  }, [resolvedMode])

  const appStyle = {
    '--color-background': tokens.color.background,
    '--color-surface': tokens.color.surface,
    '--color-surface-elevated': tokens.color.surfaceElevated,
    '--color-surface-muted': tokens.color.surfaceMuted,
    '--color-text-primary': tokens.color.textPrimary,
    '--color-text-secondary': tokens.color.textSecondary,
    '--color-text-tertiary': tokens.color.textTertiary,
    '--color-border': tokens.color.border,
    '--color-border-strong': tokens.color.borderStrong,
    '--color-primary': tokens.color.primary,
    '--color-on-primary': tokens.color.onPrimary,
    '--color-success': tokens.color.success,
    '--color-warning': tokens.color.warning,
    '--color-danger': tokens.color.danger,
    '--color-info': tokens.color.info,
    '--color-skeleton': tokens.color.skeleton,
    '--font-display-size': `${tokens.typography.display.fontSize}px`,
    '--font-display-line': `${tokens.typography.display.lineHeight}px`,
    '--font-title-size': `${tokens.typography.title.fontSize}px`,
    '--font-title-line': `${tokens.typography.title.lineHeight}px`,
    '--font-body-size': `${tokens.typography.body.fontSize}px`,
    '--font-body-line': `${tokens.typography.body.lineHeight}px`,
    '--font-caption-size': `${tokens.typography.caption.fontSize}px`,
    '--font-caption-line': `${tokens.typography.caption.lineHeight}px`,
    '--space-xs': `${tokens.spacing.xs}px`,
    '--space-sm': `${tokens.spacing.sm}px`,
    '--space-md': `${tokens.spacing.md}px`,
    '--space-lg': `${tokens.spacing.lg}px`,
    '--space-xl': `${tokens.spacing.xl}px`,
    '--space-xxl': `${tokens.spacing.xxl}px`,
    '--radius-sm': `${tokens.radius.sm}px`,
    '--radius-md': `${tokens.radius.md}px`,
    '--radius-lg': `${tokens.radius.lg}px`,
    '--radius-xl': `${tokens.radius.xl}px`,
    '--radius-full': `${tokens.radius.full}px`,
  } as CSSProperties

  return (
    <main className="theme-app" style={appStyle} dir="rtl">
      <div className="theme-gallery" data-testid="theme-gallery">
        <header className="gallery-header">
          <h1>{APP_NAME}</h1>
          <p>Theme Gallery · {resolvedMode}</p>
        </header>

        <ThemeControls />

        <section className="theme-section" aria-labelledby="semantic-colors-title">
          <h2 id="semantic-colors-title">رنگ‌های Semantic</h2>
          <div className="swatch-grid">
            {colorEntries.map(([key, label]) => (
              <div className="swatch-item" key={key}>
                <div className="color-box" style={{ backgroundColor: tokens.color[key] }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="theme-section" aria-labelledby="mini-app-colors-title">
          <h2 id="mini-app-colors-title">رنگ مینی‌اپ‌ها</h2>
          <div className="nav-chip-row">
            {navItems.map(({ key, label }) => (
              <span
                key={key}
                className="nav-chip"
                style={{
                  backgroundColor: tokens.color.nav[key as keyof ColorTokens['nav']],
                  color:
                    tokens.color.nav[
                      `on${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof ColorTokens['nav']
                    ],
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="theme-section" aria-labelledby="typography-title">
          <h2 id="typography-title">Typography</h2>
          <p className="type-display">نمایش Display</p>
          <p className="type-title">نمایش Title</p>
          <p className="type-body">نمایش Body برای متن‌های روزمره</p>
          <p className="type-caption">نمایش Caption</p>
        </section>

        <section className="theme-section" aria-labelledby="spacing-title">
          <h2 id="spacing-title">Spacing</h2>
          <div className="spacing-list">
            {Object.entries(tokens.spacing).map(([key, value]) => (
              <div className="spacing-item" key={key}>
                <span>
                  {key} · {value}
                </span>
                <span className="spacing-track">
                  <span className="spacing-bar" style={{ width: value }} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="theme-section" aria-labelledby="radius-title">
          <h2 id="radius-title">Radius</h2>
          <div className="radius-row">
            {Object.entries(tokens.radius).map(([key, value]) => (
              <div className="radius-item" key={key}>
                <span className="radius-box" style={{ borderRadius: Math.min(value, 40) }} />
                <span>{key}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="theme-section" aria-labelledby="elevation-title">
          <h2 id="elevation-title">Elevation</h2>
          <div className="elevation-row">
            {Object.entries(tokens.elevation).map(([key, value]) => (
              <div
                className="elevation-box"
                key={key}
                style={{
                  boxShadow:
                    value === 0
                      ? 'none'
                      : `0 ${value * 2}px ${value * 5}px ${tokens.color.overlay}`,
                }}
              >
                {key}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
