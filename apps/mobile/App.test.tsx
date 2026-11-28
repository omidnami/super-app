import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native'
import type { CrmContact, CrmContactInput } from '@superapp/crm'
import App from './App'

const mockStorage = new Map<string, string>()
let mockCrmHasPin = false
let mockCrmContacts: CrmContact[] = []
const mockCrmRepository = {
  listContacts: async () => ({ items: mockCrmContacts, next_cursor: null, has_more: false }),
  listTags: async () => [],
  listNotes: async () => [],
  listTasks: async () => [],
  listInteractions: async () => [],
  createContact: async (_ownerId: string, input: CrmContactInput) => {
    const contact: CrmContact = {
      local_id: `contact_${mockCrmContacts.length + 1}`,
      owner_id: 'local-personal',
      display_name: input.display_name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      tag_ids: input.tag_ids ?? [],
      created_at: '2026-11-28T09:00:00.000Z',
      updated_at: '2026-11-28T09:00:00.000Z',
      deleted_at: null,
    }
    mockCrmContacts = [...mockCrmContacts, contact]
    return contact
  },
}

beforeEach(() => {
  mockStorage.clear()
  mockCrmHasPin = false
  mockCrmContacts = []
})
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

jest.mock('./src/conversations/cache', () => ({
  createMobileConversationCache: () => undefined,
  clearConversationCacheForSession: async () => undefined,
}))

jest.mock('./src/shop/cache', () => ({
  createMobileShopCache: () => undefined,
  clearShopCacheForSession: async () => undefined,
}))

jest.mock('./src/accounting/cache', () => ({
  createMobileAccountingCache: () => undefined,
  clearAccountingCacheForSession: async () => undefined,
}))

jest.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
  addNetworkStateListener: () => ({ remove: () => undefined }),
}))

jest.mock('expo-crypto', () => ({
  getRandomBytes: (size: number) => new Uint8Array(size),
}))

jest.mock('./src/crm/runtime', () => ({
  LOCAL_CRM_OWNER_ID: 'local-personal',
  localCrmLock: {
    hasPin: async () => mockCrmHasPin,
    setPin: async () => {
      mockCrmHasPin = true
    },
    verifyPin: async (pin: string) => pin === '1234',
  },
  getLocalCrmRepository: async () => mockCrmRepository,
}))

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => ({ canceled: true }),
}))

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: async () => ({ granted: true }),
  useAudioRecorder: () => ({
    isRecording: false,
    uri: null,
    prepareToRecordAsync: async () => undefined,
    record: () => undefined,
    stop: async () => undefined,
    getStatus: () => ({ durationMillis: 0 }),
  }),
  useAudioRecorderState: () => ({ durationMillis: 0, isRecording: false, hasError: false }),
  useAudioPlayer: () => ({
    play: () => undefined,
    pause: () => undefined,
    seekTo: () => undefined,
  }),
  useAudioPlayerStatus: () => ({ playing: false, currentTime: 0, duration: 0 }),
}))

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string
    constructor(_directory: unknown, name: string) {
      this.uri = `file:///cache/${name}`
    }
    create() {}
    write() {}
  },
  Paths: { cache: { uri: 'file:///cache/' } },
}))

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: async () => ({ exists: false, isDirectory: false }),
  downloadAsync: async () => ({ status: 200, uri: 'file:///cache/file' }),
  makeDirectoryAsync: async () => undefined,
  moveAsync: async () => undefined,
  deleteAsync: async () => undefined,
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: async () => undefined,
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorage.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorage.set(key, value)
      return Promise.resolve()
    },
    removeItem: (key: string) => {
      mockStorage.delete(key)
      return Promise.resolve()
    },
  },
}))

describe('Independent service auth', () => {
  it('keeps messaging, account and local CRM sessions independent', async () => {
    const { getByLabelText, getAllByText, getByText, queryByText } = await render(<App />)
    await act(async () => {})

    expect(getByLabelText('راه‌اندازی قفل CRM')).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByLabelText('پیام‌رسان'))
    })
    await waitFor(() => expect(getByLabelText('اتصال به پیام‌رسان')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByLabelText('اتصال به پیام‌رسان'))
    })
    await waitFor(() => expect(getByText('علی محمدی')).toBeTruthy())

    await act(async () => {
      fireEvent.press(getByLabelText('فیلتر خوانده‌نشده'))
    })
    await waitFor(() => expect(queryByText('مریم احمدی')).toBeNull())
    expect(getByText('علی محمدی')).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByLabelText('فیلتر همه'))
    })
    await act(async () => {
      fireEvent.changeText(getByLabelText('جستجو'), 'موردی وجود ندارد')
    })
    await waitFor(() => expect(getByText('گفتگویی پیدا نشد')).toBeTruthy())

    await act(async () => {
      fireEvent.changeText(getByLabelText('جستجو'), '')
    })
    await waitFor(() => expect(getByText('علی محمدی')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByLabelText('باز کردن گفتگو علی محمدی'))
    })
    await waitFor(() => expect(getByLabelText('تاریخچه پیام‌ها')).toBeTruthy())
    await act(async () => {
      fireEvent.changeText(getByLabelText('متن پیام'), 'پاسخ آزمایشی اپراتور')
    })
    await waitFor(() => expect(getByLabelText('متن پیام').props.value).toBe('پاسخ آزمایشی اپراتور'))
    await act(async () => {
      fireEvent.press(getByLabelText('ارسال'))
    })
    await waitFor(() => expect(getByLabelText('شما: پاسخ آزمایشی اپراتور')).toBeTruthy())
    expect(within(getByLabelText('شما: پاسخ آزمایشی اپراتور')).getByText('ارسال‌شده')).toBeTruthy()
    await act(async () => {
      fireEvent.press(getByLabelText('بازگشت'))
    })
    await waitFor(() => expect(getByText('علی محمدی')).toBeTruthy())

    await act(async () => {
      fireEvent.press(getByLabelText('اتصال Real-Time'))
    })
    await waitFor(() => expect(getAllByText('اتصال Real-Time').length).toBeGreaterThan(0))

    await act(async () => {
      fireEvent.press(getByLabelText('مدیریت حساب'))
    })
    await waitFor(() => expect(getByLabelText('اتصال به مدیریت حساب')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByLabelText('اتصال به مدیریت حساب'))
    })
    await waitFor(() => expect(getAllByText('فروشگاه').length).toBeGreaterThan(0))
    expect(getByText('فروش امروز')).toBeTruthy()
    await act(async () => {
      fireEvent.press(getByLabelText('حسابداری'))
    })
    await waitFor(() => expect(getByText('مبلغ قابل دریافت')).toBeTruthy())
    expect(getByText('مانده فعلی')).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByLabelText('پیام‌رسان'))
    })
    await waitFor(() => expect(getByText('علی محمدی')).toBeTruthy())

    await act(async () => {
      fireEvent.press(getByLabelText('سوپرآپ'))
    })
    await waitFor(() => expect(getByLabelText('راه‌اندازی قفل CRM')).toBeTruthy())
  }, 20000)

  it('creates a local CRM contact without a service session or network request', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = jest.fn<typeof fetch>()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      const { getAllByLabelText, getByLabelText, getByText } = await render(<App />)
      await waitFor(() => expect(getByLabelText('راه‌اندازی قفل CRM')).toBeTruthy())

      await fireEvent.changeText(getByLabelText('رمز PIN'), '1234')
      await fireEvent.changeText(getByLabelText('تکرار رمز PIN'), '1234')
      await fireEvent.press(getByLabelText('ساخت PIN و ورود'))
      await waitFor(() => expect(getByText('CRM شخصی')).toBeTruthy())

      await fireEvent.press(getByLabelText('مخاطب جدید'))
      await fireEvent.changeText(getByLabelText('نام نمایشی مخاطب'), 'سارا احمدی')
      await fireEvent.changeText(getByLabelText('تلفن مخاطب'), '09120000000')
      const editor = getAllByLabelText('مخاطب جدید').find(
        (element) => element.props.accessibilityRole === 'dialog',
      )
      expect(editor).toBeTruthy()
      await fireEvent.press(within(editor!).getByLabelText('ساخت مخاطب'))
      await waitFor(() => expect(getByText('سارا احمدی')).toBeTruthy())
      expect(mockCrmContacts).toHaveLength(1)
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 20000)
})
