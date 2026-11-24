import type { ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useColorScheme } from 'react-native'
import { ThemeProvider } from '@superapp/theme'
import type { StorageAdapter } from '@superapp/storage'

const storage: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme()
  return (
    <ThemeProvider systemColorScheme={colorScheme === 'dark' ? 'dark' : 'light'} storage={storage}>
      {children}
    </ThemeProvider>
  )
}
