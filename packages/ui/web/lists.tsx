import { useTheme } from '@superapp/theme'
import type { InfiniteListProps, PaginationListProps } from '../src/types'

export function InfiniteList<T>({
  items,
  renderItem,
  keyExtractor,
  onEndReached,
  loading,
  hasMore,
  emptyState,
  accessibilityLabel,
}: InfiniteListProps<T>) {
  const { tokens } = useTheme()
  return (
    <div className="ui-infinite-list" aria-label={accessibilityLabel}>
      {items.length === 0
        ? emptyState
        : items.map((item, index) => (
            <div key={keyExtractor(item, index)}>{renderItem(item, index)}</div>
          ))}
      {loading ? (
        <div className="ui-list-footer">
          <span
            className="ui-spinner"
            style={{ borderColor: tokens.color.primary, borderTopColor: 'transparent' }}
          />
        </div>
      ) : null}
      {!loading && hasMore && onEndReached ? (
        <button
          type="button"
          className="ui-more"
          onClick={onEndReached}
          style={{
            borderColor: tokens.color.border,
            color: tokens.color.primary,
            borderRadius: tokens.radius.md,
          }}
        >
          نمایش بیشتر
        </button>
      ) : null}
    </div>
  )
}

export function PaginationList({ page, totalPages, onPageChange }: PaginationListProps) {
  const { tokens } = useTheme()
  if (totalPages <= 1) return null
  return (
    <nav className="ui-pagination" aria-label="صفحه‌بندی">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        style={{ borderColor: tokens.color.border, color: tokens.color.textSecondary }}
      >
        قبلی
      </button>
      <span style={{ color: tokens.color.textSecondary }}>
        {page.toLocaleString('fa-IR')} / {totalPages.toLocaleString('fa-IR')}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        style={{ borderColor: tokens.color.border, color: tokens.color.textSecondary }}
      >
        بعدی
      </button>
    </nav>
  )
}
