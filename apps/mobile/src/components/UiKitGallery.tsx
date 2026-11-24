import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useTheme } from '@superapp/theme'
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  EmptyState,
  ErrorState,
  FilterChip,
  IconButton,
  InfiniteList,
  ListItem,
  ModalView,
  MoneyText,
  OfflineBanner,
  PaginationList,
  PersianDateText,
  SearchBar,
  Select,
  Skeleton,
  StatusPill,
  SyncStatusBar,
  Tabs,
  TextField,
  Toast,
} from '@superapp/ui/native'

const sampleItems = [
  { id: '1', title: 'سفارش TK-1008', subtitle: 'در حال پردازش' },
  { id: '2', title: 'سفارش TK-1007', subtitle: 'ارسال شده' },
  { id: '3', title: 'سفارش TK-1006', subtitle: 'تحویل شده' },
]

export function UiKitGallery() {
  const { tokens } = useTheme()
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [selectValue, setSelectValue] = useState('level_1')
  const [date, setDate] = useState('2026-11-25')
  const [chip, setChip] = useState('all')
  const [tab, setTab] = useState('overview')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast, setToast] = useState('')

  return (
    <ScrollView
      contentContainerStyle={{ gap: tokens.spacing.lg, paddingBottom: 24 }}
      testID="ui-kit-gallery"
    >
      <View style={{ gap: tokens.spacing.xs }}>
        <Text style={{ ...tokens.typography.display, color: tokens.color.textPrimary }}>
          UI Kit
        </Text>
        <Text style={{ ...tokens.typography.caption, color: tokens.color.textTertiary }}>
          نمونه کامپوننت‌های قابل‌استفاده مجدد
        </Text>
      </View>

      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>دکمه‌ها</Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: tokens.spacing.sm,
            marginTop: tokens.spacing.md,
          }}
        >
          <Button label="اصلی" onPress={() => setToast('دکمه اصلی فشار داده شد')} />
          <Button
            label="ثانویه"
            variant="secondary"
            onPress={() => setToast('دکمه ثانویه فشار داده شد')}
          />
          <Button label="خطر" variant="danger" onPress={() => setConfirmOpen(true)} />
          <Button label="بارگذاری" loading />
          <IconButton
            accessibilityLabel="علاقه‌مندی"
            icon={<Text style={{ color: tokens.color.textSecondary }}>♡</Text>}
            onPress={() => setToast('علاقه‌مندی ثبت شد')}
          />
        </View>
      </Card>

      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>فرم‌ها</Text>
        <View style={{ gap: tokens.spacing.md, marginTop: tokens.spacing.md }}>
          <TextField
            label="نام"
            value={text}
            onChangeText={setText}
            placeholder="نام خود را وارد کنید"
            hint="حداقل ۳ نویسه"
          />
          <TextField
            label="رمز"
            value={text}
            onChangeText={setText}
            secureTextEntry
            error="رمز نمونه"
          />
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onSubmit={() => setToast(`جستجو: ${search}`)}
          />
          <Select
            label="سطح پشتیبانی"
            value={selectValue}
            onChange={setSelectValue}
            options={[
              { label: 'سطح یک', value: 'level_1' },
              { label: 'سطح دو', value: 'level_2' },
            ]}
          />
          <DatePicker label="تاریخ" value={date} onChange={setDate} />
        </View>
      </Card>

      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          فیلتر و تب
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: tokens.spacing.sm,
            marginTop: tokens.spacing.md,
          }}
        >
          {[
            ['all', 'همه'],
            ['open', 'باز'],
            ['closed', 'بسته'],
          ].map(([value, label]) => (
            <FilterChip
              key={value}
              label={label}
              selected={chip === value}
              onPress={() => setChip(value)}
            />
          ))}
        </View>
        <View style={{ marginTop: tokens.spacing.md }}>
          <Tabs
            items={[
              { value: 'overview', label: 'معرفی' },
              { value: 'specs', label: 'مشخصات', badge: 2 },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      </Card>

      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          لیست و داده
        </Text>
        <View style={{ marginTop: tokens.spacing.sm }}>
          <ListItem
            title="علی محمدی"
            subtitle="مشتری وفادار"
            leading={<Avatar label="ع م" />}
            trailing={<Badge label="فعال" tone="success" />}
            onPress={() => setToast('کاربر انتخاب شد')}
          />
          <ListItem
            title="مریم احمدی"
            subtitle="آخرین تماس: امروز"
            leading={<Avatar label="م ا" size="sm" />}
            trailing={<StatusPill label="آنلاین" tone="success" />}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: tokens.spacing.md,
          }}
        >
          <MoneyText amount={12989000} />
          <PersianDateText value="2026-11-25T10:00:00Z" />
        </View>
      </Card>

      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>بازخورد</Text>
        <View style={{ gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
          <EmptyState
            title="داده‌ای وجود ندارد"
            description="پس از دریافت داده، اینجا نمایش داده می‌شود."
            actionLabel="بازخوانی"
            onAction={() => setToast('بازخوانی شد')}
          />
          <ErrorState
            message="ارتباط با سرور برقرار نشد."
            onRetry={() => setToast('تلاش دوباره')}
          />
          <Skeleton width="80%" height={14} />
          <Skeleton width="100%" height={14} />
        </View>
      </Card>

      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>لیست‌ها</Text>
        <View style={{ height: 220, marginTop: tokens.spacing.sm }}>
          <InfiniteList
            items={sampleItems}
            keyExtractor={(item) => item.id}
            renderItem={(item) => <ListItem title={item.title} subtitle={item.subtitle} />}
            hasMore
            onEndReached={() => setToast('نمایش بیشتر')}
          />
        </View>
        <PaginationList page={page} totalPages={3} onPageChange={setPage} />
      </Card>

      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          وضعیت اتصال
        </Text>
        <View style={{ gap: tokens.spacing.sm, marginTop: tokens.spacing.md }}>
          <OfflineBanner visible onRetry={() => setToast('اتصال بازتلاش شد')} />
          <SyncStatusBar
            status="success"
            lastSyncedAt="2026-11-25T10:00:00Z"
            onPress={() => setToast('سینک دستی')}
          />
          <Button
            label="نمایش Toast"
            variant="secondary"
            onPress={() => setToast('این یک پیام کوتاه است')}
          />
        </View>
      </Card>

      <Card>
        <Text style={{ ...tokens.typography.title, color: tokens.color.textPrimary }}>
          Overlayها
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: tokens.spacing.sm,
            marginTop: tokens.spacing.md,
          }}
        >
          <Button label="Modal" variant="secondary" onPress={() => setModalOpen(true)} />
          <Button label="Bottom Sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
          <Button label="Confirm" variant="secondary" onPress={() => setConfirmOpen(true)} />
        </View>
      </Card>

      <ModalView visible={modalOpen} onClose={() => setModalOpen(false)} title="نمونه Modal">
        <Text style={{ color: tokens.color.textSecondary }}>
          محتوای Modal در اینجا نمایش داده می‌شود.
        </Text>
      </ModalView>
      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="نمونه Bottom Sheet"
      >
        <Text style={{ color: tokens.color.textSecondary }}>
          محتوای Bottom Sheet در اینجا نمایش داده می‌شود.
        </Text>
      </BottomSheet>
      <ConfirmDialog
        visible={confirmOpen}
        title="حذف سفارش"
        message="این عملیات قابل بازگشت نیست."
        destructive
        onConfirm={() => {
          setConfirmOpen(false)
          setToast('سفارش حذف شد')
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      {toast ? <Toast message={toast} tone="success" onDismiss={() => setToast('')} /> : null}
    </ScrollView>
  )
}
