import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Conversation, ConversationStatus, SupportLevel } from '@superapp/chat-contracts'
import {
  CHAT_SOURCE_LABELS,
  CHAT_SOURCE_OPTIONS,
  CONVERSATION_STATUS_LABELS,
  CONVERSATION_STATUS_OPTIONS,
  SUPPORT_LEVEL_LABELS,
  SUPPORT_LEVEL_OPTIONS,
  assigneeName,
  conversationTitle,
  countActiveFilters,
  formatInboxTimestamp,
  type ConversationListProps,
  type ConversationRouteProps,
} from '@superapp/conversation-inbox'
import { useTheme } from '@superapp/theme'
import { Avatar, Badge, Button, Card, FilterChip, SearchBar, Select } from './primitives'
import {
  EmptyState,
  ErrorState,
  OfflineBanner as OfflineBannerFeedback,
  Skeleton,
} from './feedback'
import { InfiniteList } from './lists'

export function SupportLevelBadge({ level }: { level: SupportLevel }) {
  return (
    <Badge
      label={SUPPORT_LEVEL_LABELS[level]}
      tone={level === 'level_1' ? 'info' : level === 'level_2' ? 'warning' : 'danger'}
    />
  )
}

export function AssigneeAvatar({ conversation }: { conversation: Conversation }) {
  return <Avatar label={conversation.assignee?.name || 'بدون اپراتور'} size="sm" />
}

export function LastMessagePreview({ conversation }: { conversation: Conversation }) {
  const { tokens } = useTheme()
  return (
    <Text
      numberOfLines={1}
      style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}
    >
      {conversation.last_message || 'بدون پیام'}
    </Text>
  )
}

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return <Badge label={count.toLocaleString('fa-IR')} tone="danger" />
}

export function ConversationListItem({
  conversation,
  onPress,
}: {
  conversation: Conversation
  onPress: () => void
}) {
  const { tokens } = useTheme()
  const title = conversationTitle(conversation)

  return (
    <Card onPress={onPress} accessibilityLabel={`باز کردن گفتگو ${title}`}>
      <View style={styles.topRow}>
        <Avatar label={conversation.customer.initials || title} size="lg" />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={[styles.title, { color: tokens.color.textPrimary }]}>
              {title}
            </Text>
            <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
              {formatInboxTimestamp(conversation.last_message_at)}
            </Text>
          </View>
          <LastMessagePreview conversation={conversation} />
        </View>
        <UnreadBadge count={conversation.unread_count} />
      </View>
      <View style={[styles.footer, { borderTopColor: tokens.color.border }]}>
        <View style={styles.badges}>
          <Badge label={CHAT_SOURCE_LABELS[conversation.source]} />
          <SupportLevelBadge level={conversation.support_level} />
        </View>
        <View style={styles.assignee}>
          <AssigneeAvatar conversation={conversation} />
          <Text
            numberOfLines={1}
            style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}
          >
            {assigneeName(conversation)}
          </Text>
        </View>
      </View>
    </Card>
  )
}

function LoadingList() {
  return (
    <View style={{ gap: 12 }} accessibilityLabel="در حال بارگذاری گفتگوها">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <View style={{ gap: 12 }}>
            <Skeleton width="55%" height={20} />
            <Skeleton width="85%" />
            <Skeleton width="70%" />
          </View>
        </Card>
      ))}
    </View>
  )
}

export function ConversationList({ inbox, onOpenConversation }: ConversationListProps) {
  const { tokens } = useTheme()
  const activeFilters = countActiveFilters(inbox.filters)
  const hasFilters = activeFilters > 0 || Boolean(inbox.filters.search)
  const operators = inbox.operators.map((operator) => ({
    value: operator.id,
    label: operator.name,
  }))

  const emptyState = (
    <EmptyState
      title={inbox.dataSource === 'cache' ? 'داده آفلاین موجود نیست' : 'گفتگویی پیدا نشد'}
      description={
        inbox.dataSource === 'cache'
          ? 'داده آفلاین متناسب با این فیلترها موجود نیست.'
          : 'فیلترها یا عبارت جستجو را تغییر دهید.'
      }
      actionLabel={hasFilters ? 'پاک کردن فیلترها' : 'بازخوانی'}
      onAction={hasFilters ? inbox.clearFilters : () => void inbox.refresh()}
    />
  )

  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: tokens.spacing.xl, gap: tokens.spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={inbox.isRefreshing}
          onRefresh={() => void inbox.refresh()}
          tintColor={tokens.color.primary}
        />
      }
    >
      <View style={styles.heading}>
        <View style={styles.headingContent}>
          <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
            گفتگوها
          </Text>
          <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
            {inbox.items.length.toLocaleString('fa-IR')} گفتگو
          </Text>
        </View>
        {inbox.dataSource ? (
          <Badge
            label={inbox.dataSource === 'cache' ? 'آفلاین' : 'آنلاین'}
            tone={inbox.dataSource === 'cache' ? 'warning' : 'success'}
          />
        ) : null}
        <Button
          label="بازخوانی"
          variant="secondary"
          size="sm"
          loading={inbox.isRefreshing}
          onPress={() => void inbox.refresh()}
        />
      </View>

      <SearchBar
        value={inbox.filters.search || ''}
        onChangeText={(search) => inbox.setFilters({ search })}
        placeholder="جستجو در نام، پیام یا اپراتور..."
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <FilterChip label="همه" selected={!hasFilters} onPress={inbox.clearFilters} />
        <FilterChip
          label="خوانده‌نشده"
          selected={Boolean(inbox.filters.unread_only)}
          onPress={() => inbox.setFilters({ unread_only: !inbox.filters.unread_only })}
        />
        {SUPPORT_LEVEL_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            selected={inbox.filters.support_level === option.value}
            onPress={() =>
              inbox.setFilters({
                support_level:
                  inbox.filters.support_level === option.value ? undefined : option.value,
              })
            }
          />
        ))}
      </ScrollView>

      <View style={{ gap: tokens.spacing.sm }}>
        <Select
          label="وضعیت"
          value={inbox.filters.status || ''}
          options={CONVERSATION_STATUS_OPTIONS}
          placeholder="همه وضعیت‌ها"
          onChange={(value) =>
            inbox.setFilters({ status: (value || undefined) as ConversationStatus | undefined })
          }
        />
        <Select
          label="کانال"
          value={inbox.filters.source || ''}
          options={CHAT_SOURCE_OPTIONS}
          placeholder="همه کانال‌ها"
          onChange={(value) =>
            inbox.setFilters({ source: (value || undefined) as Conversation['source'] | undefined })
          }
        />
        {operators.length > 0 ? (
          <Select
            label="اپراتور"
            value={inbox.filters.assignee_operator_id || ''}
            options={operators}
            placeholder="همه اپراتوران"
            onChange={(value) => inbox.setFilters({ assignee_operator_id: value || undefined })}
          />
        ) : null}
        {hasFilters ? (
          <Button label="پاک کردن فیلترها" variant="ghost" size="sm" onPress={inbox.clearFilters} />
        ) : null}
      </View>

      <OfflineBannerFeedback
        visible={inbox.dataSource === 'cache'}
        onRetry={() => void inbox.refresh()}
      />

      {inbox.status === 'loading' && !inbox.isRefreshing ? (
        <LoadingList />
      ) : inbox.status === 'error' && inbox.items.length === 0 ? (
        <ErrorState
          message={inbox.error || 'دریافت گفتگوها ناموفق بود.'}
          onRetry={() => void inbox.retry()}
        />
      ) : (
        <InfiniteList
          items={inbox.items}
          keyExtractor={(conversation) => conversation.id}
          accessibilityLabel="فهرست گفتگوها"
          renderItem={(conversation) => (
            <View style={{ marginBottom: tokens.spacing.sm }}>
              <ConversationListItem
                conversation={conversation}
                onPress={() => onOpenConversation(conversation)}
              />
            </View>
          )}
          emptyState={emptyState}
          loading={inbox.isLoadingMore}
          hasMore={inbox.hasMore}
          onEndReached={() => void inbox.loadMore()}
        />
      )}

      {inbox.error && inbox.items.length > 0 ? (
        <ErrorState message={inbox.error} onRetry={() => void inbox.retry()} />
      ) : null}
    </ScrollView>
  )
}

export function ConversationRoute({ conversation, onBack }: ConversationRouteProps) {
  const { tokens } = useTheme()
  return (
    <View style={{ gap: tokens.spacing.md }}>
      <Button label="بازگشت به گفتگوها" variant="secondary" onPress={onBack} />
      <Card>
        <View style={{ gap: tokens.spacing.sm }}>
          <Badge label={CHAT_SOURCE_LABELS[conversation.source]} tone="primary" />
          <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
            {conversationTitle(conversation)}
          </Text>
          <Text style={{ ...tokens.typography.body, color: tokens.color.textSecondary }}>
            {CONVERSATION_STATUS_LABELS[conversation.status]} · {assigneeName(conversation)}
          </Text>
        </View>
      </Card>
      <EmptyState
        title="صفحه گفتگو"
        description="نمای کامل پیام، ارسال متن و Real-Time در استپ STEP-09 اضافه می‌شود."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 12,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 130 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingContent: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
})
