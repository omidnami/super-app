import { useEffect, useState } from 'react'
import { ActivityIndicator, Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { getRandomBytes } from 'expo-crypto'
import { createMockAuthAdapter, type ServiceSession } from '@superapp/auth'
import { type CrmRepository, useCrm } from '@superapp/crm'
import { useTheme } from '@superapp/theme'
import { ServiceAuthBoundary, ServiceSessionProvider } from '@superapp/ui'
import { Card, CrmWorkspace, MiniAppShell, MobileNavigation, Tabs } from '@superapp/ui/native'
import { mobileAuthStorage } from './src/auth/storage'
import { AuthDemo } from './src/components/AuthDemo'
import { clearConversationCacheForSession } from './src/conversations/cache'
import { clearMobileMediaCache } from './src/conversations/media-cache'
import { MessagingHub } from './src/components/HubDemo'
import { AccountShop } from './src/components/ShopDemo'
import { clearAccountingCacheForSession } from './src/accounting/cache'
import { clearShopCacheForSession } from './src/shop/cache'
import { AppThemeProvider } from './src/theme/AppThemeProvider'
import { ThemeGallery } from './src/components/ThemeGallery'
import { UiKitGallery } from './src/components/UiKitGallery'
import { pickCrmBackup, shareCrmBackup } from './src/crm/backup'
import { getLocalCrmRepository, LOCAL_CRM_OWNER_ID, localCrmLock } from './src/crm/runtime'

const authAdapter = createMockAuthAdapter()

async function handleMessagingLogout(session: ServiceSession) {
  try {
    await clearConversationCacheForSession(session)
  } finally {
    await clearMobileMediaCache()
  }
}

async function handleAccountLogout(session: ServiceSession) {
  await Promise.all([clearShopCacheForSession(session), clearAccountingCacheForSession(session)])
}

const moduleMeta = {
  superapp: { title: 'سوپرآپ', subtitle: 'دسترسی سریع و ابزارهای مشترک' },
  messaging: { title: 'پیام‌رسان', subtitle: 'محیط مستقل پیام‌رسان' },
  account: { title: 'مدیریت حساب', subtitle: 'محیط مستقل مدیریت حساب' },
}

function ThemedStatusBar() {
  const { resolvedMode } = useTheme()
  return <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
}

function CrmSession({ repository }: { repository: CrmRepository }) {
  const crm = useCrm({
    repository,
    ownerId: LOCAL_CRM_OWNER_ID,
    lock: localCrmLock,
    randomBytes: getRandomBytes,
  })
  return <CrmWorkspace crm={crm} onShareBackup={shareCrmBackup} onPickBackup={pickCrmBackup} />
}

function CrmLocal() {
  const { tokens } = useTheme()
  const [repository, setRepository] = useState<CrmRepository | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getLocalCrmRepository()
      .then((nextRepository) => {
        if (active) setRepository(nextRepository)
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'باز کردن ذخیره‌سازی CRM ناموفق بود.')
        }
      })
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          CRM محلی
        </Text>
        <Text style={{ ...tokens.typography.body, color: tokens.color.danger, marginTop: 8 }}>
          {error}
        </Text>
      </Card>
    )
  }
  if (!repository) {
    return (
      <Card>
        <CrmLoading
          label="در حال باز کردن CRM محلی..."
          color={tokens.color.primary}
          textColor={tokens.color.textSecondary}
        />
      </Card>
    )
  }
  return <CrmSession repository={repository} />
}

function CrmLoading({
  label,
  color,
  textColor,
}: {
  label: string
  color: string
  textColor: string
}) {
  return (
    <>
      <ActivityIndicator color={color} />
      <Text style={{ marginTop: 8, color: textColor }}>{label}</Text>
    </>
  )
}

function AppContent() {
  const [activeModule, setActiveModule] = useState<keyof typeof moduleMeta>('superapp')
  const [galleryTab, setGalleryTab] = useState('ui')
  const meta = moduleMeta[activeModule]

  return (
    <>
      <MiniAppShell module={activeModule} title={meta.title} subtitle={meta.subtitle}>
        {activeModule === 'superapp' ? (
          <>
            <CrmLocal />
            <ViewGallery tab={galleryTab} onChange={setGalleryTab} />
          </>
        ) : (
          <ServiceSessionProvider
            key={activeModule}
            service={activeModule}
            storage={mobileAuthStorage}
            adapter={authAdapter}
            onLogout={
              activeModule === 'messaging'
                ? handleMessagingLogout
                : activeModule === 'account'
                  ? handleAccountLogout
                  : undefined
            }
          >
            <ServiceAuthBoundary fallback={<AuthDemo />}>
              {activeModule === 'messaging' ? <MessagingHub /> : <AccountShop />}
            </ServiceAuthBoundary>
          </ServiceSessionProvider>
        )}
      </MiniAppShell>
      <MobileNavigation activeModule={activeModule} onModuleChange={setActiveModule} />
    </>
  )
}

function ViewGallery({ tab, onChange }: { tab: string; onChange: (tab: string) => void }) {
  return (
    <>
      <Tabs
        items={[
          { value: 'ui', label: 'UI Kit' },
          { value: 'theme', label: 'Theme' },
        ]}
        value={tab}
        onChange={onChange}
      />
      {tab === 'ui' ? <UiKitGallery /> : <ThemeGallery />}
    </>
  )
}

export default function App() {
  return (
    <AppThemeProvider>
      <ThemedStatusBar />
      <AppContent />
    </AppThemeProvider>
  )
}
