import type { ThemeTokens } from '@superapp/design-tokens'
import type { AppModule } from '@superapp/domain'
import type { NavigationItem } from './types'

export const DEFAULT_NAVIGATION_ITEMS: NavigationItem[] = [
  { module: 'superapp', label: 'سوپرآپ' },
  { module: 'messaging', label: 'پیام‌رسان' },
  { module: 'account', label: 'مدیریت حساب' },
]

export function moduleColor(tokens: ThemeTokens, module: AppModule) {
  return {
    superapp: tokens.color.nav.superapp,
    messaging: tokens.color.nav.messenger,
    account: tokens.color.nav.account,
  }[module]
}

export function moduleOnColor(tokens: ThemeTokens, module: AppModule) {
  return {
    superapp: tokens.color.nav.onSuperapp,
    messaging: tokens.color.nav.onMessenger,
    account: tokens.color.nav.onAccount,
  }[module]
}
