import { useState } from 'react'
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
} from '@superapp/ui/web'

const filterOptions = [
  { value: 'all', label: 'همه' },
  { value: 'open', label: 'باز' },
  { value: 'closed', label: 'بسته' },
] as const

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
    <div className="ui-kit-gallery" data-testid="ui-kit-gallery">
      <header className="gallery-header">
        <h1>UI Kit</h1>
        <p>نمونه کامپوننت‌های قابل‌استفاده مجدد</p>
      </header>

      <Card>
        <h2>دکمه‌ها</h2>
        <div className="gallery-row">
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
            icon={<span style={{ color: tokens.color.textSecondary }}>♡</span>}
            onPress={() => setToast('علاقه‌مندی ثبت شد')}
          />
        </div>
      </Card>

      <Card>
        <h2>فرم‌ها</h2>
        <div className="gallery-stack">
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
        </div>
      </Card>

      <Card>
        <h2>فیلتر و تب</h2>
        <div className="gallery-row">
          {filterOptions.map(({ value, label }) => (
            <FilterChip
              key={value}
              label={label}
              selected={chip === value}
              onPress={() => setChip(value)}
            />
          ))}
        </div>
        <Tabs
          items={[
            { value: 'overview', label: 'معرفی' },
            { value: 'specs', label: 'مشخصات', badge: 2 },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Card>

      <Card>
        <h2>لیست و داده</h2>
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
        <div className="gallery-row gallery-row-between">
          <MoneyText amount={12989000} />
          <PersianDateText value="2026-11-25T10:00:00Z" />
        </div>
      </Card>

      <Card>
        <h2>بازخورد</h2>
        <div className="gallery-stack">
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
        </div>
      </Card>

      <Card>
        <h2>لیست‌ها</h2>
        <InfiniteList
          items={sampleItems}
          keyExtractor={(item) => item.id}
          renderItem={(item) => <ListItem title={item.title} subtitle={item.subtitle} />}
          hasMore
          onEndReached={() => setToast('نمایش بیشتر')}
        />
        <PaginationList page={page} totalPages={3} onPageChange={setPage} />
      </Card>

      <Card>
        <h2>وضعیت اتصال</h2>
        <div className="gallery-stack">
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
        </div>
      </Card>

      <Card>
        <h2>Overlayها</h2>
        <div className="gallery-row">
          <Button label="Modal" variant="secondary" onPress={() => setModalOpen(true)} />
          <Button label="Bottom Sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
          <Button label="Confirm" variant="secondary" onPress={() => setConfirmOpen(true)} />
        </div>
      </Card>

      <ModalView visible={modalOpen} onClose={() => setModalOpen(false)} title="نمونه Modal">
        <p>محتوای Modal در اینجا نمایش داده می‌شود.</p>
      </ModalView>
      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="نمونه Bottom Sheet"
      >
        <p>محتوای Bottom Sheet در اینجا نمایش داده می‌شود.</p>
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
    </div>
  )
}
