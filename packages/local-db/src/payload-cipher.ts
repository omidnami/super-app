import { gcm } from '@noble/ciphers/aes'
import { bytesToHex, bytesToUtf8, clean, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils'

export interface PayloadCipher {
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
}

export interface AesGcmPayloadCipherOptions {
  getKey: () => Uint8Array | Promise<Uint8Array>
  randomBytes: (byteCount: number) => Uint8Array
  additionalData?: string
}

const PREFIX = 'v1'
const NONCE_BYTES = 12
const KEY_BYTES = 32
const TAG_BYTES = 16

export class PayloadCipherError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayloadCipherError'
  }
}

export function createAesGcmPayloadCipher({
  getKey,
  randomBytes,
  additionalData = 'superapp.financial-cache.v1',
}: AesGcmPayloadCipherOptions): PayloadCipher {
  const aad = utf8ToBytes(additionalData)

  async function keyBytes() {
    const key = new Uint8Array(await getKey())
    if (key.length !== KEY_BYTES) {
      clean(key)
      throw new PayloadCipherError('Financial cache key must be 32 bytes.')
    }
    return key
  }

  return {
    async encrypt(plaintext) {
      const key = await keyBytes()
      const nonce = new Uint8Array(randomBytes(NONCE_BYTES))
      try {
        const encrypted = gcm(key, nonce, aad).encrypt(utf8ToBytes(plaintext))
        return `${PREFIX}.${bytesToHex(nonce)}.${bytesToHex(encrypted)}`
      } finally {
        clean(key, nonce)
      }
    },
    async decrypt(ciphertext) {
      const [version, nonceHex, encryptedHex, extra] = ciphertext.split('.')
      if (
        version !== PREFIX ||
        !nonceHex ||
        !encryptedHex ||
        extra !== undefined ||
        nonceHex.length !== NONCE_BYTES * 2 ||
        encryptedHex.length < TAG_BYTES * 2 ||
        encryptedHex.length % 2 !== 0
      ) {
        throw new PayloadCipherError('Encrypted financial payload is malformed.')
      }
      const key = await keyBytes()
      const nonce = hexToBytes(nonceHex)
      const encrypted = hexToBytes(encryptedHex)
      try {
        return bytesToUtf8(gcm(key, nonce, aad).decrypt(encrypted))
      } catch {
        throw new PayloadCipherError('Encrypted financial payload failed authentication.')
      } finally {
        clean(key, nonce, encrypted)
      }
    },
  }
}
