import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { normalizeHexColor, type ThemeTokens } from '@superapp/design-tokens'
import { useTheme } from '@superapp/theme'
import { AccentColorPicker, ThemeModeSelector } from '@superapp/ui'

export function ThemeControls() {
  const { accentColor, setAccentColor, setThemeMode, themeMode, tokens } = useTheme()
  const styles = createStyles(tokens)

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>حالت تم</Text>
      <View style={styles.modeRow}>
        <ThemeModeSelector
          value={themeMode}
          onChange={setThemeMode}
          renderOption={({ label, selected, accessibilityLabel, onPress }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ selected }}
              onPress={onPress}
              style={[styles.modeButton, selected && styles.modeButtonSelected]}
            >
              <Text style={[styles.modeText, selected && styles.modeTextSelected]}>{label}</Text>
            </Pressable>
          )}
        />
      </View>

      <Text style={[styles.sectionTitle, styles.spacedTitle]}>رنگ برند</Text>
      <View style={styles.swatchRow}>
        <AccentColorPicker
          value={accentColor}
          onChange={setAccentColor}
          renderPreset={({ preset, selected, accessibilityLabel, onPress }) => (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ selected }}
              onPress={onPress}
              style={[styles.swatch, selected && styles.swatchSelected]}
            >
              <View style={[styles.swatchColor, { backgroundColor: preset.color }]} />
            </Pressable>
          )}
          renderCustomInput={({ value, accessibilityLabel, onChange }) => (
            <View style={styles.customColor}>
              <TextInput
                key={accentColor}
                accessibilityLabel={accessibilityLabel}
                defaultValue={value}
                onChangeText={(nextValue) => {
                  if (normalizeHexColor(nextValue)) onChange(nextValue)
                }}
                autoCapitalize="characters"
                maxLength={7}
                style={styles.colorInput}
              />
            </View>
          )}
        />
      </View>
    </View>
  )
}

function createStyles(tokens: ThemeTokens) {
  return StyleSheet.create({
    container: {
      padding: tokens.spacing.lg,
      backgroundColor: tokens.color.surface,
      borderRadius: tokens.radius.lg,
      borderWidth: 1,
      borderColor: tokens.color.border,
    },
    sectionTitle: {
      ...tokens.typography.title,
      color: tokens.color.textPrimary,
    },
    spacedTitle: {
      marginTop: tokens.spacing.xl,
    },
    modeRow: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.md,
    },
    modeButton: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: tokens.color.border,
      backgroundColor: tokens.color.surfaceMuted,
    },
    modeButtonSelected: {
      borderColor: tokens.color.primary,
      backgroundColor: tokens.color.primary,
    },
    modeText: {
      ...tokens.typography.body,
      color: tokens.color.textSecondary,
    },
    modeTextSelected: {
      color: tokens.color.onPrimary,
    },
    swatchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.md,
    },
    swatch: {
      padding: 3,
      borderRadius: tokens.radius.full,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchSelected: {
      borderColor: tokens.color.primary,
    },
    swatchColor: {
      width: 34,
      height: 34,
      borderRadius: tokens.radius.full,
    },
    customColor: {
      minWidth: 108,
      flexGrow: 1,
    },
    colorInput: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: tokens.color.border,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.spacing.sm,
      color: tokens.color.textPrimary,
      backgroundColor: tokens.color.surfaceMuted,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
  })
}
