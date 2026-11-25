import { describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native'
import App from './App'

const mockStorage = new Map<string, string>()
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

jest.mock('./src/conversations/cache', () => ({
  createMobileConversationCache: () => undefined,
  clearConversationCacheForSession: async () => undefined,
}))

jest.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
  addNetworkStateListener: () => ({ remove: () => undefined }),
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
    mockStorage.clear()
    const { getByLabelText, getAllByText, getByText, queryByText } = await render(<App />)
    await act(async () => {})

    expect(getByText('CRM محلی')).toBeTruthy()

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
    await waitFor(() => expect(getByText('مدیریت حساب متصل است')).toBeTruthy())

    await act(async () => {
      fireEvent.press(getByLabelText('پیام‌رسان'))
    })
    await waitFor(() => expect(getByText('علی محمدی')).toBeTruthy())

    await act(async () => {
      fireEvent.press(getByLabelText('سوپرآپ'))
    })
    await waitFor(() => expect(getByText('CRM محلی')).toBeTruthy())
  }, 20000)
})
