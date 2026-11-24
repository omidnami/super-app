import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ACCENT_PRESETS } from '@superapp/design-tokens'
import type { StorageAdapter } from '@superapp/storage'
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from '@superapp/theme'

const bluePreset = ACCENT_PRESETS.find((preset) => preset.id === 'blue')!

function createMemoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const values = new Map(Object.entries(initial))
  return {
    async getItem(key) {
      return values.get(key) ?? null
    },
    async setItem(key, value) {
      values.set(key, value)
    },
    async removeItem(key) {
      values.delete(key)
    },
  }
}

function Probe() {
  const { accentColor, resolvedMode, setAccentColor, setThemeMode, setThemePreset, themeMode } =
    useTheme()

  return (
    <div>
      <span data-testid="mode">{resolvedMode}</span>
      <span data-testid="theme-mode">{themeMode}</span>
      <span data-testid="accent">{accentColor}</span>
      <button type="button" onClick={() => setThemeMode('dark')}>
        dark
      </button>
      <button type="button" onClick={() => setThemeMode('system')}>
        system
      </button>
      <button type="button" onClick={() => setThemePreset(bluePreset.id)}>
        blue
      </button>
      <button type="button" onClick={() => setAccentColor('#E11D48')}>
        rose
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  it('follows system changes until a manual mode is selected', async () => {
    const storage = createMemoryStorage()
    const { rerender } = render(
      <ThemeProvider systemColorScheme="light" storage={storage}>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('mode')).toHaveTextContent('light')
    rerender(
      <ThemeProvider systemColorScheme="dark" storage={storage}>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')

    fireEvent.click(screen.getByRole('button', { name: 'dark' }))
    rerender(
      <ThemeProvider systemColorScheme="light" storage={storage}>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('mode')).toHaveTextContent('dark')
  })

  it('persists theme mode and accent color across remounts', async () => {
    const storage = createMemoryStorage()
    const first = render(
      <ThemeProvider systemColorScheme="light" storage={storage}>
        <Probe />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'dark' }))
    fireEvent.click(screen.getByRole('button', { name: 'blue' }))
    await waitFor(async () => {
      const stored = await storage.getItem(THEME_STORAGE_KEY)
      expect(stored).toContain('"themeMode":"dark"')
      expect(stored).toContain(bluePreset.color)
    })
    first.unmount()

    render(
      <ThemeProvider systemColorScheme="light" storage={storage}>
        <Probe />
      </ThemeProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'))
    expect(screen.getByTestId('accent')).toHaveTextContent(bluePreset.color)
  })

  it('ignores invalid stored colors', async () => {
    const storage = createMemoryStorage({
      [THEME_STORAGE_KEY]: JSON.stringify({
        themeMode: 'dark',
        accentColor: 'not-a-color',
        themePreset: 'custom',
      }),
    })

    render(
      <ThemeProvider systemColorScheme="light" storage={storage}>
        <Probe />
      </ThemeProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('mode')).toHaveTextContent('dark'))
    expect(screen.getByTestId('accent')).toHaveTextContent('#F97316')
  })
})
