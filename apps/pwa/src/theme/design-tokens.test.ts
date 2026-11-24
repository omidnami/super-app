import { describe, expect, it } from 'vitest'
import {
  ACCENT_PRESETS,
  contrastRatio,
  createThemeTokens,
  normalizeHexColor,
} from '@superapp/design-tokens'

describe('design tokens', () => {
  it('normalizes custom hex colors', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC')
    expect(normalizeHexColor('#123456')).toBe('#123456')
    expect(normalizeHexColor('invalid')).toBeNull()
  })

  it('keeps primary and text contrast at AA level in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const preset of ACCENT_PRESETS) {
        const tokens = createThemeTokens(mode, preset.color)
        expect(contrastRatio(tokens.color.primary, tokens.color.onPrimary)).toBeGreaterThanOrEqual(
          4.5,
        )
        expect(
          contrastRatio(tokens.color.textPrimary, tokens.color.background),
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrastRatio(tokens.color.textSecondary, tokens.color.background),
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps mini-app navigation labels readable', () => {
    for (const mode of ['light', 'dark'] as const) {
      const tokens = createThemeTokens(mode)
      expect(
        contrastRatio(tokens.color.nav.superapp, tokens.color.nav.onSuperapp),
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        contrastRatio(tokens.color.nav.messenger, tokens.color.nav.onMessenger),
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        contrastRatio(tokens.color.nav.account, tokens.color.nav.onAccount),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})
