import { describe, expect, it, jest } from '@jest/globals'
import type { LocalDatabase } from '@superapp/local-db'

const mockOpenDatabase = jest.fn<(...args: unknown[]) => Promise<LocalDatabase>>()
const mockRepositoryConstructor = jest.fn<(...args: unknown[]) => void>()
const mockCreateCrmLock = jest.fn<(...args: unknown[]) => unknown>()
const mockSecureGet = jest.fn<(...args: unknown[]) => Promise<string | null>>()
const mockSecureSet = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockSecureDelete = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockGetRandomBytes = jest.fn((size: number) => new Uint8Array(size).fill(7))
const mockLock = {
  hasPin: async () => false,
  setPin: async () => undefined,
  verifyPin: async () => false,
  clearPin: async () => undefined,
}
const mockDatabase = {} as LocalDatabase

jest.mock('expo-crypto', () => ({ getRandomBytes: (size: number) => mockGetRandomBytes(size) }))

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  getItemAsync: (...args: unknown[]) => mockSecureGet(...args),
  setItemAsync: (...args: unknown[]) => mockSecureSet(...args),
  deleteItemAsync: (...args: unknown[]) => mockSecureDelete(...args),
}))

jest.mock('@superapp/local-db', () => ({
  createExpoDatabaseFactory: () => ({ open: (...args: unknown[]) => mockOpenDatabase(...args) }),
}))

jest.mock('@superapp/crm', () => ({
  createCrmLock: (...args: unknown[]) => mockCreateCrmLock(...args),
  CrmRepository: class {
    constructor(...args: unknown[]) {
      mockRepositoryConstructor(...args)
    }
  },
}))

describe('local CRM runtime', () => {
  it('creates one owner-scoped lock backed by device-only SecureStore', async () => {
    mockCreateCrmLock.mockReturnValue(mockLock)
    const { LOCAL_CRM_OWNER_ID, localCrmLock } =
      jest.requireActual<typeof import('./runtime')>('./runtime')
    expect(localCrmLock).toBe(mockLock)
    expect(LOCAL_CRM_OWNER_ID).toBe('local-personal')
    expect(mockCreateCrmLock).toHaveBeenCalledWith(expect.any(Object), LOCAL_CRM_OWNER_ID, {
      randomBytes: expect.any(Function),
    })

    const [store] = mockCreateCrmLock.mock.calls[0] as [
      {
        getItem(key: string): Promise<string | null>
        setItem(key: string, value: string): Promise<void>
        removeItem(key: string): Promise<void>
      },
    ]
    mockSecureGet.mockResolvedValueOnce('record')
    await expect(store.getItem('crm-key')).resolves.toBe('record')
    await store.setItem('crm-key', 'value')
    await store.removeItem('crm-key')

    const options = {
      keychainService: 'superapp.crm',
      keychainAccessible: 'afterFirstUnlockThisDeviceOnly',
    }
    expect(mockSecureGet).toHaveBeenCalledWith('crm-key', options)
    expect(mockSecureSet).toHaveBeenCalledWith('crm-key', 'value', options)
    expect(mockSecureDelete).toHaveBeenCalledWith('crm-key', options)
  })

  it('opens one local database, retries after failure, and injects random local IDs', async () => {
    const { getLocalCrmRepository } = jest.requireActual<typeof import('./runtime')>('./runtime')
    mockOpenDatabase.mockRejectedValueOnce(new Error('open failed')).mockResolvedValue(mockDatabase)

    await expect(getLocalCrmRepository()).rejects.toThrow('open failed')
    const repository = await getLocalCrmRepository()
    await expect(getLocalCrmRepository()).resolves.toBe(repository)

    expect(mockOpenDatabase).toHaveBeenCalledTimes(2)
    expect(mockOpenDatabase).toHaveBeenCalledWith('superapp.db')
    expect(mockRepositoryConstructor).toHaveBeenCalledTimes(1)
    const [database, options] = mockRepositoryConstructor.mock.calls[0] as [
      LocalDatabase,
      { idFactory(): string },
    ]
    expect(database).toBe(mockDatabase)
    expect(options.idFactory()).toBe(`crm_${'07'.repeat(16)}`)
  })
})
