import * as FileSystem from 'expo-file-system/legacy'

export async function clearMobileMediaCache() {
  const directory = `${FileSystem.cacheDirectory || ''}superapp-media/`
  await FileSystem.deleteAsync(directory, { idempotent: true })
}
