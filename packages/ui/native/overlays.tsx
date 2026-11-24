import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@superapp/theme'
import type { BottomSheetProps, ConfirmDialogProps, ModalProps } from '../src/types'
import { Button } from './primitives'

export function ModalView({ visible, onClose, title, children }: ModalProps) {
  const { tokens } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: tokens.color.overlay }]}
        onPress={onClose}
      >
        <Pressable
          accessibilityRole="dialog"
          accessibilityLabel={title}
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.modal,
            { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.xl },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: tokens.color.border }]}>
            <Text style={[styles.title, { color: tokens.color.textPrimary }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="بستن" onPress={onClose}>
              <Text style={{ color: tokens.color.textTertiary }}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeight = '85%',
}: BottomSheetProps) {
  const { tokens } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: tokens.color.overlay }]}
        onPress={onClose}
      >
        <View
          accessibilityRole="dialog"
          accessibilityLabel={title}
          style={[
            styles.sheet,
            {
              backgroundColor: tokens.color.surface,
              borderTopLeftRadius: tokens.radius.xl,
              borderTopRightRadius: tokens.radius.xl,
              maxHeight,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: tokens.color.borderStrong }]} />
          <View style={[styles.header, { borderBottomColor: tokens.color.border }]}>
            <Text style={[styles.title, { color: tokens.color.textPrimary }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="بستن" onPress={onClose}>
              <Text style={{ color: tokens.color.textTertiary }}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        </View>
      </Pressable>
    </Modal>
  )
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  onConfirm,
  onCancel,
  destructive,
}: ConfirmDialogProps) {
  const { tokens } = useTheme()
  return (
    <ModalView visible={visible} onClose={onCancel} title={title}>
      <Text style={{ color: tokens.color.textSecondary }}>{message}</Text>
      <View style={styles.actions}>
        <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
        <Button
          label={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          onPress={onConfirm}
        />
      </View>
    </ModalView>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 20 },
  modal: { maxHeight: '85%', overflow: 'hidden' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8 },
  header: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
