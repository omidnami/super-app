import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
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
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.error, { color: tokens.color.danger }]}
    >
      {message}
    </Text>
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
      <View style={[styles.form, { gap: tokens.spacing.md }]}>
        <View
          style={[
            styles.summary,
            {
              backgroundColor: tokens.color.surfaceMuted,
              borderColor: tokens.color.border,
              borderRadius: tokens.radius.lg,
              padding: tokens.spacing.md,
              gap: tokens.spacing.sm,
            },
          ]}
        >
          <Avatar label={currentAssignee?.name || 'بدون اپراتور'} />
          <View style={styles.summaryContent}>
            <Text style={[styles.caption, { color: tokens.color.textTertiary }]}>اپراتور فعلی</Text>
            <Text style={[styles.title, { color: tokens.color.textPrimary }]}>
              {currentAssignee?.name || 'بدون اپراتور'}
            </Text>
          </View>
        </View>

        {availableOperators.length > 0 ? (
          <>
            <Select
              label="اپراتور جدید"
              value={selectedOperatorId}
              options={options}
              onChange={setSelectedOperatorId}
              placeholder="انتخاب اپراتور"
            />
            <View style={[styles.section, { gap: tokens.spacing.sm }]}>
              <Text style={[styles.sectionTitle, { color: tokens.color.textSecondary }]}>
                فهرست اپراتوران
              </Text>
              <View style={[styles.operatorList, { gap: tokens.spacing.xs }]}>
                {availableOperators.map((operator) => {
                  const selected = operator.id === selectedOperatorId
                  return (
                    <Pressable
                      key={operator.id}
                      accessibilityRole="button"
                      accessibilityLabel={`انتخاب اپراتور ${operator.name}`}
                      accessibilityState={{ selected, disabled: loading }}
                      disabled={loading}
                      onPress={() => setSelectedOperatorId(operator.id)}
                      style={[
                        styles.operatorRow,
                        {
                          backgroundColor: selected
                            ? tokens.color.surfaceMuted
                            : tokens.color.surface,
                          borderColor: selected ? tokens.color.primary : tokens.color.border,
                          borderRadius: tokens.radius.md,
                          padding: tokens.spacing.sm,
                          gap: tokens.spacing.sm,
                          opacity: loading ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Avatar label={operator.name} size="sm" />
                      <View style={styles.operatorContent}>
                        <Text style={[styles.operatorName, { color: tokens.color.textPrimary }]}>
                          {operator.name}
                        </Text>
                        {operator.id === currentId ? (
                          <Text style={[styles.caption, { color: tokens.color.textTertiary }]}>
                            اپراتور فعلی
                          </Text>
                        ) : null}
                      </View>
                      {operator.id === currentId ? <Badge label="فعلی" /> : null}
                      {selected ? (
                        <Text style={[styles.selectedMark, { color: tokens.color.primary }]}>
                          ✓
                        </Text>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </>
        ) : (
          <Text style={[styles.empty, { color: tokens.color.textSecondary }]}>
            اپراتوری برای تخصیص وجود ندارد.
          </Text>
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
      </View>
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
      <View style={[styles.form, { gap: tokens.spacing.md }]}>
        <Text style={[styles.body, { color: tokens.color.textSecondary }]}>
          سطح پشتیبانی فعلی: {SUPPORT_LEVEL_LABELS[conversation.support_level]}
        </Text>
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
          <Text style={[styles.empty, { color: tokens.color.textSecondary }]}>
            سطح پشتیبانی بالاتر برای این گفتگو وجود ندارد.
          </Text>
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
      </View>
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
      <View style={[styles.form, { gap: tokens.spacing.md }]}>
        <Text style={[styles.body, { color: tokens.color.textSecondary }]}>
          وضعیت فعلی: {CONVERSATION_STATUS_LABELS[conversation.status]}
        </Text>
        <View style={[styles.statusActions, { gap: tokens.spacing.sm }]}>
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
        </View>
        {otherStatuses.length > 0 ? (
          <View style={[styles.section, { gap: tokens.spacing.sm }]}>
            <Text style={[styles.sectionTitle, { color: tokens.color.textSecondary }]}>
              سایر وضعیت‌ها
            </Text>
            <View style={[styles.statusActions, { gap: tokens.spacing.sm }]}>
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
            </View>
          </View>
        ) : null}
        <ActionError error={error} />
      </View>
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
    <View
      accessibilityLabel="عملیات گفتگو"
      style={[styles.actionsBar, { gap: tokens.spacing.xs, padding: tokens.spacing.sm }]}
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
    </View>
  )
}

const styles = StyleSheet.create({
  form: { width: '100%' },
  body: { fontSize: 14, lineHeight: 22, writingDirection: 'rtl', textAlign: 'right' },
  caption: { fontSize: 12, writingDirection: 'rtl', textAlign: 'right' },
  title: { fontSize: 15, fontWeight: '700', writingDirection: 'rtl', textAlign: 'right' },
  summary: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  summaryContent: { flex: 1, gap: 2 },
  section: { width: '100%' },
  sectionTitle: { fontSize: 12, fontWeight: '700', writingDirection: 'rtl', textAlign: 'right' },
  operatorList: { width: '100%' },
  operatorRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  operatorContent: { flex: 1, gap: 2 },
  operatorName: { fontSize: 14, fontWeight: '700', writingDirection: 'rtl', textAlign: 'right' },
  selectedMark: { fontSize: 18, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 21, writingDirection: 'rtl', textAlign: 'right' },
  error: { fontSize: 12, lineHeight: 20, writingDirection: 'rtl', textAlign: 'right' },
  statusActions: { width: '100%' },
  actionsBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
})
