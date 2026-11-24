import { useState } from 'react'
import { Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { createMockAuthAdapter } from '@superapp/auth'
import { useTheme } from '@superapp/theme'
import { ServiceAuthBoundary, ServiceSessionProvider } from '@superapp/ui'
import { Card, MiniAppShell, MobileNavigation, Tabs } from '@superapp/ui/native'
import { mobileAuthStorage } from './src/auth/storage'
import { AuthDemo } from './src/components/AuthDemo'
import { AppThemeProvider } from './src/theme/AppThemeProvider'
import { ThemeGallery } from './src/components/ThemeGallery'
import { UiKitGallery } from './src/components/UiKitGallery'

const authAdapter = createMockAuthAdapter()

const moduleMeta = {
  superapp: { title: 'سوپرآپ', subtitle: 'دسترسی سریع و ابزارهای مشترک' },
  messaging: { title: 'پیام‌رسان', subtitle: 'محیط مستقل پیام‌رسان' },
  account: { title: 'مدیریت حساب', subtitle: 'محیط مستقل مدیریت حساب' },
}

function ThemedStatusBar() {
  const { resolvedMode } = useTheme()
  return <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
}

function CrmLocalPreview() {
  const { tokens } = useTheme()
  return (
    <Card>
      <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>CRM محلی</Text>
      <Text
        style={{
          ...tokens.typography.body,
          color: tokens.color.textSecondary,
          marginTop: tokens.spacing.xs,
        }}
      >
        بدون اتصال به اینترنت و بدون Auth هیچ سرویس قابل‌استفاده است. قفل محلی در فاز بعدی اضافه
        می‌شود.
      </Text>
    </Card>
  )
}

function ConnectedServiceCard({ title }: { title: string }) {
  const { tokens } = useTheme()
  return (
    <Card>
      <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
        {title} متصل است
      </Text>
      <Text
        style={{
          ...tokens.typography.body,
          color: tokens.color.textSecondary,
          marginTop: tokens.spacing.xs,
        }}
      >
        Session این سرویس مستقل از سرویس‌های دیگر است.
      </Text>
    </Card>
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
            <CrmLocalPreview />
            <ViewGallery tab={galleryTab} onChange={setGalleryTab} />
          </>
        ) : (
          <ServiceSessionProvider
            key={activeModule}
            service={activeModule}
            storage={mobileAuthStorage}
            adapter={authAdapter}
          >
            <ServiceAuthBoundary fallback={<AuthDemo />}>
              <ConnectedServiceCard title={meta.title} />
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
