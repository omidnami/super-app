import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

const MAX_BACKUP_BYTES = 10 * 1024 * 1024

export async function shareCrmBackup(payload: string): Promise<void> {
  const directory = FileSystem.cacheDirectory
  if (!directory) throw new Error('محل ذخیرهٔ فایل Backup در دسترس نیست.')
  if (!payload || payload.length > MAX_BACKUP_BYTES) {
    throw new Error('حجم Backup معتبر نیست.')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const uri = `${directory}superapp-crm-backup-${timestamp}.json`
  try {
    await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 })
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('اشتراک‌گذاری فایل در این دستگاه در دسترس نیست.')
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Backup رمزنگاری‌شدهٔ CRM',
      UTI: 'public.json',
    })
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)
  }
}

export async function pickCrmBackup(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  })
  if (result.canceled) return null
  const asset = result.assets[0]
  if (!asset?.uri) throw new Error('فایل Backup انتخاب نشد.')
  if (asset.size !== null && asset.size !== undefined && asset.size > MAX_BACKUP_BYTES) {
    throw new Error('حجم فایل Backup بیش از حد مجاز است.')
  }

  const payload = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  })
  if (!payload || payload.length > MAX_BACKUP_BYTES) {
    throw new Error('محتوای فایل Backup معتبر نیست.')
  }
  return payload
}
