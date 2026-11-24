# UI Kit و App Shell

> مرحله: STEP-04
>
> پکیج: `@superapp/ui`

---

## ۱. معماری

UI Kit دو Adapter پلتفرمی دارد:

```text
packages/ui/src       # تایپ‌ها، فرمت، Theme Controls، Service Session
packages/ui/native    # کامپوننت‌های React Native
packages/ui/web      # کامپوننت‌های React DOM و CSS
```

Import موبایل:

```ts
import { Button, Card } from '@superapp/ui/native'
```

Import PWA:

```ts
import { Button, Card } from '@superapp/ui/web'
```

منطق و Props مشترک است؛ Rendering و رفتار Native/Web متفاوت است.

---

## ۲. کامپوننت‌ها

### Primitiveها

- Button
- IconButton
- TextField
- SearchBar
- Select
- DatePicker
- FilterChip
- Tabs
- Card
- ListItem
- Avatar
- Badge
- StatusPill
- MoneyText
- PersianDateText

### بازخورد

- EmptyState
- ErrorState
- Skeleton
- OfflineBanner
- SyncStatusBar
- Toast

### لیست و Overlay

- InfiniteList
- PaginationList
- Modal
- BottomSheet
- ConfirmDialog

### Shell

- Screen
- Header
- MiniAppShell
- MiniAppHeader
- MobileNavigation
- DesktopSidebar
- AppShell
- SuperAppNavigation

### مرز سرویس

- ServiceSessionProvider
- ServiceAuthBoundary
- useServiceSession

این مرزها فعلاً Presentational هستند؛ منطق واقعی Auth در STEP-05 اضافه می‌شود.

---

## ۳. ناوبری

سه مقصد اصلی:

```text
superapp
messaging
account
```

هر مقصد:

- رنگ اختصاصی دارد.
- Header و Shell مستقل دارد.
- Session سرویس دیگر را وارد محیط خود نمی‌کند.
- در موبایل Bottom Navigation دارد.
- در PWA در عرض بزرگ Sidebar و در عرض کوچک Bottom Navigation دارد.

رنگ‌ها از `nav.superapp`، `nav.messenger` و `nav.account` می‌آیند.

---

## ۴. قواعد کامپوننت‌ها

- بدون رنگ خام.
- استفاده از Design Token و Theme Provider.
- Props تمام‌شده و TypeScript Strict.
- accessibilityLabel برای کنترل‌ها.
- پشتیبانی از RTL و Dark Mode.
- بدون منطق API یا SQL.
- حالت Loading، Empty و Error مشخص.
- قابل‌استفاده در صفحه‌های دیگر.

---

## ۵. Gallery

- موبایل: `apps/mobile/src/components/UiKitGallery.tsx`
- PWA: `apps/pwa/src/components/UiKitGallery.tsx`

Gallery نمونه‌های دکمه، فرم، فیلتر، لیست، بازخورد، Overlay، وضعیت اتصال و Shell را نمایش می‌دهد.

---

## ۶. تست‌ها

- رندر UI Kit در موبایل و PWA
- جابه‌جایی بین سوپرآپ، پیام‌رسان و مدیریت حساب
- استقلال محیط و رنگ مینی‌اپ‌ها
- Dark Mode و RTL
- Typecheck و Lint همه کامپوننت‌ها
- Build موبایل و PWA
