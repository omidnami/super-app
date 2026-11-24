import type { ThemeMode } from '@superapp/design-tokens'

export interface ThemePreferences {
  themeMode: ThemeMode
  accentColor: string
  themePreset: string
}

export interface ThemeContextValue {
  themeMode: ThemeMode
  resolvedMode: 'light' | 'dark'
  accentColor: string
  themePreset: string
  preferences: ThemePreferences
  tokens: import('@superapp/design-tokens').ThemeTokens
  isHydrated: boolean
  setThemeMode: (mode: ThemeMode) => void
  setAccentColor: (color: string) => void
  setThemePreset: (presetId: string) => void
  resetTheme: () => void
}
