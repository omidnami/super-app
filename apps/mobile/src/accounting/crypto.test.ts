import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const scopeA = 'op_1/prj_12?service=accounting'
const scopeB = 'op_2/prj_12?service=accounting'
const digestA = 'a'.repeat(64)
const digestB = 'b'.repeat(64)
const keychainOptions = {
  keychainService: 'superapp.accounting',
  keychainAccessible: 19,
}
const storedKeys = new Map<string, string>()
let randomCall = 0

const mockDigestStringAsync =
  jest.fn<(algorithm: string, data: string, options?: unknown) => Promise<string>>()
const mockGetRandomBytes = jest.fn<(byteCount: number) => Uint8Array>()
const mockGetItemAsync = jest.fn<(key: string, options?: unknown) => Promise<string | null>>()
const mockSetItemAsync = jest.fn<(key: string, value: string, options?: unknown) => Promise<void>>()
const mockDeleteItemAsync = jest.fn<(key: string, options?: unknown) => Promise<void>>()

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: (...args: Parameters<typeof mockDigestStringAsync>) =>
    mockDigestStringAsync(...args),
  getRandomBytes: (byteCount: number) => mockGetRandomBytes(byteCount),
}))

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: keychainOptions.keychainAccessible,
  getItemAsync: (key: string, options?: unknown) => mockGetItemAsync(key, options),
  setItemAsync: (key: string, value: string, options?: unknown) =>
    mockSetItemAsync(key, value, options),
  deleteItemAsync: (key: string, options?: unknown) => mockDeleteItemAsync(key, options),
}))

function loadCrypto() {
  return jest.requireActual<typeof import('./crypto')>('./crypto')
}

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  storedKeys.clear()
  randomCall = 0
  mockDigestStringAsync.mockImplementation(async (_algorithm, scope) =>
    scope === scopeA ? digestA : digestB,
  )
  mockGetRandomBytes.mockImplementation((byteCount) => {
    randomCall += 1
    return new Uint8Array(byteCount).fill(randomCall)
  })
  mockGetItemAsync.mockImplementation(async (key) => storedKeys.get(key) ?? null)
  mockSetItemAsync.mockImplementation(async (key, value) => {
    storedKeys.set(key, value)
  })
  mockDeleteItemAsync.mockImplementation(async (key) => {
    storedKeys.delete(key)
  })
})

describe('mobile accounting cipher', () => {
  it('persists a hashed, device-only key and reuses it after a module restart', async () => {
    const { createAccountingCipher } = loadCrypto()
    const plaintext = JSON.stringify({ total: 1234 })
    const ciphertext = await createAccountingCipher(scopeA).encrypt(plaintext)
    const keyName = `superapp.accounting.${digestA}`

    expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA-256', scopeA)
    expect(keyName).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(mockSetItemAsync).toHaveBeenCalledTimes(1)
    expect(mockSetItemAsync).toHaveBeenCalledWith(keyName, '01'.repeat(32), keychainOptions)
    expect(mockGetRandomBytes).toHaveBeenCalledWith(32)

    jest.resetModules()
    const restarted = loadCrypto()

    await expect(restarted.createAccountingCipher(scopeA).decrypt(ciphertext)).resolves.toBe(
      plaintext,
    )
    expect(mockSetItemAsync).toHaveBeenCalledTimes(1)
    expect(mockGetRandomBytes.mock.calls.filter(([count]) => count === 32)).toHaveLength(1)
  })

  it('reports whether the current Session created its key', async () => {
    const { accountingKeyWasCreated } = loadCrypto()

    await expect(accountingKeyWasCreated(scopeA)).resolves.toBe(true)
    await expect(accountingKeyWasCreated(scopeA)).resolves.toBe(true)

    jest.resetModules()
    const restarted = loadCrypto()
    await expect(restarted.accountingKeyWasCreated(scopeA)).resolves.toBe(false)
  })

  it('shares one in-flight key promise between ciphers for the same scope', async () => {
    let resolveRead!: (value: string | null) => void
    let resolveReadStarted!: () => void
    const readStarted = new Promise<void>((resolve) => {
      resolveReadStarted = resolve
    })
    mockGetItemAsync.mockImplementationOnce(() => {
      resolveReadStarted()
      return new Promise<string | null>((resolve) => {
        resolveRead = resolve
      })
    })
    const { createAccountingCipher } = loadCrypto()

    const firstEncryption = createAccountingCipher(scopeA).encrypt('first')
    await readStarted
    const secondEncryption = createAccountingCipher(scopeA).encrypt('second')
    await Promise.resolve()
    resolveRead(null)
    await Promise.all([firstEncryption, secondEncryption])

    expect(mockGetItemAsync).toHaveBeenCalledTimes(1)
    expect(mockSetItemAsync).toHaveBeenCalledTimes(1)
    expect(mockGetRandomBytes.mock.calls.filter(([count]) => count === 32)).toHaveLength(1)
  })

  it('generates separate keys for separate owner scopes', async () => {
    const { createAccountingCipher } = loadCrypto()
    const cipherA = createAccountingCipher(scopeA)
    const cipherB = createAccountingCipher(scopeB)

    const ciphertextA = await cipherA.encrypt('owner A')
    const ciphertextB = await cipherB.encrypt('owner B')

    expect(mockSetItemAsync).toHaveBeenCalledTimes(2)
    const [keyNameA, keyA] = mockSetItemAsync.mock.calls[0]
    const [keyNameB, keyB] = mockSetItemAsync.mock.calls[1]
    expect(keyNameA).toBe(`superapp.accounting.${digestA}`)
    expect(keyNameB).toBe(`superapp.accounting.${digestB}`)
    expect(keyA).not.toBe(keyB)
    await expect(cipherB.decrypt(ciphertextA)).rejects.toThrow('failed authentication')
    await expect(cipherA.decrypt(ciphertextB)).rejects.toThrow('failed authentication')
  })

  it('includes the owner scope in the authenticated additional data', async () => {
    const sharedKey = 'ab'.repeat(32)
    storedKeys.set(`superapp.accounting.${digestA}`, sharedKey)
    storedKeys.set(`superapp.accounting.${digestB}`, sharedKey)
    const { createAccountingCipher } = loadCrypto()
    const cipherA = createAccountingCipher(scopeA)
    const cipherB = createAccountingCipher(scopeB)

    const ciphertext = await cipherA.encrypt('scoped payload')

    await expect(cipherA.decrypt(ciphertext)).resolves.toBe('scoped payload')
    await expect(cipherB.decrypt(ciphertext)).rejects.toThrow('failed authentication')
    expect(mockSetItemAsync).not.toHaveBeenCalled()
    expect(mockGetRandomBytes.mock.calls.filter(([count]) => count === 32)).toHaveLength(0)
  })

  it('round-trips AES-GCM payloads and rejects tampering', async () => {
    const { createAccountingCipher } = loadCrypto()
    const cipher = createAccountingCipher(scopeA)
    const plaintext = 'sensitive accounting data'

    const ciphertext = await cipher.encrypt(plaintext)
    const lastCharacter = ciphertext.at(-1)
    const tampered = `${ciphertext.slice(0, -1)}${lastCharacter === '0' ? '1' : '0'}`

    expect(ciphertext).not.toContain(plaintext)
    await expect(cipher.decrypt(ciphertext)).resolves.toBe(plaintext)
    await expect(cipher.decrypt(tampered)).rejects.toThrow('failed authentication')
  })

  it('deletes the SecureStore key and forgets the in-memory promise', async () => {
    const { clearAccountingKey, createAccountingCipher } = loadCrypto()
    await createAccountingCipher(scopeA).encrypt('before clear')

    await clearAccountingKey(scopeA)

    expect(mockDeleteItemAsync).toHaveBeenCalledWith(
      `superapp.accounting.${digestA}`,
      keychainOptions,
    )
    expect(storedKeys.size).toBe(0)

    await createAccountingCipher(scopeA).encrypt('after clear')
    expect(mockSetItemAsync).toHaveBeenCalledTimes(2)
    expect(mockGetRandomBytes.mock.calls.filter(([count]) => count === 32)).toHaveLength(2)
  })

  it('waits for pending key creation before deleting the SecureStore key', async () => {
    let resolveRead!: (value: string | null) => void
    let resolveReadStarted!: () => void
    const readStarted = new Promise<void>((resolve) => {
      resolveReadStarted = resolve
    })
    mockGetItemAsync.mockImplementationOnce(() => {
      resolveReadStarted()
      return new Promise<string | null>((resolve) => {
        resolveRead = resolve
      })
    })
    const { clearAccountingKey, createAccountingCipher } = loadCrypto()

    const encrypting = createAccountingCipher(scopeA).encrypt('in flight')
    await readStarted
    const clearing = clearAccountingKey(scopeA)
    resolveRead(null)
    await Promise.all([encrypting, clearing])

    expect(mockSetItemAsync).toHaveBeenCalledTimes(1)
    expect(mockDeleteItemAsync).toHaveBeenCalledTimes(1)
    expect(mockSetItemAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteItemAsync.mock.invocationCallOrder[0],
    )
    expect(storedKeys.size).toBe(0)
  })

  it('rejects malformed stored keys without replacing them', async () => {
    storedKeys.set(`superapp.accounting.${digestA}`, 'not-a-valid-key')
    const { createAccountingCipher } = loadCrypto()

    await expect(createAccountingCipher(scopeA).encrypt('payload')).rejects.toThrow(
      'Stored accounting key is invalid.',
    )
    expect(mockSetItemAsync).not.toHaveBeenCalled()
    expect(mockGetRandomBytes).not.toHaveBeenCalled()
  })
})
