import type { ReactNode } from 'react'
import { useTheme } from '@superapp/theme'
import type { BottomSheetProps, ConfirmDialogProps, ModalProps } from '../src/types'
import { Button } from './primitives'

function Overlay({
  children,
  onClose,
  label,
}: {
  children: ReactNode
  onClose: () => void
  label: string
}) {
  const { tokens } = useTheme()
  return (
    <div
      className="ui-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      style={{ background: tokens.color.overlay }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="ui-dialog"
        style={{ background: tokens.color.surface, borderRadius: tokens.radius.xl }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalView({ visible, onClose, title, children }: ModalProps) {
  if (!visible) return null
  return (
    <Overlay onClose={onClose} label={title}>
      <div className="ui-dialog-header">
        <strong>{title}</strong>
        <button type="button" aria-label="بستن" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="ui-dialog-content">{children}</div>
    </Overlay>
  )
}

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  if (!visible) return null
  return (
    <Overlay onClose={onClose} label={title}>
      <div className="ui-sheet-handle" />
      <div className="ui-dialog-header">
        <strong>{title}</strong>
        <button type="button" aria-label="بستن" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="ui-dialog-content">{children}</div>
    </Overlay>
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
  return (
    <ModalView visible={visible} onClose={onCancel} title={title}>
      <p>{message}</p>
      <div className="ui-dialog-actions">
        <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
        <Button
          label={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          onPress={onConfirm}
        />
      </div>
    </ModalView>
  )
}
