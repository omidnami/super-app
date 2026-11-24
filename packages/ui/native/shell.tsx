import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.screenContent, { padding: tokens.spacing.lg }]}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, { padding: tokens.spacing.lg }]}>{children}</View>
  )
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.screen, { backgroundColor: tokens.color.background }]}
    >
      {content}
    </View>
  )
}

export function Header({ title, subtitle, leading, trailing }: HeaderProps) {
  const { tokens } = useTheme()
  return (
    <View style={[styles.header, { borderBottomColor: tokens.color.border }]}>
      {leading}
      <View style={styles.headerContent}>
        <Text style={[styles.headerTitle, { color: tokens.color.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: tokens.color.textTertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  )
}

export function MiniAppHeader({ module, title, subtitle, trailing }: MiniAppHeaderProps) {
  const { tokens } = useTheme()
  const color = moduleColor(tokens, module)
  const onColor = moduleOnColor(tokens, module)
  return (
    <View style={[styles.miniHeader, { backgroundColor: color }]}>
      <View style={styles.headerContent}>
        <Text style={[styles.headerTitle, { color: onColor }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: onColor }]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
    </View>
  )
}

export function MobileNavigation({
  activeModule,
  onModuleChange,
  items = DEFAULT_NAVIGATION_ITEMS,
}: MobileNavigationProps) {
  const { tokens } = useTheme()
  return (
    <View
      style={[
        styles.bottomNav,
        { backgroundColor: tokens.color.surface, borderTopColor: tokens.color.border },
      ]}
    >
      {items.map((item) => {
        const selected = item.module === activeModule
        const color = moduleColor(tokens, item.module)
        return (
          <Pressable
            key={item.module}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onModuleChange(item.module)}
            style={styles.navItem}
          >
            <View
              style={[
                styles.navIcon,
                { backgroundColor: selected ? color : tokens.color.surfaceMuted },
              ]}
            >
              <Text
                style={{
                  color: selected ? moduleOnColor(tokens, item.module) : tokens.color.textTertiary,
                }}
              >
                {item.label.slice(0, 1)}
              </Text>
            </View>
            <Text style={{ color: selected ? color : tokens.color.textTertiary, fontSize: 11 }}>
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
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
    <View
      style={[
        styles.sidebar,
        { backgroundColor: tokens.color.surface, borderLeftColor: tokens.color.border },
      ]}
    >
      <Text style={[styles.sidebarTitle, { color: tokens.color.textPrimary }]}>{title}</Text>
      {items.map((item) => {
        const selected = item.module === activeModule
        const color = moduleColor(tokens, item.module)
        return (
          <Pressable
            key={item.module}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onModuleChange(item.module)}
            style={[
              styles.sidebarItem,
              { backgroundColor: selected ? tokens.color.surfaceMuted : 'transparent' },
            ]}
          >
            <View style={[styles.navIcon, { backgroundColor: color }]}>
              <Text style={{ color: moduleOnColor(tokens, item.module) }}>
                {item.label.slice(0, 1)}
              </Text>
            </View>
            <Text
              style={{ color: selected ? tokens.color.textPrimary : tokens.color.textSecondary }}
            >
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function MiniAppShell({
  module,
  title,
  subtitle,
  children,
  navigation,
  trailing,
}: MiniAppShellProps) {
  const { tokens } = useTheme()
  return (
    <View style={[styles.shell, { backgroundColor: tokens.color.background }]}>
      <View style={styles.shellRow}>
        {navigation}
        <View style={styles.shellContent}>
          <MiniAppHeader module={module} title={title} subtitle={subtitle} trailing={trailing} />
          <View style={{ padding: tokens.spacing.lg, paddingBottom: 88 }}>{children}</View>
        </View>
      </View>
    </View>
  )
}

export const SuperAppNavigation = MobileNavigation

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenContent: { flexGrow: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSubtitle: { fontSize: 11 },
  miniHeader: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 68,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: { minWidth: 84, alignItems: 'center', gap: 4, paddingVertical: 6 },
  navIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebar: { width: 220, padding: 16, gap: 8, borderLeftWidth: StyleSheet.hairlineWidth },
  sidebarTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  sidebarItem: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shell: { flex: 1 },
  shellRow: { flex: 1, flexDirection: 'row' },
  shellContent: { flex: 1 },
})
