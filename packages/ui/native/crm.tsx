import { useMemo, useState, type ReactNode } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import type {
  CrmContact,
  CrmContactInput,
  CrmInteraction,
  CrmInteractionInput,
  CrmInteractionKind,
  CrmNote,
  CrmNoteInput,
  CrmTag,
  CrmTagInput,
  CrmTask,
  CrmTaskInput,
  UseCrmResult,
} from '@superapp/crm'
import { useTheme } from '@superapp/theme'
import { formatPersianDate, formatPersianDateTime } from '../src/format'
import {
  Avatar,
  Badge,
  Button,
  Card,
  FilterChip,
  SearchBar,
  Select,
  Tabs,
  TextField,
} from './primitives'
import { EmptyState, Skeleton, Toast } from './feedback'
import { BottomSheet, ConfirmDialog } from './overlays'
import { Screen } from './shell'

export interface CrmWorkspaceProps {
  crm: UseCrmResult
  onShareBackup: (payload: string) => Promise<void> | void
  onPickBackup: () => Promise<string | null>
}

type WorkspaceTab = 'contacts' | 'tasks' | 'tags'
type ContactDetailTab = 'notes' | 'tasks' | 'interactions'
type TaskFilter = 'all' | 'open' | 'completed'
type TextTone =
  | 'textPrimary'
  | 'textSecondary'
  | 'textTertiary'
  | 'primary'
  | 'onPrimary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
type NoticeTone = 'info' | 'success' | 'warning' | 'danger'
type ToastState = { message: string; tone: 'success' | 'error' } | null

type CrmEditor =
  | { kind: 'contact'; contact: CrmContact | null }
  | { kind: 'tag'; tag: CrmTag | null }
  | { kind: 'note'; note: CrmNote | null; contactId: string }
  | {
      kind: 'task'
      task: CrmTask | null
      contactId: string | null
      lockContact: boolean
    }
  | { kind: 'interaction'; interaction: CrmInteraction | null; contactId: string }

type DeleteTarget =
  | { kind: 'contact'; item: CrmContact }
  | { kind: 'tag'; item: CrmTag }
  | { kind: 'note'; item: CrmNote }
  | { kind: 'task'; item: CrmTask }
  | { kind: 'interaction'; item: CrmInteraction }

const INTERACTION_KINDS: Array<{ value: CrmInteractionKind; label: string }> = [
  { value: 'call', label: 'تماس' },
  { value: 'message', label: 'پیام' },
  { value: 'meeting', label: 'جلسه' },
  { value: 'email', label: 'ایمیل' },
  { value: 'other', label: 'سایر' },
]

const TASK_FILTERS: Array<{ value: TaskFilter; label: string }> = [
  { value: 'all', label: 'همه' },
  { value: 'open', label: 'در انتظار' },
  { value: 'completed', label: 'انجام‌شده' },
]

function persianNumber(value: number) {
  return value.toLocaleString('fa-IR')
}

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
}

function normalizePin(value: string) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 8)
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
}

function dateError(value: string) {
  if (!value) return undefined
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    return 'تاریخ باید معتبر و با قالب YYYY-MM-DD باشد.'
  }
  return undefined
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function toDateTimeInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

function dateTimeError(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    toDateTimeInput(date.toISOString()) !== value
  ) {
    return 'زمان باید معتبر و با قالب YYYY-MM-DDTHH:mm باشد.'
  }
  return undefined
}

function emailError(value: string) {
  if (!value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return undefined
  return 'ایمیل را با قالب درست وارد کنید.'
}

function CrmText({
  children,
  variant = 'body',
  tone = 'textPrimary',
  style,
  numberOfLines,
}: {
  children: ReactNode
  variant?: 'display' | 'title' | 'body' | 'caption'
  tone?: TextTone
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  const { tokens } = useTheme()
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          ...tokens.typography[variant],
          color: tokens.color[tone],
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

function SectionHeading({
  title,
  caption,
  action,
}: {
  title: string
  caption?: string
  action?: ReactNode
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingText}>
        <CrmText variant="title">{title}</CrmText>
        {caption ? (
          <CrmText variant="caption" tone="textTertiary">
            {caption}
          </CrmText>
        ) : null}
      </View>
      {action}
    </View>
  )
}

function Notice({ message, tone = 'info' }: { message: string; tone?: NoticeTone }) {
  const { tokens } = useTheme()
  const accent = tokens.color[tone]
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        {
          backgroundColor: tokens.color.surfaceMuted,
          borderColor: accent,
          borderRadius: tokens.radius.md,
        },
      ]}
    >
      <CrmText variant="caption" tone={tone === 'danger' ? 'danger' : 'textSecondary'}>
        {message}
      </CrmText>
    </View>
  )
}

function PrivacyCard() {
  const { tokens } = useTheme()
  return (
    <Card>
      <View style={styles.privacyRow}>
        <Badge label="آفلاین و محلی" tone="info" />
        <CrmText variant="caption" tone="textTertiary">
          بدون سینک
        </CrmText>
      </View>
      <CrmText variant="caption" tone="textSecondary" style={{ marginTop: tokens.spacing.sm }}>
        اطلاعات CRM فقط روی همین دستگاه نگهداری می‌شود. هیچ ارسال خودکاری به سرور، حساب کاربری یا
        سرویس دیگر انجام نمی‌شود.
      </CrmText>
    </Card>
  )
}

function SummaryStrip({ crm }: { crm: UseCrmResult }) {
  const openTasks = crm.tasks.filter((task) => !task.completed).length
  const metrics = [
    { label: 'مخاطب', value: crm.contacts.length },
    { label: 'کار باز', value: openTasks },
    { label: 'برچسب', value: crm.tags.length },
  ]
  return (
    <Card>
      <View style={styles.metrics}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metric}>
            <CrmText variant="title" tone="primary">
              {persianNumber(metric.value)}
            </CrmText>
            <CrmText variant="caption" tone="textTertiary">
              {metric.label}
            </CrmText>
          </View>
        ))}
      </View>
    </Card>
  )
}

function ChoiceChip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string
  selected: boolean
  onPress: () => void
  disabled?: boolean
}) {
  const { tokens } = useTheme()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choiceChip,
        {
          backgroundColor: selected ? tokens.color.primary : tokens.color.surfaceMuted,
          borderColor: selected ? tokens.color.primary : tokens.color.border,
          borderRadius: tokens.radius.full,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <CrmText variant="caption" tone={selected ? 'onPrimary' : 'textSecondary'}>
        {selected ? `✓ ${label}` : label}
      </CrmText>
    </Pressable>
  )
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  description?: string
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  const { tokens } = useTheme()
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[
        styles.toggleRow,
        {
          backgroundColor: tokens.color.surfaceMuted,
          borderColor: tokens.color.border,
          borderRadius: tokens.radius.md,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.toggleText}>
        <CrmText variant="body">{label}</CrmText>
        {description ? (
          <CrmText variant="caption" tone="textTertiary">
            {description}
          </CrmText>
        ) : null}
      </View>
      <View
        style={[
          styles.toggleTrack,
          {
            backgroundColor: value ? tokens.color.primary : tokens.color.borderStrong,
            borderRadius: tokens.radius.full,
          },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            {
              backgroundColor: value ? tokens.color.onPrimary : tokens.color.surface,
              borderRadius: tokens.radius.full,
              alignSelf: value ? 'flex-start' : 'flex-end',
            },
          ]}
        />
      </View>
    </Pressable>
  )
}

function MultilineField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  error?: string
  hint?: string
}) {
  const { tokens } = useTheme()
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <CrmText variant="caption" tone="textSecondary">
        {label}
      </CrmText>
      <TextInput
        accessibilityRole="text"
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.textTertiary}
        multiline
        textAlignVertical="top"
        style={[
          styles.multiline,
          {
            backgroundColor: tokens.color.surface,
            borderColor: error ? tokens.color.danger : tokens.color.border,
            borderRadius: tokens.radius.md,
            color: tokens.color.textPrimary,
            padding: tokens.spacing.sm,
            fontSize: tokens.typography.body.fontSize,
            lineHeight: tokens.typography.body.lineHeight,
          },
        ]}
      />
      {error ? (
        <CrmText variant="caption" tone="danger">
          {error}
        </CrmText>
      ) : null}
      {!error && hint ? (
        <CrmText variant="caption" tone="textTertiary">
          {hint}
        </CrmText>
      ) : null}
    </View>
  )
}

function FormActions({
  submitLabel,
  busy,
  disabled,
  onClose,
  onSubmit,
}: {
  submitLabel: string
  busy: boolean
  disabled?: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <View style={styles.formActions}>
      <Button
        label={submitLabel}
        onPress={onSubmit}
        loading={busy}
        disabled={disabled || busy}
        accessibilityLabel={submitLabel}
      />
      <Button
        label="انصراف"
        variant="secondary"
        onPress={onClose}
        disabled={busy}
        accessibilityLabel="بستن فرم"
      />
    </View>
  )
}

function LockGate({ crm }: { crm: UseCrmResult }) {
  const { tokens } = useTheme()
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSetup = crm.lockState === 'setup'

  if (crm.lockState === 'loading') {
    return (
      <Screen accessibilityLabel="در حال آماده‌سازی CRM" scroll>
        <Card>
          <View style={styles.loadingState}>
            <Skeleton width="55%" height={28} />
            <Skeleton width="100%" height={52} />
            <Skeleton width="100%" height={52} />
            <CrmText variant="caption" tone="textTertiary">
              در حال بررسی قفل محلی CRM…
            </CrmText>
          </View>
        </Card>
      </Screen>
    )
  }

  const submit = async () => {
    if (busy) return
    if (!/^\d{4,8}$/.test(pin)) {
      setError('PIN باید ۴ تا ۸ رقم باشد.')
      return
    }
    if (isSetup && pin !== confirmation) {
      setError('تکرار PIN با PIN اولیه یکسان نیست.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (isSetup) await crm.setPin(pin)
      else await crm.unlock(pin)
      setPin('')
      setConfirmation('')
    } catch {
      setError(isSetup ? 'ساخت PIN ناموفق بود. دوباره تلاش کنید.' : 'بازکردن CRM ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  const displayedError = error || crm.lockError

  return (
    <Screen accessibilityLabel={isSetup ? 'راه‌اندازی قفل CRM' : 'قفل CRM'} scroll>
      <View style={styles.lockPage}>
        <View
          style={[
            styles.lockMark,
            { backgroundColor: tokens.color.primary, borderRadius: tokens.radius.xl },
          ]}
        >
          <CrmText variant="display" tone="onPrimary">
            CRM
          </CrmText>
        </View>
        <CrmText variant="display">{isSetup ? 'فضای شخصی شما' : 'CRM قفل است'}</CrmText>
        <CrmText variant="body" tone="textSecondary" style={{ textAlign: 'center' }}>
          {isSetup
            ? 'برای محافظت از اطلاعات محلی، یک PIN انتخاب کنید.'
            : 'برای دیدن و تغییر مخاطبین، PIN خود را وارد کنید.'}
        </CrmText>
        <Card>
          <View style={styles.formStack}>
            <TextField
              label="PIN"
              value={pin}
              onChangeText={(value) => {
                setPin(normalizePin(value))
                setError(null)
              }}
              placeholder="۴ تا ۸ رقم"
              secureTextEntry
              keyboardType="numeric"
              accessibilityLabel="رمز PIN"
              hint="PIN جایی نمایش داده یا ثبت نمی‌شود."
            />
            {isSetup ? (
              <TextField
                label="تکرار PIN"
                value={confirmation}
                onChangeText={(value) => {
                  setConfirmation(normalizePin(value))
                  setError(null)
                }}
                placeholder="تکرار ۴ تا ۸ رقم"
                secureTextEntry
                keyboardType="numeric"
                accessibilityLabel="تکرار رمز PIN"
              />
            ) : null}
            {displayedError ? <Notice tone="danger" message={displayedError} /> : null}
            <Button
              label={isSetup ? 'ساخت PIN و ورود' : 'بازکردن CRM'}
              onPress={() => void submit()}
              loading={busy}
              disabled={busy || crm.loading}
              accessibilityLabel={isSetup ? 'ساخت PIN و ورود' : 'بازکردن CRM'}
            />
          </View>
        </Card>
        <PrivacyCard />
        <CrmText variant="caption" tone="textTertiary" style={{ textAlign: 'center' }}>
          {isSetup
            ? 'پس از ساخت PIN، داده‌ها فقط با بازکردن موفق این قفل در دسترس خواهند بود.'
            : 'برای بازیابی داده‌ها به یک پشتیبان رمزنگاری‌شده و PIN فعلی نیاز دارید.'}
        </CrmText>
      </View>
    </Screen>
  )
}

function ContactTags({ contact, tags }: { contact: CrmContact; tags: CrmTag[] }) {
  const selectedTags = contact.tag_ids
    .map((id) => tags.find((tag) => tag.local_id === id))
    .filter((tag): tag is CrmTag => Boolean(tag))
  if (selectedTags.length === 0) return null
  return (
    <View style={styles.badgeRow}>
      {selectedTags.map((tag) => (
        <Badge key={tag.local_id} label={tag.title} tone="primary" />
      ))}
    </View>
  )
}

function ContactFilters({
  search,
  onSearch,
  selectedTag,
  onTag,
  tags,
}: {
  search: string
  onSearch: (value: string) => void
  selectedTag: string
  onTag: (value: string) => void
  tags: CrmTag[]
}) {
  return (
    <View style={styles.filterStack}>
      <SearchBar
        value={search}
        onChangeText={onSearch}
        placeholder="جستجوی نام، تلفن، ایمیل یا برچسب..."
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <FilterChip label="همه برچسب‌ها" selected={!selectedTag} onPress={() => onTag('')} />
        {tags.map((tag) => (
          <FilterChip
            key={tag.local_id}
            label={tag.title}
            selected={selectedTag === tag.local_id}
            onPress={() => onTag(tag.local_id)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function ContactCard({
  contact,
  tags,
  disabled,
  onSelect,
  onEdit,
  onDelete,
}: {
  contact: CrmContact
  tags: CrmTag[]
  disabled: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <View style={styles.listItemStack}>
      <Card>
        <View style={styles.contactHeader}>
          <Avatar label={contact.display_name} />
          <View style={styles.contactHeaderText}>
            <CrmText variant="title" numberOfLines={2}>
              {contact.display_name}
            </CrmText>
            {contact.phone ? (
              <CrmText variant="caption" tone="textSecondary">
                تلفن: {contact.phone}
              </CrmText>
            ) : null}
            {contact.email ? (
              <CrmText variant="caption" tone="textSecondary" numberOfLines={2}>
                ایمیل: {contact.email}
              </CrmText>
            ) : null}
            {!contact.phone && !contact.email ? (
              <CrmText variant="caption" tone="textTertiary">
                شماره یا ایمیلی ثبت نشده
              </CrmText>
            ) : null}
          </View>
        </View>
        <ContactTags contact={contact} tags={tags} />
      </Card>
      <View style={styles.actionRow}>
        <Button
          label="جزئیات"
          size="sm"
          onPress={onSelect}
          accessibilityLabel={`جزئیات ${contact.display_name}`}
        />
        <Button
          label="ویرایش"
          size="sm"
          variant="secondary"
          onPress={onEdit}
          disabled={disabled}
          accessibilityLabel={`ویرایش ${contact.display_name}`}
        />
        <Button
          label="حذف"
          size="sm"
          variant="danger"
          onPress={onDelete}
          disabled={disabled}
          accessibilityLabel={`حذف ${contact.display_name}`}
        />
      </View>
    </View>
  )
}

function TaskCard({
  task,
  contactName,
  busy,
  disabled,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: CrmTask
  contactName: string | null
  busy: boolean
  disabled: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card>
      <View style={styles.cardTitleRow}>
        <CrmText variant="title" style={styles.flexText} numberOfLines={3}>
          {task.title}
        </CrmText>
        <Badge
          label={task.completed ? 'انجام‌شده' : 'در انتظار'}
          tone={task.completed ? 'success' : 'warning'}
        />
      </View>
      <View style={styles.metaStack}>
        <CrmText variant="caption" tone="textSecondary">
          مخاطب: {contactName || 'بدون مخاطب'}
        </CrmText>
        {task.due_at ? (
          <CrmText variant="caption" tone="textSecondary">
            موعد: {formatPersianDate(task.due_at)}
          </CrmText>
        ) : (
          <CrmText variant="caption" tone="textTertiary">
            بدون موعد
          </CrmText>
        )}
      </View>
      <View style={styles.actionRow}>
        <Button
          label={task.completed ? 'بازگردانی' : 'انجام شد'}
          size="sm"
          variant={task.completed ? 'secondary' : 'primary'}
          onPress={onToggle}
          loading={busy}
          disabled={disabled || busy}
          accessibilityLabel={
            task.completed ? `بازگردانی کار ${task.title}` : `انجام کار ${task.title}`
          }
        />
        <Button
          label="ویرایش"
          size="sm"
          variant="secondary"
          onPress={onEdit}
          disabled={disabled}
          accessibilityLabel={`ویرایش کار ${task.title}`}
        />
        <Button
          label="حذف"
          size="sm"
          variant="danger"
          onPress={onDelete}
          disabled={disabled}
          accessibilityLabel={`حذف کار ${task.title}`}
        />
      </View>
    </Card>
  )
}

function ContactDetail({
  contact,
  crm,
  tab,
  onTab,
  onBack,
  onEditContact,
  onDeleteContact,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
  pendingTaskId,
  onAddInteraction,
  onEditInteraction,
  onDeleteInteraction,
}: {
  contact?: CrmContact
  crm: UseCrmResult
  tab: ContactDetailTab
  onTab: (tab: ContactDetailTab) => void
  onBack: () => void
  onEditContact: () => void
  onDeleteContact: () => void
  onAddNote: () => void
  onEditNote: (note: CrmNote) => void
  onDeleteNote: (note: CrmNote) => void
  onAddTask: () => void
  onEditTask: (task: CrmTask) => void
  onDeleteTask: (task: CrmTask) => void
  onToggleTask: (task: CrmTask) => void
  pendingTaskId: string | null
  onAddInteraction: () => void
  onEditInteraction: (interaction: CrmInteraction) => void
  onDeleteInteraction: (interaction: CrmInteraction) => void
}) {
  if (!contact) {
    return (
      <EmptyState
        title="مخاطبی انتخاب نشده است"
        description="برای مدیریت یادداشت‌ها، کارها و تعامل‌ها، یک مخاطب را از فهرست انتخاب کنید."
      />
    )
  }

  const notes = crm.notes.filter((note) => note.contact_id === contact.local_id)
  const tasks = crm.tasks.filter((task) => task.contact_id === contact.local_id)
  const interactions = crm.interactions.filter(
    (interaction) => interaction.contact_id === contact.local_id,
  )

  return (
    <View style={styles.contentStack}>
      <Button label="بازگشت به مخاطبین" variant="secondary" onPress={onBack} />
      <Card>
        <View style={styles.contactHeader}>
          <Avatar label={contact.display_name} size="lg" />
          <View style={styles.contactHeaderText}>
            <CrmText variant="title">{contact.display_name}</CrmText>
            <CrmText variant="caption" tone="textSecondary">
              {contact.phone || 'بدون تلفن'} · {contact.email || 'بدون ایمیل'}
            </CrmText>
          </View>
        </View>
        <ContactTags contact={contact} tags={crm.tags} />
        <View style={styles.actionRow}>
          <Button
            label="ویرایش مخاطب"
            size="sm"
            variant="secondary"
            onPress={onEditContact}
            disabled={crm.loading}
          />
          <Button
            label="حذف مخاطب"
            size="sm"
            variant="danger"
            onPress={onDeleteContact}
            disabled={crm.loading}
          />
        </View>
      </Card>

      <Tabs<ContactDetailTab>
        items={[
          { value: 'notes', label: 'یادداشت‌ها', badge: notes.length },
          { value: 'tasks', label: 'کارها', badge: tasks.length },
          { value: 'interactions', label: 'تعامل‌ها', badge: interactions.length },
        ]}
        value={tab}
        onChange={onTab}
      />

      {tab === 'notes' ? (
        <View style={styles.contentStack}>
          <SectionHeading
            title="یادداشت‌ها"
            action={
              <Button label="یادداشت جدید" size="sm" onPress={onAddNote} disabled={crm.loading} />
            }
          />
          {notes.length === 0 ? (
            <EmptyState
              title="یادداشتی ثبت نشده"
              description="جزئیات مهم این مخاطب را یادداشت کنید."
              actionLabel={!crm.loading ? 'ثبت یادداشت' : undefined}
              onAction={!crm.loading ? onAddNote : undefined}
            />
          ) : (
            notes.map((note) => (
              <Card key={note.local_id}>
                <CrmText variant="body">{note.body}</CrmText>
                <CrmText variant="caption" tone="textTertiary">
                  ثبت: {formatPersianDateTime(note.created_at)}
                </CrmText>
                <View style={styles.actionRow}>
                  <Button
                    label="ویرایش"
                    size="sm"
                    variant="secondary"
                    onPress={() => onEditNote(note)}
                    disabled={crm.loading}
                    accessibilityLabel="ویرایش یادداشت"
                  />
                  <Button
                    label="حذف"
                    size="sm"
                    variant="danger"
                    onPress={() => onDeleteNote(note)}
                    disabled={crm.loading}
                    accessibilityLabel="حذف یادداشت"
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      ) : null}

      {tab === 'tasks' ? (
        <View style={styles.contentStack}>
          <SectionHeading
            title="کارهای مخاطب"
            action={
              <Button label="کار جدید" size="sm" onPress={onAddTask} disabled={crm.loading} />
            }
          />
          {tasks.length === 0 ? (
            <EmptyState
              title="کاری برای این مخاطب نیست"
              description="یک پیگیری یا کار جدید بسازید."
              actionLabel={!crm.loading ? 'ساخت کار' : undefined}
              onAction={!crm.loading ? onAddTask : undefined}
            />
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.local_id}
                task={task}
                contactName={contact.display_name}
                busy={pendingTaskId === task.local_id}
                disabled={crm.loading}
                onToggle={() => onToggleTask(task)}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task)}
              />
            ))
          )}
        </View>
      ) : null}

      {tab === 'interactions' ? (
        <View style={styles.contentStack}>
          <SectionHeading
            title="تعامل‌ها"
            action={
              <Button
                label="تعامل جدید"
                size="sm"
                onPress={onAddInteraction}
                disabled={crm.loading}
              />
            }
          />
          {interactions.length === 0 ? (
            <EmptyState
              title="تعاملی ثبت نشده"
              description="تماس، پیام یا جلسه این مخاطب را ثبت کنید."
              actionLabel={!crm.loading ? 'ثبت تعامل' : undefined}
              onAction={!crm.loading ? onAddInteraction : undefined}
            />
          ) : (
            interactions.map((interaction) => {
              const kind = INTERACTION_KINDS.find((item) => item.value === interaction.kind)
              return (
                <Card key={interaction.local_id}>
                  <View style={styles.cardTitleRow}>
                    <Badge label={kind?.label || 'سایر'} tone="info" />
                    <CrmText variant="caption" tone="textTertiary">
                      {formatPersianDateTime(interaction.occurred_at)}
                    </CrmText>
                  </View>
                  <CrmText variant="body">{interaction.summary}</CrmText>
                  <View style={styles.actionRow}>
                    <Button
                      label="ویرایش"
                      size="sm"
                      variant="secondary"
                      onPress={() => onEditInteraction(interaction)}
                      disabled={crm.loading}
                      accessibilityLabel="ویرایش تعامل"
                    />
                    <Button
                      label="حذف"
                      size="sm"
                      variant="danger"
                      onPress={() => onDeleteInteraction(interaction)}
                      disabled={crm.loading}
                      accessibilityLabel="حذف تعامل"
                    />
                  </View>
                </Card>
              )
            })
          )}
        </View>
      ) : null}
    </View>
  )
}

function ContactEditor({
  contact,
  tags,
  crm,
  onClose,
  onSaved,
}: {
  contact: CrmContact | null
  tags: CrmTag[]
  crm: UseCrmResult
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [displayName, setDisplayName] = useState(contact?.display_name || '')
  const [phone, setPhone] = useState(contact?.phone || '')
  const [email, setEmail] = useState(contact?.email || '')
  const [tagIds, setTagIds] = useState<string[]>(contact?.tag_ids || [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameError = !displayName.trim() ? 'نام نمایشی را وارد کنید.' : undefined
  const invalidEmail = emailError(email.trim())

  const submit = async () => {
    if (busy) return
    if (nameError || invalidEmail) {
      setError('لطفاً خطاهای فرم را برطرف کنید.')
      return
    }
    const input: CrmContactInput = {
      display_name: displayName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      tag_ids: tagIds,
    }
    setBusy(true)
    setError(null)
    try {
      if (contact) await crm.updateContact(contact.local_id, input)
      else await crm.createContact(input)
      setBusy(false)
      onSaved(contact ? 'مخاطب به‌روزرسانی شد.' : 'مخاطب جدید ساخته شد.')
    } catch {
      setBusy(false)
      setError('ذخیره مخاطب ناموفق بود. دوباره تلاش کنید.')
    }
  }

  const close = () => {
    if (!busy) onClose()
  }
  const toggleTag = (id: string) => {
    setTagIds((current) =>
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id],
    )
  }

  return (
    <BottomSheet visible onClose={close} title={contact ? 'ویرایش مخاطب' : 'مخاطب جدید'}>
      <View style={styles.formStack}>
        <TextField
          label="نام نمایشی"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="نام مخاطب"
          error={nameError}
          accessibilityLabel="نام نمایشی مخاطب"
        />
        <TextField
          label="تلفن (اختیاری)"
          value={phone}
          onChangeText={setPhone}
          placeholder="شماره تماس"
          keyboardType="phone-pad"
          accessibilityLabel="تلفن مخاطب"
        />
        <TextField
          label="ایمیل (اختیاری)"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
          error={invalidEmail}
          accessibilityLabel="ایمیل مخاطب"
        />
        <View style={styles.fieldStack}>
          <CrmText variant="caption" tone="textSecondary">
            برچسب‌ها
          </CrmText>
          {tags.length === 0 ? (
            <CrmText variant="caption" tone="textTertiary">
              برچسبی وجود ندارد؛ از تب برچسب‌ها می‌توانید بسازید.
            </CrmText>
          ) : (
            <View style={styles.choiceRow}>
              {tags.map((tag) => (
                <ChoiceChip
                  key={tag.local_id}
                  label={tag.title}
                  selected={tagIds.includes(tag.local_id)}
                  onPress={() => toggleTag(tag.local_id)}
                  disabled={busy}
                />
              ))}
            </View>
          )}
        </View>
        {error ? <Notice tone="danger" message={error} /> : null}
        <FormActions
          submitLabel={contact ? 'ذخیره تغییرات' : 'ساخت مخاطب'}
          busy={busy}
          onClose={close}
          onSubmit={() => void submit()}
        />
      </View>
    </BottomSheet>
  )
}

function TagEditor({
  tag,
  crm,
  onClose,
  onSaved,
}: {
  tag: CrmTag | null
  crm: UseCrmResult
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [title, setTitle] = useState(tag?.title || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleError = !title.trim() ? 'عنوان برچسب را وارد کنید.' : undefined

  const submit = async () => {
    if (busy) return
    if (titleError) {
      setError('لطفاً عنوان برچسب را وارد کنید.')
      return
    }
    const input: CrmTagInput = { title: title.trim() }
    setBusy(true)
    setError(null)
    try {
      if (tag) await crm.updateTag(tag.local_id, { ...input, color: tag.color })
      else await crm.createTag(input)
      setBusy(false)
      onSaved(tag ? 'برچسب به‌روزرسانی شد.' : 'برچسب جدید ساخته شد.')
    } catch {
      setBusy(false)
      setError('ذخیره برچسب ناموفق بود. دوباره تلاش کنید.')
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <BottomSheet visible onClose={close} title={tag ? 'ویرایش برچسب' : 'برچسب جدید'}>
      <View style={styles.formStack}>
        <TextField
          label="عنوان برچسب"
          value={title}
          onChangeText={setTitle}
          placeholder="مثلاً مشتری مهم"
          error={titleError}
          accessibilityLabel="عنوان برچسب"
        />
        <CrmText variant="caption" tone="textTertiary">
          رنگ برچسب با ظاهر برنامه هماهنگ می‌ماند.
        </CrmText>
        {error ? <Notice tone="danger" message={error} /> : null}
        <FormActions
          submitLabel={tag ? 'ذخیره تغییرات' : 'ساخت برچسب'}
          busy={busy}
          onClose={close}
          onSubmit={() => void submit()}
        />
      </View>
    </BottomSheet>
  )
}

function NoteEditor({
  note,
  contactId,
  crm,
  onClose,
  onSaved,
}: {
  note: CrmNote | null
  contactId: string
  crm: UseCrmResult
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [body, setBody] = useState(note?.body || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyError = !body.trim() ? 'متن یادداشت را وارد کنید.' : undefined

  const submit = async () => {
    if (busy) return
    if (bodyError) {
      setError('متن یادداشت نمی‌تواند خالی باشد.')
      return
    }
    const input: CrmNoteInput = { contact_id: contactId, body: body.trim() }
    setBusy(true)
    setError(null)
    try {
      if (note) await crm.updateNote(note.local_id, input)
      else await crm.createNote(input)
      setBusy(false)
      onSaved(note ? 'یادداشت به‌روزرسانی شد.' : 'یادداشت ثبت شد.')
    } catch {
      setBusy(false)
      setError('ذخیره یادداشت ناموفق بود. دوباره تلاش کنید.')
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <BottomSheet visible onClose={close} title={note ? 'ویرایش یادداشت' : 'یادداشت جدید'}>
      <View style={styles.formStack}>
        <MultilineField
          label="متن یادداشت"
          value={body}
          onChangeText={setBody}
          placeholder="جزئیات، توافقات یا نکات مهم..."
          error={bodyError}
        />
        {error ? <Notice tone="danger" message={error} /> : null}
        <FormActions
          submitLabel={note ? 'ذخیره تغییرات' : 'ثبت یادداشت'}
          busy={busy}
          onClose={close}
          onSubmit={() => void submit()}
        />
      </View>
    </BottomSheet>
  )
}

function TaskEditor({
  task,
  contactId,
  lockContact,
  contacts,
  crm,
  onClose,
  onSaved,
}: {
  task: CrmTask | null
  contactId: string | null
  lockContact: boolean
  contacts: CrmContact[]
  crm: UseCrmResult
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [title, setTitle] = useState(task?.title || '')
  const [selectedContact, setSelectedContact] = useState(task?.contact_id ?? contactId ?? '')
  const [dueAt, setDueAt] = useState(task?.due_at?.slice(0, 10) || '')
  const [completed, setCompleted] = useState(task?.completed || false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleError = !title.trim() ? 'عنوان کار را وارد کنید.' : undefined
  const invalidDate = dateError(dueAt.trim())
  const linkedContact = contacts.find(
    (contact) => contact.local_id === (contactId || selectedContact),
  )

  const submit = async () => {
    if (busy) return
    if (titleError || invalidDate) {
      setError('لطفاً خطاهای فرم را برطرف کنید.')
      return
    }
    const input: CrmTaskInput = {
      contact_id: lockContact ? contactId : selectedContact || null,
      title: title.trim(),
      due_at: dueAt.trim() ? new Date(`${dueAt.trim()}T00:00:00.000Z`).toISOString() : null,
      completed,
    }
    setBusy(true)
    setError(null)
    try {
      if (task) await crm.updateTask(task.local_id, input)
      else await crm.createTask(input)
      setBusy(false)
      onSaved(task ? 'کار به‌روزرسانی شد.' : 'کار جدید ساخته شد.')
    } catch {
      setBusy(false)
      setError('ذخیره کار ناموفق بود. دوباره تلاش کنید.')
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <BottomSheet visible onClose={close} title={task ? 'ویرایش کار' : 'کار جدید'}>
      <View style={styles.formStack}>
        <TextField
          label="عنوان کار"
          value={title}
          onChangeText={setTitle}
          placeholder="کاری که باید انجام شود"
          error={titleError}
          accessibilityLabel="عنوان کار"
        />
        {lockContact ? (
          <Card>
            <CrmText variant="caption" tone="textSecondary">
              مخاطب مرتبط
            </CrmText>
            <CrmText variant="body">{linkedContact?.display_name || 'مخاطب انتخاب‌شده'}</CrmText>
          </Card>
        ) : (
          <Select
            label="مخاطب مرتبط (اختیاری)"
            value={selectedContact}
            options={[
              { value: '', label: 'بدون مخاطب' },
              ...contacts.map((contact) => ({
                value: contact.local_id,
                label: contact.display_name,
              })),
            ]}
            placeholder="بدون مخاطب"
            onChange={setSelectedContact}
          />
        )}
        <TextField
          label="موعد (اختیاری)"
          value={dueAt}
          onChangeText={setDueAt}
          placeholder="YYYY-MM-DD"
          error={invalidDate}
          hint="خالی بگذارید تا موعدی ثبت نشود."
          accessibilityLabel="موعد کار"
        />
        <ToggleRow
          label="انجام شد"
          description="وضعیت تکمیل این کار"
          value={completed}
          onChange={setCompleted}
          disabled={busy}
        />
        {error ? <Notice tone="danger" message={error} /> : null}
        <FormActions
          submitLabel={task ? 'ذخیره تغییرات' : 'ساخت کار'}
          busy={busy}
          onClose={close}
          onSubmit={() => void submit()}
        />
      </View>
    </BottomSheet>
  )
}

function InteractionEditor({
  interaction,
  contactId,
  crm,
  onClose,
  onSaved,
}: {
  interaction: CrmInteraction | null
  contactId: string
  crm: UseCrmResult
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [kind, setKind] = useState<CrmInteractionKind>(interaction?.kind || 'call')
  const [summary, setSummary] = useState(interaction?.summary || '')
  const [occurredAt, setOccurredAt] = useState(toDateTimeInput(interaction?.occurred_at))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const summaryError = !summary.trim() ? 'خلاصه تعامل را وارد کنید.' : undefined
  const invalidDate = dateTimeError(occurredAt.trim())

  const submit = async () => {
    if (busy) return
    if (summaryError || invalidDate) {
      setError('لطفاً خطاهای فرم را برطرف کنید.')
      return
    }
    const input: CrmInteractionInput = {
      contact_id: contactId,
      kind,
      summary: summary.trim(),
      ...(occurredAt.trim() ? { occurred_at: new Date(occurredAt.trim()).toISOString() } : {}),
    }
    setBusy(true)
    setError(null)
    try {
      if (interaction) await crm.updateInteraction(interaction.local_id, input)
      else await crm.createInteraction(input)
      setBusy(false)
      onSaved(interaction ? 'تعامل به‌روزرسانی شد.' : 'تعامل ثبت شد.')
    } catch {
      setBusy(false)
      setError('ذخیره تعامل ناموفق بود. دوباره تلاش کنید.')
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <BottomSheet visible onClose={close} title={interaction ? 'ویرایش تعامل' : 'تعامل جدید'}>
      <View style={styles.formStack}>
        <Select
          label="نوع تعامل"
          value={kind}
          options={INTERACTION_KINDS}
          onChange={(value) => setKind(value as CrmInteractionKind)}
        />
        <MultilineField
          label="خلاصه تعامل"
          value={summary}
          onChangeText={setSummary}
          placeholder="موضوع و نتیجه تعامل..."
          error={summaryError}
        />
        <TextField
          label="زمان برخورد (اختیاری)"
          value={occurredAt}
          onChangeText={setOccurredAt}
          placeholder="YYYY-MM-DDTHH:mm"
          error={invalidDate}
          hint={
            interaction
              ? 'خالی بگذارید تا زمان فعلی حفظ شود.'
              : 'خالی بگذارید تا زمان ثبت استفاده شود.'
          }
          accessibilityLabel="زمان برخورد"
        />
        {error ? <Notice tone="danger" message={error} /> : null}
        <FormActions
          submitLabel={interaction ? 'ذخیره تغییرات' : 'ثبت تعامل'}
          busy={busy}
          onClose={close}
          onSubmit={() => void submit()}
        />
      </View>
    </BottomSheet>
  )
}

function EditorSheet({
  editor,
  crm,
  onClose,
  onSaved,
}: {
  editor: CrmEditor
  crm: UseCrmResult
  onClose: () => void
  onSaved: (message: string) => void
}) {
  if (editor.kind === 'contact') {
    return (
      <ContactEditor
        key={editor.contact?.local_id || 'new-contact'}
        contact={editor.contact}
        tags={crm.tags}
        crm={crm}
        onClose={onClose}
        onSaved={onSaved}
      />
    )
  }
  if (editor.kind === 'tag') {
    return (
      <TagEditor
        key={editor.tag?.local_id || 'new-tag'}
        tag={editor.tag}
        crm={crm}
        onClose={onClose}
        onSaved={onSaved}
      />
    )
  }
  if (editor.kind === 'note') {
    return (
      <NoteEditor
        key={editor.note?.local_id || 'new-note'}
        note={editor.note}
        contactId={editor.contactId}
        crm={crm}
        onClose={onClose}
        onSaved={onSaved}
      />
    )
  }
  if (editor.kind === 'task') {
    return (
      <TaskEditor
        key={editor.task?.local_id || `new-task-${editor.contactId || 'none'}`}
        task={editor.task}
        contactId={editor.contactId}
        lockContact={editor.lockContact}
        contacts={crm.contacts}
        crm={crm}
        onClose={onClose}
        onSaved={onSaved}
      />
    )
  }
  return (
    <InteractionEditor
      key={editor.interaction?.local_id || 'new-interaction'}
      interaction={editor.interaction}
      contactId={editor.contactId}
      crm={crm}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function BackupMenu({
  visible,
  onClose,
  onExport,
  onImport,
}: {
  visible: boolean
  onClose: () => void
  onExport: () => void
  onImport: () => void
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="پشتیبان امن">
      <View style={styles.formStack}>
        <Notice message="پشتیبان‌ها با PIN فعلی رمزنگاری می‌شوند. محتوای داده‌ها یا متن رمزنگاری‌شده در این صفحه نمایش داده نمی‌شود." />
        <Button label="دریافت پشتیبان رمزنگاری‌شده" onPress={onExport} />
        <Button label="بازیابی از پشتیبان" variant="secondary" onPress={onImport} />
        <CrmText variant="caption" tone="textTertiary">
          اشتراک‌گذاری فایل تنها با اقدام شما انجام می‌شود.
        </CrmText>
      </View>
    </BottomSheet>
  )
}

function ExportDataSheet({
  crm,
  onShareBackup,
  onClose,
}: {
  crm: UseCrmResult
  onShareBackup: (payload: string) => Promise<void> | void
  onClose: () => void
}) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    if (busy) return
    if (!/^\d{4,8}$/.test(pin)) {
      setError('برای دریافت پشتیبان، PIN فعلی ۴ تا ۸ رقم را وارد کنید.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = await crm.exportBackup(pin)
      await onShareBackup(payload)
      setPin('')
      setSuccess(true)
    } catch {
      setError('تهیه یا تحویل پشتیبان ناموفق بود. PIN را بررسی و دوباره تلاش کنید.')
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <BottomSheet visible onClose={close} title="دریافت پشتیبان امن">
      <View style={styles.formStack}>
        {success ? (
          <>
            <Notice
              tone="success"
              message="فایل رمزنگاری‌شده برای اشتراک‌گذاری آماده شد. متن فایل در این صفحه نمایش داده نمی‌شود."
            />
            <Button label="انجام شد" onPress={close} />
          </>
        ) : (
          <>
            <Notice message="پشتیبان شامل داده‌های محلی شماست. آن را در جای امن نگهداری کنید و PIN را جداگانه به خاطر بسپارید." />
            <TextField
              label="PIN فعلی"
              value={pin}
              onChangeText={(value) => {
                setPin(normalizePin(value))
                setError(null)
              }}
              placeholder="۴ تا ۸ رقم"
              secureTextEntry
              keyboardType="numeric"
              accessibilityLabel="PIN فعلی برای دریافت پشتیبان"
              hint="PIN فقط برای رمزنگاری محلی استفاده می‌شود."
            />
            {error ? <Notice tone="danger" message={error} /> : null}
            <FormActions
              submitLabel="رمزنگاری و اشتراک‌گذاری"
              busy={busy}
              onClose={close}
              onSubmit={() => void submit()}
            />
          </>
        )}
      </View>
    </BottomSheet>
  )
}

function ImportDataSheet({
  crm,
  onPickBackup,
  onClose,
}: {
  crm: UseCrmResult
  onPickBackup: () => Promise<string | null>
  onClose: () => void
}) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    if (busy) return
    if (!/^\d{4,8}$/.test(pin)) {
      setError('برای بازیابی، PIN فعلی ۴ تا ۸ رقم را وارد کنید.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = await onPickBackup()
      if (!payload) {
        setError('فایل پشتیبانی انتخاب نشد.')
        return
      }
      await crm.importBackup(payload, pin)
      setPin('')
      setSuccess(true)
    } catch {
      setError(
        'بازیابی پشتیبان ناموفق بود. PIN، فایل و متعلق بودن پشتیبان به این فضای CRM را بررسی کنید.',
      )
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <BottomSheet visible onClose={close} title="بازیابی پشتیبان">
      <View style={styles.formStack}>
        {success ? (
          <>
            <Notice
              tone="success"
              message="بازیابی انجام شد و رکوردهای پشتیبان به داده‌های محلی اضافه شدند."
            />
            <Button label="انجام شد" onPress={close} />
          </>
        ) : (
          <>
            <Notice
              tone="warning"
              message="توجه: رکوردهای پشتیبان به داده‌های فعلی این مالک اضافه می‌شوند و داده‌های موجود حذف نمی‌شوند. اگر شناسه رکوردی تکراری باشد، بازیابی رد می‌شود."
            />
            <TextField
              label="PIN فعلی"
              value={pin}
              onChangeText={(value) => {
                setPin(normalizePin(value))
                setError(null)
              }}
              placeholder="۴ تا ۸ رقم"
              secureTextEntry
              keyboardType="numeric"
              accessibilityLabel="PIN فعلی برای بازیابی پشتیبان"
              hint="پس از تأیید PIN، انتخاب‌گر فایل باز می‌شود."
            />
            {error ? <Notice tone="danger" message={error} /> : null}
            <FormActions
              submitLabel="انتخاب فایل و بازیابی"
              busy={busy}
              onClose={close}
              onSubmit={() => void submit()}
            />
          </>
        )}
      </View>
    </BottomSheet>
  )
}

function deleteMessage(target: DeleteTarget) {
  if (target.kind === 'contact') {
    return `مخاطب «${target.item.display_name}» و همه یادداشت‌ها، کارها و تعامل‌های مرتبط حذف می‌شوند.`
  }
  if (target.kind === 'tag') return `برچسب «${target.item.title}» از همه مخاطبین حذف می‌شود.`
  if (target.kind === 'note') return 'این یادداشت برای همیشه حذف می‌شود.'
  if (target.kind === 'task') return `کار «${target.item.title}» حذف می‌شود.`
  return 'این تعامل حذف می‌شود.'
}

function deleteTitle(target: DeleteTarget) {
  return {
    contact: 'حذف مخاطب',
    tag: 'حذف برچسب',
    note: 'حذف یادداشت',
    task: 'حذف کار',
    interaction: 'حذف تعامل',
  }[target.kind]
}

function UnlockedCrmWorkspace({ crm, onShareBackup, onPickBackup }: CrmWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>('contacts')
  const [detailTab, setDetailTab] = useState<ContactDetailTab>('notes')
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [taskSearch, setTaskSearch] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [editor, setEditor] = useState<CrmEditor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
  const [backupMode, setBackupMode] = useState<'menu' | 'export' | 'import' | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const activeSelectedTag = crm.tags.some((tag) => tag.local_id === selectedTag) ? selectedTag : ''
  const selectedContact = crm.contacts.find((contact) => contact.local_id === selectedContactId)
  const filteredContacts = useMemo(() => {
    const query = normalizeSearch(search)
    return crm.contacts.filter((contact) => {
      if (activeSelectedTag && !contact.tag_ids.includes(activeSelectedTag)) return false
      if (!query) return true
      const tagTitles = contact.tag_ids
        .map((id) => crm.tags.find((tag) => tag.local_id === id)?.title || '')
        .join(' ')
      return normalizeSearch(
        `${contact.display_name} ${contact.phone || ''} ${contact.email || ''} ${tagTitles}`,
      ).includes(query)
    })
  }, [activeSelectedTag, crm.contacts, crm.tags, search])

  const filteredTasks = useMemo(() => {
    const query = normalizeSearch(taskSearch)
    return crm.tasks.filter((task) => {
      if (taskFilter === 'open' && task.completed) return false
      if (taskFilter === 'completed' && !task.completed) return false
      if (!query) return true
      const contact = crm.contacts.find((item) => item.local_id === task.contact_id)
      return normalizeSearch(`${task.title} ${contact?.display_name || ''}`).includes(query)
    })
  }, [crm.contacts, crm.tasks, taskFilter, taskSearch])

  const saved = (message: string) => {
    setEditor(null)
    setToast({ message, tone: 'success' })
  }

  const refresh = async () => {
    if (crm.loading || pendingTaskId) return
    try {
      await crm.refresh()
    } catch {
      setToast({ message: 'به‌روزرسانی داده‌های محلی ناموفق بود.', tone: 'error' })
    }
  }

  const lockNow = () => {
    if (crm.loading || pendingTaskId) return
    setEditor(null)
    setDeleteTarget(null)
    setBackupMode(null)
    setToast(null)
    crm.lock()
  }

  const toggleTask = async (task: CrmTask) => {
    if (crm.loading || pendingTaskId) return
    setPendingTaskId(task.local_id)
    try {
      await crm.updateTask(task.local_id, {
        contact_id: task.contact_id,
        title: task.title,
        due_at: task.due_at,
        completed: !task.completed,
      })
      setToast({
        message: task.completed ? 'کار به وضعیت در انتظار بازگشت.' : 'کار انجام شد.',
        tone: 'success',
      })
    } catch {
      setToast({ message: 'تغییر وضعیت کار ناموفق بود.', tone: 'error' })
    } finally {
      setPendingTaskId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    const target = deleteTarget
    setDeleting(true)
    try {
      if (target.kind === 'contact') await crm.deleteContact(target.item.local_id)
      else if (target.kind === 'tag') await crm.deleteTag(target.item.local_id)
      else if (target.kind === 'note') await crm.deleteNote(target.item.local_id)
      else if (target.kind === 'task') await crm.deleteTask(target.item.local_id)
      else await crm.deleteInteraction(target.item.local_id)
      if (target.kind === 'contact') {
        setSelectedContactId((current) => (current === target.item.local_id ? null : current))
      }
      setDeleting(false)
      setDeleteTarget(null)
      setToast({ message: 'مورد انتخاب‌شده حذف شد.', tone: 'success' })
    } catch {
      setDeleting(false)
      setDeleteTarget(null)
      setToast({ message: 'حذف مورد ناموفق بود. دوباره تلاش کنید.', tone: 'error' })
    }
  }

  return (
    <Screen accessibilityLabel="CRM محلی و آفلاین" scroll>
      <View style={styles.workspace}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View style={styles.heroHeaderText}>
              <CrmText variant="display">CRM شخصی</CrmText>
              <CrmText variant="caption" tone="textSecondary">
                مخاطبین و پیگیری‌ها، تنها روی دستگاه شما
              </CrmText>
            </View>
            <Badge label="محلی و آفلاین" tone="info" />
          </View>
          <View style={styles.actionRow}>
            <Button
              label="قفل کردن"
              size="sm"
              variant="secondary"
              onPress={lockNow}
              disabled={crm.loading || deleting || pendingTaskId !== null}
              accessibilityLabel="قفل کردن CRM"
            />
            <Button
              label="پشتیبان امن"
              size="sm"
              onPress={() => setBackupMode('menu')}
              disabled={crm.loading || deleting || pendingTaskId !== null}
              accessibilityLabel="پشتیبان امن CRM"
            />
            <Button
              label="به‌روزرسانی"
              size="sm"
              variant="ghost"
              onPress={() => void refresh()}
              loading={crm.loading}
              disabled={deleting || pendingTaskId !== null}
              accessibilityLabel="به‌روزرسانی داده‌های محلی CRM"
            />
          </View>
          <PrivacyCard />
        </View>

        {crm.dataError ? <Notice tone="danger" message={crm.dataError} /> : null}
        {crm.loading ? <Notice message="در حال بارگذاری یا ذخیرهٔ داده‌های محلی…" /> : null}
        <SummaryStrip crm={crm} />

        <Tabs<WorkspaceTab>
          items={[
            { value: 'contacts', label: 'مخاطبین', badge: crm.contacts.length },
            { value: 'tasks', label: 'کارها', badge: crm.tasks.length },
            { value: 'tags', label: 'برچسب‌ها', badge: crm.tags.length },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'contacts' ? (
          selectedContact ? (
            <ContactDetail
              contact={selectedContact}
              crm={crm}
              tab={detailTab}
              onTab={setDetailTab}
              onBack={() => setSelectedContactId(null)}
              onEditContact={() => setEditor({ kind: 'contact', contact: selectedContact })}
              onDeleteContact={() => setDeleteTarget({ kind: 'contact', item: selectedContact })}
              onAddNote={() =>
                setEditor({ kind: 'note', note: null, contactId: selectedContact.local_id })
              }
              onEditNote={(note) =>
                setEditor({ kind: 'note', note, contactId: selectedContact.local_id })
              }
              onDeleteNote={(note) => setDeleteTarget({ kind: 'note', item: note })}
              onAddTask={() =>
                setEditor({
                  kind: 'task',
                  task: null,
                  contactId: selectedContact.local_id,
                  lockContact: true,
                })
              }
              onEditTask={(task) =>
                setEditor({
                  kind: 'task',
                  task,
                  contactId: selectedContact.local_id,
                  lockContact: true,
                })
              }
              onDeleteTask={(task) => setDeleteTarget({ kind: 'task', item: task })}
              onToggleTask={(task) => void toggleTask(task)}
              pendingTaskId={pendingTaskId}
              onAddInteraction={() =>
                setEditor({
                  kind: 'interaction',
                  interaction: null,
                  contactId: selectedContact.local_id,
                })
              }
              onEditInteraction={(interaction) =>
                setEditor({ kind: 'interaction', interaction, contactId: selectedContact.local_id })
              }
              onDeleteInteraction={(interaction) =>
                setDeleteTarget({ kind: 'interaction', item: interaction })
              }
            />
          ) : (
            <View style={styles.contentStack}>
              <ContactFilters
                search={search}
                onSearch={setSearch}
                selectedTag={activeSelectedTag}
                onTag={setSelectedTag}
                tags={crm.tags}
              />
              <SectionHeading
                title="مخاطبین"
                caption={`${persianNumber(filteredContacts.length)} مخاطب نمایش داده می‌شود`}
                action={
                  <Button
                    label="مخاطب جدید"
                    size="sm"
                    onPress={() => setEditor({ kind: 'contact', contact: null })}
                    disabled={crm.loading}
                  />
                }
              />
              {filteredContacts.length === 0 ? (
                <EmptyState
                  title={crm.contacts.length === 0 ? 'هنوز مخاطبی ندارید' : 'مخاطبی پیدا نشد'}
                  description={
                    crm.contacts.length === 0
                      ? 'اولین مخاطب را بسازید و پیگیری‌ها را محلی نگه دارید.'
                      : 'عبارت جستجو یا برچسب انتخاب‌شده را تغییر دهید.'
                  }
                  actionLabel={crm.contacts.length === 0 && !crm.loading ? 'ساخت مخاطب' : undefined}
                  onAction={
                    crm.contacts.length === 0 && !crm.loading
                      ? () => setEditor({ kind: 'contact', contact: null })
                      : undefined
                  }
                />
              ) : (
                <>
                  <View style={styles.contentStack} accessibilityLabel="فهرست مخاطبین">
                    {filteredContacts.map((contact) => (
                      <ContactCard
                        key={contact.local_id}
                        contact={contact}
                        tags={crm.tags}
                        disabled={crm.loading}
                        onSelect={() => {
                          setSelectedContactId(contact.local_id)
                          setDetailTab('notes')
                        }}
                        onEdit={() => setEditor({ kind: 'contact', contact })}
                        onDelete={() => setDeleteTarget({ kind: 'contact', item: contact })}
                      />
                    ))}
                  </View>
                  <EmptyState
                    title="مخاطبی انتخاب نشده است"
                    description="یک مخاطب را انتخاب کنید تا یادداشت‌ها، کارها و تعامل‌های او را مدیریت کنید."
                  />
                </>
              )}
            </View>
          )
        ) : null}

        {tab === 'tasks' ? (
          <View style={styles.contentStack}>
            <SectionHeading
              title="همه کارها"
              caption={`${persianNumber(filteredTasks.length)} کار نمایش داده می‌شود`}
              action={
                <Button
                  label="کار جدید"
                  size="sm"
                  onPress={() =>
                    setEditor({ kind: 'task', task: null, contactId: null, lockContact: false })
                  }
                  disabled={crm.loading}
                />
              }
            />
            <SearchBar
              value={taskSearch}
              onChangeText={setTaskSearch}
              placeholder="جستجوی عنوان کار یا مخاطب..."
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {TASK_FILTERS.map((filter) => (
                <FilterChip
                  key={filter.value}
                  label={filter.label}
                  selected={taskFilter === filter.value}
                  onPress={() => setTaskFilter(filter.value)}
                />
              ))}
            </ScrollView>
            {filteredTasks.length === 0 ? (
              <EmptyState
                title={crm.tasks.length === 0 ? 'کاری ثبت نشده' : 'کاری با این فیلتر پیدا نشد'}
                description={
                  crm.tasks.length === 0
                    ? 'برای پیگیری‌های بعدی یک کار بسازید.'
                    : 'وضعیت یا عبارت جستجو را تغییر دهید.'
                }
                actionLabel={crm.tasks.length === 0 && !crm.loading ? 'ساخت کار' : undefined}
                onAction={
                  crm.tasks.length === 0 && !crm.loading
                    ? () =>
                        setEditor({ kind: 'task', task: null, contactId: null, lockContact: false })
                    : undefined
                }
              />
            ) : (
              filteredTasks.map((task) => {
                const contact = crm.contacts.find((item) => item.local_id === task.contact_id)
                return (
                  <TaskCard
                    key={task.local_id}
                    task={task}
                    contactName={contact?.display_name || null}
                    busy={pendingTaskId === task.local_id}
                    disabled={crm.loading}
                    onToggle={() => void toggleTask(task)}
                    onEdit={() =>
                      setEditor({
                        kind: 'task',
                        task,
                        contactId: task.contact_id,
                        lockContact: false,
                      })
                    }
                    onDelete={() => setDeleteTarget({ kind: 'task', item: task })}
                  />
                )
              })
            )}
          </View>
        ) : null}

        {tab === 'tags' ? (
          <View style={styles.contentStack}>
            <SectionHeading
              title="مدیریت برچسب‌ها"
              caption="برای دسته‌بندی و فیلتر محلی مخاطبین"
              action={
                <Button
                  label="برچسب جدید"
                  size="sm"
                  onPress={() => setEditor({ kind: 'tag', tag: null })}
                  disabled={crm.loading}
                />
              }
            />
            {crm.tags.length === 0 ? (
              <EmptyState
                title="برچسبی نساخته‌اید"
                description="برچسب‌ها به دسته‌بندی مخاطبین کمک می‌کنند."
                actionLabel={!crm.loading ? 'ساخت برچسب' : undefined}
                onAction={!crm.loading ? () => setEditor({ kind: 'tag', tag: null }) : undefined}
              />
            ) : (
              crm.tags.map((tag) => {
                const usage = crm.contacts.filter((contact) =>
                  contact.tag_ids.includes(tag.local_id),
                ).length
                return (
                  <Card key={tag.local_id}>
                    <View style={styles.cardTitleRow}>
                      <CrmText variant="title" style={styles.flexText}>
                        {tag.title}
                      </CrmText>
                      <Badge label={`${persianNumber(usage)} مخاطب`} tone="neutral" />
                    </View>
                    <View style={styles.actionRow}>
                      <Button
                        label="ویرایش"
                        size="sm"
                        variant="secondary"
                        onPress={() => setEditor({ kind: 'tag', tag })}
                        disabled={crm.loading}
                        accessibilityLabel={`ویرایش برچسب ${tag.title}`}
                      />
                      <Button
                        label="حذف"
                        size="sm"
                        variant="danger"
                        onPress={() => setDeleteTarget({ kind: 'tag', item: tag })}
                        disabled={crm.loading}
                        accessibilityLabel={`حذف برچسب ${tag.title}`}
                      />
                    </View>
                  </Card>
                )
              })
            )}
          </View>
        ) : null}
      </View>

      {editor ? (
        <EditorSheet editor={editor} crm={crm} onClose={() => setEditor(null)} onSaved={saved} />
      ) : null}
      <BackupMenu
        visible={backupMode === 'menu'}
        onClose={() => setBackupMode(null)}
        onExport={() => setBackupMode('export')}
        onImport={() => setBackupMode('import')}
      />
      {backupMode === 'export' ? (
        <ExportDataSheet
          crm={crm}
          onShareBackup={onShareBackup}
          onClose={() => setBackupMode(null)}
        />
      ) : null}
      {backupMode === 'import' ? (
        <ImportDataSheet
          crm={crm}
          onPickBackup={onPickBackup}
          onClose={() => setBackupMode(null)}
        />
      ) : null}
      <ConfirmDialog
        visible={deleteTarget !== null}
        title={deleteTarget ? deleteTitle(deleteTarget) : 'حذف مورد'}
        message={deleteTarget ? deleteMessage(deleteTarget) : ''}
        confirmLabel={deleting ? 'در حال حذف…' : 'حذف'}
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null)
        }}
      />
      {toast ? (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      ) : null}
    </Screen>
  )
}

export function CrmWorkspace(props: CrmWorkspaceProps) {
  if (props.crm.lockState === 'unlocked') return <UnlockedCrmWorkspace {...props} />
  return <LockGate crm={props.crm} />
}

const styles = StyleSheet.create({
  workspace: { gap: 16 },
  contentStack: { gap: 12 },
  formStack: { gap: 16 },
  fieldStack: { gap: 8 },
  hero: { gap: 12 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroHeaderText: { flex: 1, gap: 4 },
  lockPage: { gap: 20, alignItems: 'stretch', paddingVertical: 16 },
  lockMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  loadingState: { gap: 16, paddingVertical: 16 },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeadingText: { flex: 1, gap: 4 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  filterStack: { gap: 8 },
  listItemStack: { gap: 8 },
  contactHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactHeaderText: { flex: 1, gap: 4 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexText: { flex: 1 },
  metaStack: { gap: 4, marginTop: 12 },
  notice: { borderWidth: 1, borderRightWidth: 4, padding: 12, gap: 4 },
  choiceChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1 },
  toggleRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  toggleText: { flex: 1, gap: 4 },
  toggleTrack: { width: 48, height: 28, padding: 3, justifyContent: 'center' },
  toggleThumb: { width: 22, height: 22 },
  multiline: { minHeight: 120, borderWidth: 1, textAlign: 'right', writingDirection: 'rtl' },
})
