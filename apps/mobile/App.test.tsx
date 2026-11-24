import { describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import App from './App'

const mockStorage = new Map<string, string>()
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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
    const { getByLabelText, getByText } = await render(<App />)
    await act(async () => {})

    expect(getByText('CRM محلی')).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByLabelText('پیام‌رسان'))
    })
    await waitFor(() => expect(getByLabelText('اتصال به پیام‌رسان')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByLabelText('اتصال به پیام‌رسان'))
    })
    await waitFor(() => expect(getByText('پیام‌رسان متصل است')).toBeTruthy())

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
    await waitFor(() => expect(getByText('پیام‌رسان متصل است')).toBeTruthy())

    await act(async () => {
      fireEvent.press(getByLabelText('سوپرآپ'))
    })
    await waitFor(() => expect(getByText('CRM محلی')).toBeTruthy())
  }, 20000)
})
