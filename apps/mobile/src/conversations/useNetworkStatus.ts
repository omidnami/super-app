import { useEffect, useState } from 'react'
import * as Network from 'expo-network'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    let active = true
    const update = (state: Network.NetworkState | Network.NetworkStateEvent) => {
      if (active) setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false))
    }

    void Network.getNetworkStateAsync()
      .then(update)
      .catch(() => {
        if (active) setIsOnline(false)
      })
    const subscription = Network.addNetworkStateListener(update)

    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return isOnline
}
