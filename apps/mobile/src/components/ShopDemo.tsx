import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { createConversationCacheScope } from '@superapp/conversation-inbox'
import { useServiceSession } from '@superapp/ui'
import { AccountingScreen, ShopScreen, Tabs } from '@superapp/ui/native'
import { accountingApi } from '../accounting/api'
import { createMobileAccountingCache } from '../accounting/cache'
import { shopApi } from '../shop/api'
import { createMobileShopCache } from '../shop/cache'
import { useNetworkStatus } from '../conversations/useNetworkStatus'

export function AccountShop() {
  const { session } = useServiceSession()
  const isOnline = useNetworkStatus()
  const [section, setSection] = useState<'shop' | 'accounting'>('shop')
  const scope = session
    ? createConversationCacheScope(session.context.operatorId, session.context.projectId)
    : ''
  const shopCache = useMemo(() => (scope ? createMobileShopCache(scope) : undefined), [scope])
  const accountingCache = useMemo(
    () => (scope ? createMobileAccountingCache(scope) : undefined),
    [scope],
  )

  if (!session) return null
  return (
    <View style={{ flex: 1 }}>
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
          cache={shopCache}
          isOnline={isOnline}
          canRead={session.context.permissions.includes('shop.read')}
        />
      ) : (
        <AccountingScreen
          key={`accounting:${scope}`}
          api={accountingApi}
          ownerId={scope}
          accessToken={session.accessToken}
          cache={accountingCache}
          isOnline={isOnline}
          canRead={session.context.permissions.includes('accounting.read')}
        />
      )}
    </View>
  )
}
