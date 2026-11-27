import { createAesGcmPayloadCipher, type PayloadCipher } from '@superapp/local-db/payload-cipher'
import { CryptoDigestAlgorithm, getRandomBytes, digestStringAsync } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

const KEY_BYTES = 32
const KEY_PREFIX = 'superapp.accounting.'
const KEYCHAIN_SERVICE = 'superapp.accounting'
const KEYCHAIN_OPTIONS = {
  keychainService: KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} satisfies SecureStore.SecureStoreOptions

interface LoadedAccountingKey {
  key: Uint8Array
  created: boolean
}

const keyPromises = new Map<string, Promise<LoadedAccountingKey>>()
const keyClears = new Map<string, Promise<void>>()

async function getKeyName(scope: string) {
  const digest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, scope)
  return `${KEY_PREFIX}${digest}`
}

function encodeKey(key: Uint8Array) {
  return Array.from(key, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function decodeKey(value: string) {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('Stored accounting key is invalid.')
  }

  const key = new Uint8Array(KEY_BYTES)
  for (let index = 0; index < KEY_BYTES; index += 1) {
    key[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return key
}

function loadAccountingKey(scope: string): Promise<LoadedAccountingKey> {
  const clearing = keyClears.get(scope)
  if (clearing) return clearing.then(() => loadAccountingKey(scope))

  const existing = keyPromises.get(scope)
  if (existing) return existing

  const pending = (async () => {
    const keyName = await getKeyName(scope)
    const stored = await SecureStore.getItemAsync(keyName, KEYCHAIN_OPTIONS)
    if (stored !== null) return { key: decodeKey(stored), created: false }

    const key = getRandomBytes(KEY_BYTES)
    try {
      await SecureStore.setItemAsync(keyName, encodeKey(key), KEYCHAIN_OPTIONS)
    } catch (error) {
      key.fill(0)
      throw error
    }
    return { key, created: true }
  })()

  keyPromises.set(scope, pending)
  void pending.catch(() => {
    if (keyPromises.get(scope) === pending) keyPromises.delete(scope)
  })
  return pending
}

export function createAccountingCipher(scope: string): PayloadCipher {
  return createAesGcmPayloadCipher({
    getKey: async () => (await loadAccountingKey(scope)).key,
    randomBytes: (byteCount) => getRandomBytes(byteCount),
    additionalData: `superapp.accounting.payload.v1:${scope}`,
  })
}

export async function accountingKeyWasCreated(scope: string) {
  return (await loadAccountingKey(scope)).created
}

export async function clearAccountingKey(scope: string) {
  const existing = keyClears.get(scope)
  if (existing) return existing

  const pending = keyPromises.get(scope)
  keyPromises.delete(scope)

  const clearing = (async () => {
    const keyName = await getKeyName(scope)
    try {
      await pending?.catch(() => undefined)
    } finally {
      await SecureStore.deleteItemAsync(keyName, KEYCHAIN_OPTIONS)
    }
  })()
  keyClears.set(scope, clearing)

  try {
    await clearing
  } finally {
    if (keyClears.get(scope) === clearing) keyClears.delete(scope)
  }
}
