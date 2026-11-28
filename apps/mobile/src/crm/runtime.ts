import { getRandomBytes } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { createCrmLock, CrmRepository, type CrmKeyValueStore } from '@superapp/crm'
import { createExpoDatabaseFactory, type LocalDatabase } from '@superapp/local-db'

export const LOCAL_CRM_OWNER_ID = 'local-personal'

const KEYCHAIN_OPTIONS = {
  keychainService: 'superapp.crm',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} satisfies SecureStore.SecureStoreOptions

const secureStore: CrmKeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS),
  removeItem: (key) => SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS),
}

export const localCrmLock = createCrmLock(secureStore, LOCAL_CRM_OWNER_ID, {
  randomBytes: getRandomBytes,
})

let repositoryPromise: Promise<CrmRepository> | null = null

function createLocalId(): string {
  return `crm_${Array.from(getRandomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function getLocalCrmRepository(): Promise<CrmRepository> {
  if (!repositoryPromise) {
    const pending = createExpoDatabaseFactory()
      .open('superapp.db')
      .then((database: LocalDatabase) => new CrmRepository(database, { idFactory: createLocalId }))
    const tracked = pending.catch((error: unknown) => {
      if (repositoryPromise === tracked) repositoryPromise = null
      throw error
    })
    repositoryPromise = tracked
  }
  return repositoryPromise
}
