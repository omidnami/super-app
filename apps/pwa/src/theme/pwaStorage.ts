import type { StorageAdapter } from '@superapp/storage'

export const pwaStorage: StorageAdapter = {
  async getItem(key) {
    return window.localStorage.getItem(key)
  },
  async setItem(key, value) {
    window.localStorage.setItem(key, value)
  },
  async removeItem(key) {
    window.localStorage.removeItem(key)
  },
}
