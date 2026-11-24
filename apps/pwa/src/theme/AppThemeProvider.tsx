import type { ReactNode } from 'react'
import { ThemeProvider } from '@superapp/theme'
import { pwaStorage } from './pwaStorage'
import { useSystemColorScheme } from './useSystemColorScheme'

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme()
  return (
    <ThemeProvider systemColorScheme={systemColorScheme} storage={pwaStorage}>
      {children}
    </ThemeProvider>
  )
}
