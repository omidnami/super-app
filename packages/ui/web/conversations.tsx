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
import { EmptyState, ErrorState, OfflineBanner, Skeleton } from './feedback'
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
    <span className="inbox-preview" style={{ color: tokens.color.textSecondary }}>
      {conversation.last_message || 'بدون پیام'}
    </span>
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
      <span className="inbox-item-top">
        <Avatar label={conversation.customer.initials || title} size="lg" />
        <span className="inbox-item-content">
          <span className="inbox-item-title">
            <strong style={{ color: tokens.color.textPrimary }}>{title}</strong>
            <span style={{ color: tokens.color.textTertiary }}>
              {formatInboxTimestamp(conversation.last_message_at)}
            </span>
          </span>
          <LastMessagePreview conversation={conversation} />
        </span>
        <UnreadBadge count={conversation.unread_count} />
      </span>
      <span className="inbox-item-footer" style={{ borderTopColor: tokens.color.border }}>
        <span className="inbox-badges">
          <Badge label={CHAT_SOURCE_LABELS[conversation.source]} />
          <SupportLevelBadge level={conversation.support_level} />
        </span>
        <span className="inbox-assignee">
          <AssigneeAvatar conversation={conversation} />
          <span style={{ color: tokens.color.textTertiary }}>{assigneeName(conversation)}</span>
        </span>
      </span>
    </Card>
  )
}

function LoadingList() {
  return (
    <div className="inbox-loading" aria-label="در حال بارگذاری گفتگوها">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <div className="inbox-skeleton">
            <Skeleton width="55%" height={20} />
            <Skeleton width="85%" />
            <Skeleton width="70%" />
          </div>
        </Card>
      ))}
    </div>
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
    <section className="inbox" style={{ gap: tokens.spacing.md }} aria-label="صف گفتگوها">
      <header className="inbox-header">
        <div className="inbox-heading">
          <h2>گفتگوها</h2>
          <span style={{ color: tokens.color.textTertiary }}>
            {inbox.items.length.toLocaleString('fa-IR')} گفتگو
          </span>
        </div>
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
      </header>

      <SearchBar
        value={inbox.filters.search || ''}
        onChangeText={(search) => inbox.setFilters({ search })}
        placeholder="جستجو در نام، پیام یا اپراتور..."
      />

      <div className="inbox-chips">
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
      </div>

      <div className="inbox-selects">
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
      </div>
      {hasFilters ? (
        <div>
          <Button label="پاک کردن فیلترها" variant="ghost" size="sm" onPress={inbox.clearFilters} />
        </div>
      ) : null}

      <OfflineBanner visible={inbox.dataSource === 'cache'} onRetry={() => void inbox.refresh()} />

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
            <div className="inbox-item-wrapper">
              <ConversationListItem
                conversation={conversation}
                onPress={() => onOpenConversation(conversation)}
              />
            </div>
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
    </section>
  )
}

export function ConversationRoute({ conversation, onBack }: ConversationRouteProps) {
  const { tokens } = useTheme()
  return (
    <section className="inbox" style={{ gap: tokens.spacing.md }} aria-label="صفحه گفتگو">
      <Button label="بازگشت به گفتگوها" variant="secondary" onPress={onBack} />
      <Card>
        <div className="inbox-route-summary">
          <Badge label={CHAT_SOURCE_LABELS[conversation.source]} tone="primary" />
          <h2 style={{ color: tokens.color.textPrimary }}>{conversationTitle(conversation)}</h2>
          <p style={{ color: tokens.color.textSecondary }}>
            {CONVERSATION_STATUS_LABELS[conversation.status]} · {assigneeName(conversation)}
          </p>
        </div>
      </Card>
      <EmptyState
        title="صفحه گفتگو"
        description="نمای کامل پیام، ارسال متن و Real-Time در استپ STEP-09 اضافه می‌شود."
      />
    </section>
  )
}
