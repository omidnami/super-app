import { useEffect, useState } from 'react'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import { useServiceSession } from '@superapp/ui'
import { AccountingScreen, ShopScreen, Tabs } from '@superapp/ui/web'
import { accountingApi } from '../accounting/api'
import { shopApi } from '../shop/api'

export function AccountShop() {
  const { session } = useServiceSession()
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [section, setSection] = useState<'shop' | 'accounting'>('shop')

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
    <>
      <Tabs
        items={[
          { value: 'shop', label: 'فروشگاه' },
          { value: 'accounting', label: 'حسابداری' },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === 'shop' ? (
        <ShopScreen
          key={`shop:${scope}`}
          api={shopApi}
          ownerId={scope}
          accessToken={session.accessToken}
          isOnline={isOnline}
          canRead={session.context.permissions.includes('shop.read')}
        />
      ) : (
        <AccountingScreen
          key={`accounting:${scope}`}
          api={accountingApi}
          ownerId={scope}
          accessToken={session.accessToken}
          isOnline={isOnline}
          canRead={session.context.permissions.includes('accounting.read')}
        />
      )}
    </>
  )
}
