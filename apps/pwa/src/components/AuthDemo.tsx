import { useTheme } from '@superapp/theme'
import { useServiceSession } from '@superapp/ui'
import { Badge, Button, Card, StatusPill } from '@superapp/ui/web'

const serviceLabels = {
  messaging: 'پیام‌رسان',
  account: 'مدیریت حساب',
}

const statusLabels = {
  disconnected: 'متصل نیست',
  connecting: 'در حال اتصال...',
  connected: 'متصل است',
  expired: 'نشست منقضی شده',
  error: 'خطای اتصال',
}

export function AuthDemo() {
  const { tokens } = useTheme()
  const { service, status, error, connect, disconnect, expire } = useServiceSession()
  const label = serviceLabels[service]

  return (
    <Card>
      <div className="gallery-stack">
        <Badge label={`اتصال مستقل ${label}`} tone="primary" />
        <h2>{status === 'connected' ? `${label} متصل است` : `اتصال به ${label}`}</h2>
        <p>
          هر سرویس Session جداگانه دارد. خروج از {label} روی سرویس دیگر یا CRM محلی تأثیر نمی‌گذارد.
        </p>
        <StatusPill
          label={statusLabels[status]}
          tone={
            status === 'connected'
              ? 'success'
              : status === 'error' || status === 'expired'
                ? 'danger'
                : 'warning'
          }
        />
        {error ? <p style={{ color: tokens.color.danger }}>{error.message}</p> : null}
        {status === 'connected' ? (
          <div className="gallery-row">
            <Button
              label="شبیه‌سازی انقضای نشست"
              variant="secondary"
              onPress={() => void expire()}
            />
            <Button label="خروج از سرویس" variant="danger" onPress={() => void disconnect()} />
          </div>
        ) : (
          <Button
            label={`اتصال به ${label}`}
            loading={status === 'connecting'}
            onPress={() => void connect()}
          />
        )}
      </div>
    </Card>
  )
}
