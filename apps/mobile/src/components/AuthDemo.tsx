import { Text, View } from 'react-native'
import { useTheme } from '@superapp/theme'
import { useServiceSession } from '@superapp/ui'
import { Badge, Button, Card, StatusPill } from '@superapp/ui/native'

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
      <View style={{ gap: tokens.spacing.xs }}>
        <Badge label={`اتصال مستقل ${label}`} tone="primary" />
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          {status === 'connected' ? `${label} متصل است` : `اتصال به ${label}`}
        </Text>
        <Text style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}>
          هر سرویس Session جداگانه دارد. خروج از {label} روی سرویس دیگر یا CRM محلی تأثیر نمی‌گذارد.
        </Text>
      </View>

      <View style={{ marginTop: tokens.spacing.lg, gap: tokens.spacing.sm }}>
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
        {error ? (
          <Text style={{ ...tokens.typography.caption, color: tokens.color.danger }}>
            {error.message}
          </Text>
        ) : null}
        {status === 'connected' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
            <Button
              label="شبیه‌سازی انقضای نشست"
              variant="secondary"
              onPress={() => void expire()}
            />
            <Button label="خروج از سرویس" variant="danger" onPress={() => void disconnect()} />
          </View>
        ) : (
          <Button
            label={`اتصال به ${label}`}
            loading={status === 'connecting'}
            onPress={() => void connect()}
          />
        )}
      </View>
    </Card>
  )
}
