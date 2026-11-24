import {
  contrastRatio,
  ensureContrast,
  mixColors,
  normalizeHexColor,
  readableOnColor,
} from './colors'
import { DEFAULT_ACCENT_COLOR } from './presets'

export type ResolvedThemeMode = 'light' | 'dark'

export interface ColorTokens {
  background: string
  surface: string
  surfaceElevated: string
  surfaceMuted: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  border: string
  borderStrong: string
  primary: string
  primaryHover: string
  primaryPressed: string
  onPrimary: string
  success: string
  warning: string
  danger: string
  info: string
  overlay: string
  skeleton: string
  nav: {
    superapp: string
    messenger: string
    account: string
    onSuperapp: string
    onMessenger: string
    onAccount: string
  }
}

export interface TypographyTokens {
  fontFamily: 'System'
  display: { fontSize: number; lineHeight: number; fontWeight: '800' }
  title: { fontSize: number; lineHeight: number; fontWeight: '700' }
  body: { fontSize: number; lineHeight: number; fontWeight: '400' }
  caption: { fontSize: number; lineHeight: number; fontWeight: '400' }
}

export interface SpacingTokens {
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  xxl: number
}

export interface RadiusTokens {
  sm: number
  md: number
  lg: number
  xl: number
  full: number
}

export interface ElevationTokens {
  none: number
  sm: number
  md: number
  lg: number
}

export interface ThemeTokens {
  mode: ResolvedThemeMode
  color: ColorTokens
  typography: TypographyTokens
  spacing: SpacingTokens
  radius: RadiusTokens
  elevation: ElevationTokens
}

const typography: TypographyTokens = {
  fontFamily: 'System',
  display: { fontSize: 28, lineHeight: 40, fontWeight: '800' },
  title: { fontSize: 18, lineHeight: 28, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 24, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 20, fontWeight: '400' },
}

const spacing: SpacingTokens = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
const radius: RadiusTokens = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 }
const elevation: ElevationTokens = { none: 0, sm: 1, md: 3, lg: 8 }

const semanticColors: Record<
  ResolvedThemeMode,
  Omit<ColorTokens, 'primary' | 'primaryHover' | 'primaryPressed' | 'onPrimary'>
> = {
  light: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#EEF1F5',
    textPrimary: '#172033',
    textSecondary: '#526079',
    textTertiary: '#8490A3',
    border: '#DDE3EA',
    borderStrong: '#B9C3D0',
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
    info: '#0369A1',
    overlay: 'rgba(15, 23, 42, 0.45)',
    skeleton: '#E5E7EB',
    nav: {
      superapp: '#F97316',
      messenger: '#0EA5E9',
      account: '#8B5CF6',
      onSuperapp: '#FFFFFF',
      onMessenger: '#FFFFFF',
      onAccount: '#FFFFFF',
    },
  },
  dark: {
    background: '#0B1120',
    surface: '#111827',
    surfaceElevated: '#1F2937',
    surfaceMuted: '#172033',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    border: '#293548',
    borderStrong: '#46566C',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#38BDF8',
    overlay: 'rgba(0, 0, 0, 0.60)',
    skeleton: '#1E293B',
    nav: {
      superapp: '#FB923C',
      messenger: '#38BDF8',
      account: '#A78BFA',
      onSuperapp: '#111827',
      onMessenger: '#111827',
      onAccount: '#111827',
    },
  },
}

function createReadableNavigationColor(color: string) {
  const onColor = readableOnColor(color)
  const adjusted =
    contrastRatio(color, onColor) >= 4.5
      ? color
      : ensureContrast(color, onColor, 4.5, onColor === '#FFFFFF' ? 'darken' : 'lighten')
  return { color: adjusted, onColor }
}

export function createThemeTokens(
  mode: ResolvedThemeMode,
  accentColor = DEFAULT_ACCENT_COLOR,
): ThemeTokens {
  const normalizedAccent = normalizeHexColor(accentColor) || DEFAULT_ACCENT_COLOR
  const primary =
    mode === 'light'
      ? ensureContrast(normalizedAccent, '#FFFFFF', 4.5, 'darken')
      : ensureContrast(normalizedAccent, '#0B1120', 4.5, 'lighten')
  const hoverTarget = mode === 'light' ? '#000000' : '#FFFFFF'
  const semantic = semanticColors[mode]
  const superappNav = createReadableNavigationColor(semantic.nav.superapp)
  const messengerNav = createReadableNavigationColor(semantic.nav.messenger)
  const accountNav = createReadableNavigationColor(semantic.nav.account)

  return {
    mode,
    color: {
      ...semantic,
      nav: {
        superapp: superappNav.color,
        messenger: messengerNav.color,
        account: accountNav.color,
        onSuperapp: superappNav.onColor,
        onMessenger: messengerNav.onColor,
        onAccount: accountNav.onColor,
      },
      primary,
      primaryHover: mixColors(primary, hoverTarget, 0.12),
      primaryPressed: mixColors(primary, hoverTarget, 0.22),
      onPrimary:
        mode === 'light'
          ? '#FFFFFF'
          : contrastRatio(primary, '#FFFFFF') >= contrastRatio(primary, '#0B1120')
            ? '#FFFFFF'
            : '#0B1120',
    },
    typography,
    spacing,
    radius,
    elevation,
  }
}
