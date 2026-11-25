import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type {
  CanonicalMessage,
  Conversation,
  ConversationPage,
  Paginated,
} from '@superapp/chat-contracts'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import type { LocalDatabase } from '@superapp/local-db'

const mockList = jest.fn<(...args: unknown[]) => Promise<ConversationPage>>()
const mockUpsert = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockMarkMissingDeleted = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockMessageList = jest.fn<(...args: unknown[]) => Promise<Paginated<CanonicalMessage>>>()
const mockMessageUpsert = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockRun = jest.fn<(...args: unknown[]) => Promise<void>>()

const mockDatabase = {
  exec: jest.fn(async () => undefined),
  all: jest.fn(async () => []),
  get: jest.fn(async () => null),
  run: mockRun,
  transaction: async <T>(task: (database: LocalDatabase) => Promise<T>) => task(mockDatabase),
  close: jest.fn(async () => undefined),
} as unknown as LocalDatabase

let mockOpenDatabase: () => Promise<LocalDatabase> = async () => mockDatabase

jest.mock('@superapp/local-db', () => ({
  createExpoDatabaseFactory: () => ({ open: () => mockOpenDatabase() }),
  ConversationRepository: class {
    list(...args: unknown[]) {
      return mockList(...args)
    }

    upsert(...args: unknown[]) {
      return mockUpsert(...args)
    }

    markMissingDeleted(...args: unknown[]) {
      return mockMarkMissingDeleted(...args)
    }
  },
  MessageRepository: class {
    list(...args: unknown[]) {
      return mockMessageList(...args)
    }

    upsert(...args: unknown[]) {
      return mockMessageUpsert(...args)
    }
  },
}))

const conversation: Conversation = {
  id: 'conv_1',
  project_id: 'prj_12',
  source: 'bale',
  robot_id: 'robot_1',
  chat_id: 'chat_1',
  customer: { id: 'user_1', display_name: 'مشتری', initials: 'م' },
  support_level: 'level_1',
  status: 'open',
  assignee: null,
  last_message: 'سلام',
  last_message_at: '2026-11-25T10:00:00.000Z',
  unread_count: 1,
  created_at: '2026-11-25T09:00:00.000Z',
  updated_at: '2026-11-25T10:00:00.000Z',
  deleted_at: null,
}

const message: CanonicalMessage = {
  id: 'msg_1',
  conversation_id: 'conv_1',
  client_mutation_id: 'cm_1',
  sender: 'operator',
  sender_id: 'op_1',
  text: 'سلام',
  attachment: null,
  sent_at: '2026-11-25T10:00:00.000Z',
  created_at: '2026-11-25T10:00:00.000Z',
  updated_at: '2026-11-25T10:00:00.000Z',
  deleted_at: null,
  delivery_status: 'sent',
}

function page(items: Conversation[]): ConversationPage {
  return { items, next_cursor: null, has_more: false }
}

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  mockList.mockResolvedValue(page([]))
  mockUpsert.mockResolvedValue(undefined)
  mockMarkMissingDeleted.mockResolvedValue(undefined)
  mockMessageList.mockResolvedValue({ items: [], next_cursor: null, has_more: false })
  mockMessageUpsert.mockResolvedValue(undefined)
  mockRun.mockResolvedValue(undefined)
  mockOpenDatabase = async () => mockDatabase
})

describe('mobile conversation cache lifetime', () => {
  it('ignores saves after the scope has been cleared', async () => {
    const { createMobileConversationCache } =
      jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_1', 'prj_12')
    const cache = createMobileConversationCache(scope)

    await cache.clear?.(scope)
    await cache.save(scope, {}, page([conversation]))
    await cache.saveMessages(scope, 'conv_1', [message])

    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockMessageUpsert).not.toHaveBeenCalled()
  })

  it('does not let an in-flight save repopulate a cleared scope', async () => {
    let resolveDatabase!: (database: LocalDatabase) => void
    mockOpenDatabase = () =>
      new Promise<LocalDatabase>((resolve) => {
        resolveDatabase = resolve
      })
    const { createMobileConversationCache } =
      jest.requireActual<typeof import('./cache')>('./cache')
    const scope = createConversationCacheScope('op_2', 'prj_12')
    const cache = createMobileConversationCache(scope)

    const saving = cache.save(scope, {}, page([conversation]))
    const clearing = cache.clear?.(scope)
    resolveDatabase(mockDatabase)
    await Promise.all([saving, clearing])

    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockRun).toHaveBeenCalledWith('DELETE FROM cached_conversations WHERE owner_id = ?', [
      scope,
    ])
  })
})
