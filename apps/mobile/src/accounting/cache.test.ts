import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type {
  AccountingDashboard,
  AccountingDocument,
  AccountingDocumentPage,
} from '@superapp/chat-contracts'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import type { LocalDatabase, PayloadCipher } from '@superapp/local-db'

const mockCipher: PayloadCipher = {
  encrypt: async (plaintext) => plaintext,
  decrypt: async (ciphertext) => ciphertext,
}
const mockCreateAccountingCipher = jest.fn<(scope: string) => PayloadCipher>()
const mockAccountingKeyWasCreated = jest.fn<(scope: string) => Promise<boolean>>()
const mockClearAccountingKey = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockGetDashboard = jest.fn<(...args: unknown[]) => Promise<AccountingDashboard | null>>()
const mockSaveDashboard = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockListDocuments = jest.fn<(...args: unknown[]) => Promise<AccountingDocumentPage>>()
const mockSaveDocuments = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockGetDocument = jest.fn<(...args: unknown[]) => Promise<AccountingDocument | null>>()
const mockGetSyncState =
  jest.fn<(...args: unknown[]) => Promise<{ last_synced_at: string | null } | null>>()
const mockClear = jest.fn<(...args: unknown[]) => Promise<void>>()

let mockTransaction: <T>(task: (database: LocalDatabase) => Promise<T>) => Promise<T> = async (
  task,
) => task(mockDatabase)

const mockDatabase = {
  exec: jest.fn(async () => undefined),
  all: jest.fn(async () => []),
  get: jest.fn(async () => null),
  run: jest.fn(async () => undefined),
  transaction: <T>(task: (database: LocalDatabase) => Promise<T>) => mockTransaction(task),
  close: jest.fn(async () => undefined),
} as unknown as LocalDatabase

let mockOpenDatabase: () => Promise<LocalDatabase> = async () => mockDatabase

jest.mock('@superapp/local-db', () => ({
  createExpoDatabaseFactory: () => ({ open: () => mockOpenDatabase() }),
  AccountingRepository: class {
    constructor() {}

    getDashboard(...args: unknown[]) {
      return mockGetDashboard(...args)
    }

    saveDashboard(...args: unknown[]) {
      return mockSaveDashboard(...args)
    }

    list(...args: unknown[]) {
      return mockListDocuments(...args)
    }

    saveDocuments(...args: unknown[]) {
      return mockSaveDocuments(...args)
    }

    get(...args: unknown[]) {
      return mockGetDocument(...args)
    }

    getSyncState(...args: unknown[]) {
      return mockGetSyncState(...args)
    }

    clear(...args: unknown[]) {
      return mockClear(...args)
    }
  },
}))

jest.mock('./crypto', () => ({
  createAccountingCipher: (scope: string) => mockCreateAccountingCipher(scope),
  accountingKeyWasCreated: (scope: string) => mockAccountingKeyWasCreated(scope),
  clearAccountingKey: (scope: string) => mockClearAccountingKey(scope),
}))

const dashboard: AccountingDashboard = {
  total_receivable: { amount: 1000, currency: 'IRR' },
  total_payable: { amount: 250, currency: 'IRR' },
  current_balance: { amount: 750, currency: 'IRR' },
  documents_count: 1,
  balances: [],
  updated_at: '2026-11-26T10:00:00.000Z',
}
const document: AccountingDocument = {
  id: 'doc_1',
  code: 'DOC-1',
  type: 'invoice',
  status: 'confirmed',
  counterparty_name: 'مشتری',
  total: { amount: 1000, currency: 'IRR' },
  issued_at: '2026-11-26T09:00:00.000Z',
  updated_at: '2026-11-26T10:00:00.000Z',
  deleted_at: null,
  description: 'فاکتور',
}
const emptyPage: AccountingDocumentPage = { items: [], next_cursor: null, has_more: false }

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  mockCreateAccountingCipher.mockReturnValue(mockCipher)
  mockAccountingKeyWasCreated.mockResolvedValue(false)
  mockClearAccountingKey.mockResolvedValue(undefined)
  mockGetDashboard.mockResolvedValue(null)
  mockSaveDashboard.mockResolvedValue(undefined)
  mockListDocuments.mockResolvedValue(emptyPage)
  mockSaveDocuments.mockResolvedValue(undefined)
  mockGetDocument.mockResolvedValue(null)
  mockGetSyncState.mockResolvedValue(null)
  mockClear.mockResolvedValue(undefined)
  mockOpenDatabase = async () => mockDatabase
  mockTransaction = async (task) => task(mockDatabase)
})

describe('mobile accounting cache lifetime', () => {
  it('ignores reads and saves after the scope has been cleared', async () => {
    const { createMobileAccountingCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_1', 'prj_12')
    const cache = createMobileAccountingCache(scope)

    await cache.clear(scope)
    await cache.saveDashboard(scope, dashboard)
    await cache.saveDocuments(scope, [document])

    await expect(cache.getDashboard(scope)).resolves.toBeNull()
    await expect(cache.listDocuments(scope, {})).resolves.toEqual(emptyPage)
    await expect(cache.getDocument(scope, document.id)).resolves.toBeNull()
    await expect(cache.getSyncState(scope, 'accounting:documents')).resolves.toBeNull()
    expect(mockSaveDashboard).not.toHaveBeenCalled()
    expect(mockSaveDocuments).not.toHaveBeenCalled()
    expect(mockGetDashboard).not.toHaveBeenCalled()
    expect(mockListDocuments).not.toHaveBeenCalled()
    expect(mockGetDocument).not.toHaveBeenCalled()
    expect(mockGetSyncState).not.toHaveBeenCalled()
    expect(mockClear).toHaveBeenCalledWith(scope)
    expect(mockClearAccountingKey).toHaveBeenCalledWith(scope)
  })

  it('does not let in-flight saves repopulate a cleared scope', async () => {
    let resolveDatabase!: (database: LocalDatabase) => void
    mockOpenDatabase = () =>
      new Promise<LocalDatabase>((resolve) => {
        resolveDatabase = resolve
      })
    const { createMobileAccountingCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_2', 'prj_12')
    const cache = createMobileAccountingCache(scope)

    const savingDashboard = cache.saveDashboard(scope, dashboard)
    const savingDocuments = cache.saveDocuments(scope, [document])
    const clearing = cache.clear(scope)
    resolveDatabase(mockDatabase)
    await Promise.all([savingDashboard, savingDocuments, clearing])

    expect(mockSaveDashboard).not.toHaveBeenCalled()
    expect(mockSaveDocuments).not.toHaveBeenCalled()
    expect(mockClear).toHaveBeenCalledWith(scope)
    expect(mockClearAccountingKey).toHaveBeenCalledWith(scope)
  })

  it('checks the active flag again inside a save transaction', async () => {
    let resolveTransactionStarted!: () => void
    const transactionStarted = new Promise<void>((resolve) => {
      resolveTransactionStarted = resolve
    })
    let runTransaction!: () => Promise<void>
    mockTransaction = <T>(task: (database: LocalDatabase) => Promise<T>) =>
      new Promise<T>((resolve, reject) => {
        runTransaction = async () => {
          try {
            resolve(await task(mockDatabase))
          } catch (error) {
            reject(error)
          }
        }
        resolveTransactionStarted()
      })
    const { createMobileAccountingCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_5', 'prj_12')
    const cache = createMobileAccountingCache(scope)

    const saving = cache.saveDashboard(scope, dashboard)
    await transactionStarted
    await cache.clear(scope)
    await runTransaction()
    await saving

    expect(mockSaveDashboard).not.toHaveBeenCalled()
    expect(mockClear).toHaveBeenCalledWith(scope)
  })

  it('does not return a read that finishes after the scope was cleared', async () => {
    let resolveDashboard!: (value: AccountingDashboard) => void
    let resolveReadStarted!: () => void
    const readStarted = new Promise<void>((resolve) => {
      resolveReadStarted = resolve
    })
    mockGetDashboard.mockImplementation(() => {
      resolveReadStarted()
      return new Promise<AccountingDashboard>((resolve) => {
        resolveDashboard = resolve
      })
    })
    const { createMobileAccountingCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_6', 'prj_12')
    const cache = createMobileAccountingCache(scope)

    const reading = cache.getDashboard(scope)
    await readStarted
    await cache.clear(scope)
    resolveDashboard(dashboard)

    await expect(reading).resolves.toBeNull()
  })

  it('rejects reads and writes for a different owner scope', async () => {
    const { createMobileAccountingCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_3', 'prj_12')
    const cache = createMobileAccountingCache(scope)
    const otherScope = 'other_scope'

    await expect(cache.getDashboard(otherScope)).rejects.toThrow('Accounting cache scope')
    await expect(cache.listDocuments(otherScope, {})).rejects.toThrow('Accounting cache scope')
    await expect(cache.saveDashboard(otherScope, dashboard)).rejects.toThrow(
      'Accounting cache scope',
    )
    await expect(cache.saveDocuments(otherScope, [document])).rejects.toThrow(
      'Accounting cache scope',
    )
    await expect(cache.getDocument(otherScope, document.id)).rejects.toThrow(
      'Accounting cache scope',
    )
    await expect(cache.getSyncState(otherScope, 'accounting:documents')).rejects.toThrow(
      'Accounting cache scope',
    )
    await expect(cache.clear(otherScope)).rejects.toThrow('Accounting cache scope')

    await cache.saveDocuments(scope, [document])
    expect(mockListDocuments).not.toHaveBeenCalled()
    expect(mockSaveDashboard).not.toHaveBeenCalled()
    expect(mockSaveDocuments).toHaveBeenCalled()
    expect(mockClear).not.toHaveBeenCalled()
    expect(mockClearAccountingKey).not.toHaveBeenCalled()
  })

  it('deletes the key and keeps the cache inactive when database cleanup fails', async () => {
    mockClear.mockRejectedValueOnce(new Error('disk failure'))
    const { clearAccountingCacheForSession, createMobileAccountingCache } =
      jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_4', 'prj_12')
    const session = {
      accessToken: 'account_token',
      refreshToken: 'refresh_token',
      expiresAt: 1,
      service: 'account' as const,
      context: { operatorId: 'op_4', projectId: 'prj_12', permissions: ['accounting.read'] },
    }
    const cache = createMobileAccountingCache(scope)

    await expect(clearAccountingCacheForSession(session)).rejects.toThrow('disk failure')
    await cache.saveDocuments(scope, [document])

    expect(mockClearAccountingKey).toHaveBeenCalledWith(scope)
    expect(mockSaveDocuments).not.toHaveBeenCalled()
    expect(createMobileAccountingCache(scope)).toBe(cache)
  })

  it('purges unreadable legacy rows when a new SecureStore key is created', async () => {
    mockAccountingKeyWasCreated.mockResolvedValue(true)
    const { createMobileAccountingCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_8', 'prj_12')
    const cache = createMobileAccountingCache(scope)

    await expect(cache.getDashboard(scope)).resolves.toBeNull()

    expect(mockClear).toHaveBeenCalledWith(scope)
    expect(mockClear.mock.invocationCallOrder[0]).toBeLessThan(
      mockGetDashboard.mock.invocationCallOrder[0]!,
    )
  })

  it('evicts the cache after successful cleanup', async () => {
    const { createMobileAccountingCache } = jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_7', 'prj_12')
    const cache = createMobileAccountingCache(scope)

    await cache.clear(scope)

    expect(createMobileAccountingCache(scope)).not.toBe(cache)
  })
})
