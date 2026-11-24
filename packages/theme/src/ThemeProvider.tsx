import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import {
  ACCENT_PRESETS,
  createThemeTokens,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_THEME_MODE,
  findAccentPreset,
  normalizeHexColor,
  type ResolvedThemeMode,
  type ThemeMode,
} from '@superapp/design-tokens'
import type { StorageAdapter } from '@superapp/storage'
import type { ThemeContextValue, ThemePreferences } from './types'

export const THEME_STORAGE_KEY = 'superapp.theme.preferences.v1'

const defaultPreferences: ThemePreferences = {
  themeMode: DEFAULT_THEME_MODE,
  accentColor: DEFAULT_ACCENT_COLOR,
  themePreset: 'orange',
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  children: ReactNode
  systemColorScheme: ResolvedThemeMode
  storage: StorageAdapter
  defaultPreferences?: Partial<ThemePreferences>
}

function sanitizePreferences(value: unknown, fallback: ThemePreferences): ThemePreferences {
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<ThemePreferences>
  const themeMode: ThemeMode = ['system', 'light', 'dark'].includes(candidate.themeMode || '')
    ? (candidate.themeMode as ThemeMode)
    : fallback.themeMode
  const accentColor = normalizeHexColor(candidate.accentColor || '') || fallback.accentColor
  const preset = findAccentPreset(accentColor)
  return {
    themeMode,
    accentColor,
    themePreset: preset?.id || candidate.themePreset || fallback.themePreset,
  }
}

export function ThemeProvider({
  children,
  systemColorScheme,
  storage,
  defaultPreferences: suppliedDefaults,
}: ThemeProviderProps) {
  const fallback = useMemo(
    () => sanitizePreferences(suppliedDefaults, defaultPreferences),
    [suppliedDefaults],
  )
  const [preferences, setPreferences] = useState<ThemePreferences>(fallback)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    let active = true
    storage
      .getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!active) return
        if (!stored) return
        try {
          setPreferences(sanitizePreferences(JSON.parse(stored), fallback))
        } catch {
          setPreferences(fallback)
        }
      })
      .catch(() => {
        if (active) setPreferences(fallback)
      })
      .finally(() => {
        if (active) setIsHydrated(true)
      })
    return () => {
      active = false
    }
  }, [fallback, storage])

  useEffect(() => {
    if (!isHydrated) return
    void storage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences))
  }, [isHydrated, preferences, storage])

  const resolvedMode: ResolvedThemeMode =
    preferences.themeMode === 'system' ? systemColorScheme : preferences.themeMode
  const tokens = useMemo(
    () => createThemeTokens(resolvedMode, preferences.accentColor),
    [preferences.accentColor, resolvedMode],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...preferences,
      resolvedMode,
      tokens,
      isHydrated,
      preferences,
      setThemeMode: (themeMode) => setPreferences((current) => ({ ...current, themeMode })),
      setAccentColor: (color) => {
        const normalized = normalizeHexColor(color)
        if (!normalized) return
        const preset = findAccentPreset(normalized)
        setPreferences((current) => ({
          ...current,
          accentColor: normalized,
          themePreset: preset?.id || 'custom',
        }))
      },
      setThemePreset: (presetId) => {
        const preset = ACCENT_PRESETS.find((item) => item.id === presetId)
        if (!preset) return
        setPreferences((current) => ({
          ...current,
          accentColor: preset.color,
          themePreset: preset.id,
        }))
      },
      resetTheme: () => setPreferences(defaultPreferences),
    }),
    [isHydrated, preferences, resolvedMode, tokens],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
