import { useMemo } from 'react'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import { useServiceSession } from '@superapp/ui'
import { ShopScreen } from '@superapp/ui/native'
import { shopApi } from '../shop/api'
import { createMobileShopCache } from '../shop/cache'
import { useNetworkStatus } from '../conversations/useNetworkStatus'

export function AccountShop() {
  const { session } = useServiceSession()
  const isOnline = useNetworkStatus()
  const scope = session
    ? createConversationCacheScope(session.context.operatorId, session.context.projectId)
    : ''
  const cache = useMemo(() => (scope ? createMobileShopCache(scope) : undefined), [scope])

  if (!session) return null
  return (
    <ShopScreen
      key={scope}
      api={shopApi}
      ownerId={scope}
      accessToken={session.accessToken}
      cache={cache}
      isOnline={isOnline}
      canRead={session.context.permissions.includes('shop.read')}
    />
  )
}
