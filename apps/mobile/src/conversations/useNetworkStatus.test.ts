import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { NetworkStateEvent } from 'expo-network'
import { useNetworkStatus } from './useNetworkStatus'

let mockConnected = false
let mockListener: ((event: NetworkStateEvent) => void) | null = null
const mockRemove = jest.fn()

jest.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({
    isConnected: mockConnected,
    isInternetReachable: mockConnected,
  }),
  addNetworkStateListener: (listener: (event: NetworkStateEvent) => void) => {
    mockListener = listener
    return { remove: mockRemove }
  },
}))

beforeEach(() => {
  mockConnected = false
  mockListener = null
  mockRemove.mockClear()
})

describe('useNetworkStatus', () => {
  it('tracks internet reachability and removes the native subscription', async () => {
    const { result, unmount } = await renderHook(() => useNetworkStatus())
    await waitFor(() => expect(result.current).toBe(false))

    mockConnected = true
    await act(async () => {
      mockListener?.({
        isConnected: true,
        isInternetReachable: true,
      })
    })
    await waitFor(() => expect(result.current).toBe(true))

    await unmount()
    expect(mockRemove).toHaveBeenCalledTimes(1)
  })
})
