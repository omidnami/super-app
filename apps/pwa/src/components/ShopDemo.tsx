import { useEffect, useState } from 'react'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import { useServiceSession } from '@superapp/ui'
import { ShopScreen } from '@superapp/ui/web'
import { shopApi } from '../shop/api'

export function AccountShop() {
  const { session } = useServiceSession()
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!session) return null
  const scope = createConversationCacheScope(session.context.operatorId, session.context.projectId)
  return (
    <ShopScreen
      key={scope}
      api={shopApi}
      ownerId={scope}
      accessToken={session.accessToken}
      isOnline={isOnline}
      canRead={session.context.permissions.includes('shop.read')}
    />
  )
}
