import { useTheme } from '@superapp/theme'
import { DEFAULT_NAVIGATION_ITEMS, moduleColor, moduleOnColor } from '../src/module'
import type {
  DesktopSidebarProps,
  HeaderProps,
  MiniAppHeaderProps,
  MiniAppShellProps,
  MobileNavigationProps,
  ScreenProps,
} from '../src/types'

export function Screen({ children, scroll = false, accessibilityLabel }: ScreenProps) {
  const { tokens } = useTheme()
  return (
    <main
      aria-label={accessibilityLabel}
      className={`ui-screen ${scroll ? 'ui-screen-scroll' : ''}`}
      style={{ background: tokens.color.background, color: tokens.color.textPrimary }}
    >
      {children}
    </main>
  )
}

export function Header({ title, subtitle, leading, trailing }: HeaderProps) {
  const { tokens } = useTheme()
  return (
    <header className="ui-header" style={{ borderBottomColor: tokens.color.border }}>
      {leading}
      <div className="ui-header-content">
        <strong style={{ color: tokens.color.textPrimary }}>{title}</strong>
        {subtitle ? <span style={{ color: tokens.color.textTertiary }}>{subtitle}</span> : null}
      </div>
      {trailing}
    </header>
  )
}

export function MiniAppHeader({ module, title, subtitle, trailing }: MiniAppHeaderProps) {
  const { tokens } = useTheme()
  return (
    <header
      className="ui-mini-header"
      style={{ background: moduleColor(tokens, module), color: moduleOnColor(tokens, module) }}
    >
      <div className="ui-header-content">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {trailing}
    </header>
  )
}

export function MobileNavigation({
  activeModule,
  onModuleChange,
  items = DEFAULT_NAVIGATION_ITEMS,
}: MobileNavigationProps) {
  const { tokens } = useTheme()
  return (
    <nav
      className="ui-mobile-nav"
      aria-label="ناوبری اصلی"
      style={{ background: tokens.color.surface, borderTopColor: tokens.color.border }}
    >
      {items.map((item) => {
        const selected = item.module === activeModule
        const color = moduleColor(tokens, item.module)
        return (
          <button
            key={item.module}
            type="button"
            aria-label={item.label}
            aria-pressed={selected}
            onClick={() => onModuleChange(item.module)}
          >
            <span
              className="ui-nav-icon"
              style={{
                background: selected ? color : tokens.color.surfaceMuted,
                color: selected ? moduleOnColor(tokens, item.module) : tokens.color.textTertiary,
              }}
            >
              {item.label.slice(0, 1)}
            </span>
            <span style={{ color: selected ? color : tokens.color.textTertiary }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export function DesktopSidebar({
  activeModule,
  onModuleChange,
  items = DEFAULT_NAVIGATION_ITEMS,
  title = 'Superapp',
}: DesktopSidebarProps) {
  const { tokens } = useTheme()
  return (
    <aside
      className="ui-sidebar"
      aria-label="ناوبری جانبی"
      style={{ background: tokens.color.surface, borderLeftColor: tokens.color.border }}
    >
      <strong style={{ color: tokens.color.textPrimary }}>{title}</strong>
      {items.map((item) => {
        const selected = item.module === activeModule
        return (
          <button
            key={item.module}
            type="button"
            aria-label={item.label}
            aria-pressed={selected}
            onClick={() => onModuleChange(item.module)}
            style={{ background: selected ? tokens.color.surfaceMuted : 'transparent' }}
          >
            <span
              className="ui-nav-icon"
              style={{
                background: moduleColor(tokens, item.module),
                color: moduleOnColor(tokens, item.module),
              }}
            >
              {item.label.slice(0, 1)}
            </span>
            <span
              style={{ color: selected ? tokens.color.textPrimary : tokens.color.textSecondary }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

export function MiniAppShell({
  module,
  title,
  subtitle,
  children,
  navigation,
  mobileNavigation,
  trailing,
}: MiniAppShellProps) {
  const { tokens } = useTheme()
  return (
    <div className="ui-shell" style={{ background: tokens.color.background }}>
      <div className="ui-shell-row">
        {navigation}
        <div className="ui-shell-content">
          <MiniAppHeader module={module} title={title} subtitle={subtitle} trailing={trailing} />
          <div className="ui-shell-body">{children}</div>
        </div>
      </div>
      {mobileNavigation}
    </div>
  )
}

export const SuperAppNavigation = MobileNavigation

export function AppShell({
  module,
  title,
  subtitle,
  children,
  activeModule,
  onModuleChange,
}: MiniAppShellProps & {
  activeModule: MiniAppShellProps['module']
  onModuleChange: (module: MiniAppShellProps['module']) => void
}) {
  return (
    <MiniAppShell
      module={module}
      title={title}
      subtitle={subtitle}
      navigation={<DesktopSidebar activeModule={activeModule} onModuleChange={onModuleChange} />}
      mobileNavigation={
        <MobileNavigation activeModule={activeModule} onModuleChange={onModuleChange} />
      }
    >
      {children}
    </MiniAppShell>
  )
}
