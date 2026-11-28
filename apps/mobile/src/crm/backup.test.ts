import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { pickCrmBackup, shareCrmBackup } from './backup'

const mockWriteAsStringAsync = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockReadAsStringAsync = jest.fn<(...args: unknown[]) => Promise<string>>()
const mockDeleteAsync = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockIsAvailableAsync = jest.fn<(...args: unknown[]) => Promise<boolean>>()
const mockShareAsync = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockGetDocumentAsync = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}))

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}))

describe('local CRM backup files', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWriteAsStringAsync.mockResolvedValue(undefined)
    mockReadAsStringAsync.mockResolvedValue('{"format":"encrypted"}')
    mockDeleteAsync.mockResolvedValue(undefined)
    mockIsAvailableAsync.mockResolvedValue(true)
    mockShareAsync.mockResolvedValue(undefined)
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/backup.json', name: 'backup.json', size: 1024 }],
    })
  })

  it('shares an encrypted payload and removes the temporary cache file', async () => {
    const payload = '{"format":"superapp.crm.backup.encrypted"}'
    await shareCrmBackup(payload)

    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/superapp-crm-backup-.*\.json$/),
      payload,
      { encoding: 'utf8' },
    )
    expect(mockShareAsync).toHaveBeenCalledWith(expect.stringMatching(/\.json$/), {
      mimeType: 'application/json',
      dialogTitle: 'Backup رمزنگاری‌شدهٔ CRM',
      UTI: 'public.json',
    })
    expect(mockDeleteAsync).toHaveBeenCalledWith(expect.stringMatching(/\.json$/), {
      idempotent: true,
    })
  })

  it('cleans up the cache file when sharing is unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValue(false)
    await expect(shareCrmBackup('encrypted')).rejects.toThrow('در دسترس نیست')
    expect(mockDeleteAsync).toHaveBeenCalledTimes(1)
  })

  it('rejects empty or oversized export payloads before writing a file', async () => {
    await expect(shareCrmBackup('')).rejects.toThrow('حجم Backup')
    await expect(shareCrmBackup('x'.repeat(10 * 1024 * 1024 + 1))).rejects.toThrow('حجم Backup')
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled()
  })

  it('returns null when the user cancels import', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] })
    await expect(pickCrmBackup()).resolves.toBeNull()
    expect(mockReadAsStringAsync).not.toHaveBeenCalled()
  })

  it('reads a selected backup as text', async () => {
    await expect(pickCrmBackup()).resolves.toBe('{"format":"encrypted"}')
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///cache/backup.json', {
      encoding: 'utf8',
    })
  })

  it('rejects oversized, missing, and empty backup files', async () => {
    mockGetDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///cache/large.json', size: 10 * 1024 * 1024 + 1 }],
    })
    await expect(pickCrmBackup()).rejects.toThrow('بیش از حد مجاز')

    mockGetDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [] })
    await expect(pickCrmBackup()).rejects.toThrow('انتخاب نشد')

    mockReadAsStringAsync.mockResolvedValueOnce('')
    await expect(pickCrmBackup()).rejects.toThrow('محتوای فایل')
  })
})
