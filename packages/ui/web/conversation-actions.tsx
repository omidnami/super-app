import { useState } from 'react'
import type {
  Conversation,
  ConversationStatus,
  OperatorSummary,
  SupportLevel,
} from '@superapp/chat-contracts'
import { CONVERSATION_STATUS_LABELS, SUPPORT_LEVEL_LABELS } from '@superapp/conversation-inbox'
import { useTheme } from '@superapp/theme'
import { Avatar, Badge, Button, Select, TextField } from './primitives'
import { BottomSheet } from './overlays'

export interface AssignmentSheetProps {
  visible: boolean
  conversation: Conversation
  operators: OperatorSummary[]
  currentOperatorId?: string
  loading?: boolean
  error?: string | null
  onAssign: (operatorId: string) => void
  onClose: () => void
}

export interface EscalationSheetProps {
  visible: boolean
  conversation: Conversation
  loading?: boolean
  error?: string | null
  onEscalate: (level: SupportLevel, reason: string) => void
  onClose: () => void
}

export interface ConversationStatusSheetProps {
  visible: boolean
  conversation: Conversation
  loading?: boolean
  error?: string | null
  onStatusChange: (status: ConversationStatus) => void
  onClose: () => void
}

export interface ConversationActionsBarProps {
  conversation: Conversation
  canAssign: boolean
  canEscalate: boolean
  canChangeStatus: boolean
  loading: boolean
  onAssign: () => void
  onEscalate: () => void
  onStatusChange: () => void
}

const SUPPORT_LEVEL_ORDER: SupportLevel[] = ['level_1', 'level_2', 'level_3']
const OTHER_STATUSES: ConversationStatus[] = ['assigned', 'pending_customer', 'escalated']

function formatActionError(error?: string | null) {
  const message = error?.trim()
  if (!message) return null
  if (/\b403\b|forbidden|۴۰۳/i.test(message)) {
    return 'اجازه انجام این عملیات را ندارید. (403)'
  }
  if (/\b409\b|conflict|۴۰۹/i.test(message)) {
    return 'وضعیت گفتگو تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید. (409)'
  }
  return message
}

function ActionError({ error }: { error?: string | null }) {
  const { tokens } = useTheme()
  const message = formatActionError(error)
  if (!message) return null
  return (
    <p className="conversation-action-error" role="alert" style={{ color: tokens.color.danger }}>
      {message}
    </p>
  )
}

export function AssignmentSheet({
  visible,
  conversation,
  operators,
  currentOperatorId,
  loading = false,
  error,
  onAssign,
  onClose,
}: AssignmentSheetProps) {
  const { tokens } = useTheme()
  const currentId = currentOperatorId || conversation.assignee?.id || ''
  const currentAssignee =
    operators.find((operator) => operator.id === currentId) ||
    (conversation.assignee?.id === currentId ? conversation.assignee : null)
  const availableOperators =
    currentId && currentAssignee && !operators.some((operator) => operator.id === currentId)
      ? [currentAssignee, ...operators]
      : operators
  const [selectedOperatorId, setSelectedOperatorId] = useState(currentId)

  const options = availableOperators.map((operator) => ({
    value: operator.id,
    label: operator.name,
  }))
  const hasSelection = Boolean(
    selectedOperatorId && availableOperators.some((operator) => operator.id === selectedOperatorId),
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} title="تخصیص اپراتور">
      <div className="conversation-action-form" dir="rtl" style={{ gap: tokens.spacing.md }}>
        <div
          className="conversation-action-summary"
          style={{
            background: tokens.color.surfaceMuted,
            borderColor: tokens.color.border,
            borderRadius: tokens.radius.lg,
            padding: tokens.spacing.md,
            gap: tokens.spacing.sm,
          }}
        >
          <Avatar label={currentAssignee?.name || 'بدون اپراتور'} />
          <div className="conversation-action-summary-content">
            <span
              className="conversation-action-caption"
              style={{ color: tokens.color.textTertiary }}
            >
              اپراتور فعلی
            </span>
            <strong style={{ color: tokens.color.textPrimary }}>
              {currentAssignee?.name || 'بدون اپراتور'}
            </strong>
          </div>
        </div>

        {availableOperators.length > 0 ? (
          <>
            <Select
              label="اپراتور جدید"
              value={selectedOperatorId}
              options={options}
              onChange={setSelectedOperatorId}
              placeholder="انتخاب اپراتور"
            />
            <section className="conversation-action-section" aria-label="فهرست اپراتوران">
              <h3
                className="conversation-action-section-title"
                style={{ color: tokens.color.textSecondary }}
              >
                فهرست اپراتوران
              </h3>
              <div className="conversation-operator-list" style={{ gap: tokens.spacing.xs }}>
                {availableOperators.map((operator) => {
                  const selected = operator.id === selectedOperatorId
                  return (
                    <button
                      key={operator.id}
                      type="button"
                      className="conversation-operator-row"
                      aria-label={`انتخاب اپراتور ${operator.name}`}
                      aria-pressed={selected}
                      disabled={loading}
                      onClick={() => setSelectedOperatorId(operator.id)}
                      style={{
                        background: selected ? tokens.color.surfaceMuted : tokens.color.surface,
                        borderColor: selected ? tokens.color.primary : tokens.color.border,
                        borderRadius: tokens.radius.md,
                        padding: tokens.spacing.sm,
                        gap: tokens.spacing.sm,
                      }}
                    >
                      <Avatar label={operator.name} size="sm" />
                      <span className="conversation-operator-content">
                        <strong style={{ color: tokens.color.textPrimary }}>{operator.name}</strong>
                        {operator.id === currentId ? (
                          <span
                            className="conversation-action-caption"
                            style={{ color: tokens.color.textTertiary }}
                          >
                            اپراتور فعلی
                          </span>
                        ) : null}
                      </span>
                      {operator.id === currentId ? <Badge label="فعلی" /> : null}
                      {selected ? (
                        <span
                          className="conversation-operator-selected"
                          style={{ color: tokens.color.primary }}
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        ) : (
          <p className="conversation-action-empty" style={{ color: tokens.color.textSecondary }}>
            اپراتوری برای تخصیص وجود ندارد.
          </p>
        )}

        <ActionError error={error} />
        <Button
          label="واگذاری گفتگو"
          loading={loading}
          disabled={loading || !hasSelection}
          onPress={() => {
            if (hasSelection) onAssign(selectedOperatorId)
          }}
        />
      </div>
    </BottomSheet>
  )
}

export function EscalationSheet({
  visible,
  conversation,
  loading = false,
  error,
  onEscalate,
  onClose,
}: EscalationSheetProps) {
  const { tokens } = useTheme()
  const currentLevelIndex = SUPPORT_LEVEL_ORDER.indexOf(conversation.support_level)
  const higherLevels = SUPPORT_LEVEL_ORDER.slice(currentLevelIndex + 1)
  const [selectedLevel, setSelectedLevel] = useState<SupportLevel | ''>(higherLevels[0] || '')
  const [reason, setReason] = useState('')

  return (
    <BottomSheet visible={visible} onClose={onClose} title="ارجاع گفتگو">
      <div className="conversation-action-form" dir="rtl" style={{ gap: tokens.spacing.md }}>
        <p className="conversation-action-body" style={{ color: tokens.color.textSecondary }}>
          سطح پشتیبانی فعلی: {SUPPORT_LEVEL_LABELS[conversation.support_level]}
        </p>
        {higherLevels.length > 0 ? (
          <>
            <Select
              label="سطح جدید"
              value={selectedLevel}
              options={higherLevels.map((level) => ({
                value: level,
                label: SUPPORT_LEVEL_LABELS[level],
              }))}
              onChange={(value) => setSelectedLevel(value as SupportLevel)}
              placeholder="انتخاب سطح"
            />
            <TextField
              label="دلیل ارجاع"
              value={reason}
              onChangeText={setReason}
              placeholder="دلیل ارجاع را بنویسید..."
              hint="دلیل ارجاع اختیاری است."
              accessibilityLabel="دلیل ارجاع"
            />
          </>
        ) : (
          <p className="conversation-action-empty" style={{ color: tokens.color.textSecondary }}>
            سطح پشتیبانی بالاتر برای این گفتگو وجود ندارد.
          </p>
        )}
        <ActionError error={error} />
        <Button
          label="ارجاع"
          loading={loading}
          disabled={loading || !selectedLevel}
          onPress={() => {
            if (selectedLevel) onEscalate(selectedLevel, reason.trim())
          }}
        />
      </div>
    </BottomSheet>
  )
}

export function ConversationStatusSheet({
  visible,
  conversation,
  loading = false,
  error,
  onStatusChange,
  onClose,
}: ConversationStatusSheetProps) {
  const { tokens } = useTheme()
  const primaryStatuses: ConversationStatus[] =
    conversation.status === 'closed'
      ? ['open']
      : (['open', 'closed'] as ConversationStatus[]).filter(
          (status) => status !== conversation.status,
        )
  const otherStatuses = OTHER_STATUSES.filter((status) => status !== conversation.status)

  const statusLabel = (status: ConversationStatus) =>
    status === 'open' && conversation.status === 'closed'
      ? 'باز کردن مجدد گفتگو'
      : CONVERSATION_STATUS_LABELS[status]

  return (
    <BottomSheet visible={visible} onClose={onClose} title="تغییر وضعیت گفتگو">
      <div className="conversation-action-form" dir="rtl" style={{ gap: tokens.spacing.md }}>
        <p className="conversation-action-body" style={{ color: tokens.color.textSecondary }}>
          وضعیت فعلی: {CONVERSATION_STATUS_LABELS[conversation.status]}
        </p>
        <div className="conversation-status-actions" style={{ gap: tokens.spacing.sm }}>
          {primaryStatuses.map((status) => (
            <Button
              key={status}
              label={statusLabel(status)}
              variant={status === 'closed' ? 'danger' : 'primary'}
              loading={loading}
              disabled={loading}
              onPress={() => onStatusChange(status)}
            />
          ))}
        </div>
        {otherStatuses.length > 0 ? (
          <section className="conversation-action-section" aria-label="سایر وضعیت‌ها">
            <h3
              className="conversation-action-section-title"
              style={{ color: tokens.color.textSecondary }}
            >
              سایر وضعیت‌ها
            </h3>
            <div className="conversation-status-actions" style={{ gap: tokens.spacing.sm }}>
              {otherStatuses.map((status) => (
                <Button
                  key={status}
                  label={CONVERSATION_STATUS_LABELS[status]}
                  variant="secondary"
                  loading={loading}
                  disabled={loading}
                  onPress={() => onStatusChange(status)}
                />
              ))}
            </div>
          </section>
        ) : null}
        <ActionError error={error} />
      </div>
    </BottomSheet>
  )
}

export function ConversationActionsBar({
  conversation,
  canAssign,
  canEscalate,
  canChangeStatus,
  loading,
  onAssign,
  onEscalate,
  onStatusChange,
}: ConversationActionsBarProps) {
  const { tokens } = useTheme()
  return (
    <div
      className="conversation-actions-bar"
      dir="rtl"
      aria-label="عملیات گفتگو"
      style={{ gap: tokens.spacing.xs, padding: tokens.spacing.sm }}
    >
      <Button
        label={conversation.assignee ? 'تغییر اپراتور' : 'تخصیص اپراتور'}
        variant="secondary"
        size="sm"
        loading={loading}
        disabled={loading || !canAssign}
        onPress={onAssign}
      />
      <Button
        label="ارجاع"
        variant="secondary"
        size="sm"
        loading={loading}
        disabled={loading || !canEscalate}
        onPress={onEscalate}
      />
      <Button
        label={conversation.status === 'closed' ? 'باز کردن گفتگو' : 'تغییر وضعیت'}
        variant="secondary"
        size="sm"
        loading={loading}
        disabled={loading || !canChangeStatus}
        onPress={onStatusChange}
      />
    </div>
  )
}
