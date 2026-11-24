import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
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
    <View accessibilityLabel={accessibilityLabel}>
      {items.length === 0
        ? emptyState
        : items.map((item, index) => (
            <View key={keyExtractor(item, index)}>{renderItem(item, index)}</View>
          ))}
      {loading ? (
        <View style={styles.footer}>
          <ActivityIndicator color={tokens.color.primary} />
        </View>
      ) : hasMore && onEndReached ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="نمایش بیشتر"
          onPress={onEndReached}
          style={[
            styles.moreButton,
            { borderColor: tokens.color.border, borderRadius: tokens.radius.md },
          ]}
        >
          <Text style={{ color: tokens.color.primary }}>نمایش بیشتر</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function PaginationList({ page, totalPages, onPageChange }: PaginationListProps) {
  const { tokens } = useTheme()
  if (totalPages <= 1) return null
  return (
    <View style={styles.pagination}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="صفحه قبل"
        disabled={page <= 1}
        onPress={() => onPageChange(page - 1)}
        style={[
          styles.pageButton,
          { borderColor: tokens.color.border, opacity: page <= 1 ? 0.4 : 1 },
        ]}
      >
        <Text style={{ color: tokens.color.textSecondary }}>قبلی</Text>
      </Pressable>
      <Text style={{ color: tokens.color.textSecondary }}>
        {page.toLocaleString('fa-IR')} / {totalPages.toLocaleString('fa-IR')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="صفحه بعد"
        disabled={page >= totalPages}
        onPress={() => onPageChange(page + 1)}
        style={[
          styles.pageButton,
          { borderColor: tokens.color.border, opacity: page >= totalPages ? 0.4 : 1 },
        ]}
      >
        <Text style={{ color: tokens.color.textSecondary }}>بعدی</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { padding: 16, alignItems: 'center' },
  moreButton: {
    minHeight: 40,
    margin: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 12,
  },
  pageButton: {
    minWidth: 64,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
