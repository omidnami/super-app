import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { APP_NAME } from '@superapp/domain'
import type { ColorTokens, ThemeTokens } from '@superapp/design-tokens'
import { useTheme } from '@superapp/theme'
import { ThemeControls } from './ThemeControls'

const colorEntries: Array<[keyof Omit<ColorTokens, 'nav'>, string]> = [
  ['background', 'Background'],
  ['surface', 'Surface'],
  ['surfaceElevated', 'Surface Elevated'],
  ['surfaceMuted', 'Surface Muted'],
  ['textPrimary', 'Text Primary'],
  ['textSecondary', 'Text Secondary'],
  ['textTertiary', 'Text Tertiary'],
  ['border', 'Border'],
  ['borderStrong', 'Border Strong'],
  ['primary', 'Primary'],
  ['primaryHover', 'Primary Hover'],
  ['primaryPressed', 'Primary Pressed'],
  ['onPrimary', 'On Primary'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['danger', 'Danger'],
  ['info', 'Info'],
  ['skeleton', 'Skeleton'],
]

export function ThemeGallery() {
  const { resolvedMode, tokens } = useTheme()
  const styles = createStyles(tokens)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="theme-gallery">
      <View style={styles.header}>
        <Text style={styles.display}>{APP_NAME}</Text>
        <Text style={styles.caption}>Theme Gallery · {resolvedMode}</Text>
      </View>

      <ThemeControls />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>رنگ‌های Semantic</Text>
        <View style={styles.swatchGrid}>
          {colorEntries.map(([key, label]) => (
            <View key={key} style={styles.swatchItem}>
              <View style={[styles.colorBox, { backgroundColor: tokens.color[key] }]} />
              <Text style={styles.swatchLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>رنگ مینی‌اپ‌ها</Text>
        <View style={styles.navRow}>
          {[
            ['superapp', 'سوپرآپ'],
            ['messenger', 'پیام‌رسان'],
            ['account', 'مدیریت حساب'],
          ].map(([key, label]) => (
            <View
              key={key}
              style={[
                styles.navChip,
                { backgroundColor: tokens.color.nav[key as keyof ColorTokens['nav']] },
              ]}
            >
              <Text
                style={[
                  styles.navText,
                  {
                    color:
                      tokens.color.nav[
                        `on${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof ColorTokens['nav']
                      ],
                  },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Typography</Text>
        <Text style={[styles.typeDisplay, { color: tokens.color.textPrimary }]}>نمایش Display</Text>
        <Text style={[styles.typeTitle, { color: tokens.color.textPrimary }]}>نمایش Title</Text>
        <Text style={[styles.typeBody, { color: tokens.color.textSecondary }]}>
          نمایش Body برای متن‌های روزمره
        </Text>
        <Text style={[styles.typeCaption, { color: tokens.color.textTertiary }]}>
          نمایش Caption
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spacing</Text>
        <View style={styles.spacingRow}>
          {Object.entries(tokens.spacing).map(([key, value]) => (
            <View key={key} style={styles.spacingItem}>
              <View
                style={[styles.spacingBar, { width: value, backgroundColor: tokens.color.primary }]}
              />
              <Text style={styles.swatchLabel}>
                {key} · {value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Radius</Text>
        <View style={styles.radiusRow}>
          {Object.entries(tokens.radius).map(([key, value]) => (
            <View key={key} style={styles.radiusItem}>
              <View
                style={[
                  styles.radiusBox,
                  {
                    borderRadius: Math.min(value, 40),
                    borderColor: tokens.color.primary,
                  },
                ]}
              />
              <Text style={styles.swatchLabel}>{key}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Elevation</Text>
        <View style={styles.elevationRow}>
          {Object.entries(tokens.elevation).map(([key, value]) => (
            <View
              key={key}
              style={[
                styles.elevationBox,
                {
                  backgroundColor: tokens.color.surfaceElevated,
                  elevation: value,
                  shadowOpacity: value === 0 ? 0 : 0.16,
                },
              ]}
            >
              <Text style={styles.swatchLabel}>{key}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function createStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tokens.color.background,
    },
    content: {
      padding: tokens.spacing.lg,
      gap: tokens.spacing.lg,
    },
    header: {
      gap: tokens.spacing.xs,
      paddingVertical: tokens.spacing.md,
    },
    display: {
      ...tokens.typography.display,
      color: tokens.color.textPrimary,
    },
    caption: {
      ...tokens.typography.caption,
      color: tokens.color.textTertiary,
    },
    section: {
      padding: tokens.spacing.lg,
      backgroundColor: tokens.color.surface,
      borderRadius: tokens.radius.lg,
      borderWidth: 1,
      borderColor: tokens.color.border,
      gap: tokens.spacing.md,
    },
    sectionTitle: {
      ...tokens.typography.title,
      color: tokens.color.textPrimary,
    },
    swatchGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
    },
    swatchItem: {
      width: '30%',
      minWidth: 86,
      gap: tokens.spacing.xs,
    },
    colorBox: {
      height: 44,
      borderRadius: tokens.radius.sm,
      borderWidth: 1,
      borderColor: tokens.color.border,
    },
    swatchLabel: {
      ...tokens.typography.caption,
      color: tokens.color.textSecondary,
    },
    navRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
    },
    navChip: {
      minHeight: 44,
      paddingHorizontal: tokens.spacing.md,
      borderRadius: tokens.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navText: {
      ...tokens.typography.body,
    },
    typeDisplay: {
      ...tokens.typography.display,
    },
    typeTitle: {
      ...tokens.typography.title,
    },
    typeBody: {
      ...tokens.typography.body,
    },
    typeCaption: {
      ...tokens.typography.caption,
    },
    spacingRow: {
      gap: tokens.spacing.sm,
    },
    spacingItem: {
      gap: tokens.spacing.xs,
    },
    spacingBar: {
      height: 8,
      borderRadius: tokens.radius.full,
    },
    radiusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.md,
    },
    radiusItem: {
      alignItems: 'center',
      gap: tokens.spacing.xs,
    },
    radiusBox: {
      width: 42,
      height: 42,
      borderWidth: 2,
    },
    elevationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.md,
    },
    elevationBox: {
      width: 72,
      height: 56,
      borderRadius: tokens.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
