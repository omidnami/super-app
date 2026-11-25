import { useState } from 'react'
import { createMockAuthAdapter } from '@superapp/auth'
import { ServiceAuthBoundary, ServiceSessionProvider } from '@superapp/ui'
import { AppShell, Card, Tabs } from '@superapp/ui/web'
import { pwaAuthStorage } from './auth/storage'
import { AuthDemo } from './components/AuthDemo'
import { MessagingHub } from './components/HubDemo'
import { AppThemeProvider } from './theme/AppThemeProvider'
import { ThemeGallery } from './components/ThemeGallery'
import { UiKitGallery } from './components/UiKitGallery'

const authAdapter = createMockAuthAdapter()

const moduleMeta = {
  superapp: { title: 'سوپرآپ', subtitle: 'دسترسی سریع و ابزارهای مشترک' },
  messaging: { title: 'پیام‌رسان', subtitle: 'محیط مستقل پیام‌رسان' },
  account: { title: 'مدیریت حساب', subtitle: 'محیط مستقل مدیریت حساب' },
}

function CrmLocalPreview() {
  return (
    <Card>
      <h2>CRM محلی</h2>
      <p>
        بدون اتصال به اینترنت و بدون Auth هیچ سرویس قابل‌استفاده است. قفل محلی در فاز بعدی اضافه
        می‌شود.
      </p>
    </Card>
  )
}

function ConnectedServiceCard({ title }: { title: string }) {
  return (
    <Card>
      <h2>{title} متصل است</h2>
      <p>Session این سرویس مستقل از سرویس‌های دیگر است.</p>
    </Card>
  )
}

export default function App() {
  const [activeModule, setActiveModule] = useState<keyof typeof moduleMeta>('superapp')
  const [galleryTab, setGalleryTab] = useState('ui')
  const meta = moduleMeta[activeModule]

  return (
    <AppThemeProvider>
      <AppShell
        module={activeModule}
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        title={meta.title}
        subtitle={meta.subtitle}
      >
        {activeModule === 'superapp' ? (
          <>
            <CrmLocalPreview />
            <Tabs
              items={[
                { value: 'ui', label: 'UI Kit' },
                { value: 'theme', label: 'Theme' },
              ]}
              value={galleryTab}
              onChange={setGalleryTab}
            />
            {galleryTab === 'ui' ? <UiKitGallery /> : <ThemeGallery />}
          </>
        ) : (
          <ServiceSessionProvider
            key={activeModule}
            service={activeModule}
            storage={pwaAuthStorage}
            adapter={authAdapter}
          >
            <ServiceAuthBoundary fallback={<AuthDemo />}>
              {activeModule === 'messaging' ? (
                <MessagingHub />
              ) : (
                <ConnectedServiceCard title={meta.title} />
              )}
            </ServiceAuthBoundary>
          </ServiceSessionProvider>
        )}
      </AppShell>
    </AppThemeProvider>
  )
}
