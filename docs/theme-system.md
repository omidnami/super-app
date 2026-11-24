# سیستم تم و Design Tokenها

> مرحله: STEP-03
>
> پکیج‌ها: `@superapp/design-tokens`، `@superapp/theme`، `@superapp/ui`

---

## ۱. حالت‌ها

- `system`: پیروی از تنظیم روشن/تاریک دستگاه
- `light`: روشن
- `dark`: تاریک

پیش‌فرض: `system`

---

## ۲. تنظیمات ذخیره‌شده

```text
themeMode
accentColor
themePreset
```

کلید Storage:

```text
superapp.theme.preferences.v1
```

- موبایل: AsyncStorage از طریق `StorageAdapter`
- PWA: localStorage از طریق `StorageAdapter`

---

## ۳. Tokenها

- رنگ‌های Semantic
- رنگ‌های مینی‌اپ‌ها: `nav.superapp`، `nav.messenger`، `nav.account`
- Typography
- Spacing
- Radius
- Elevation

کامپوننت‌ها نباید رنگ خام استفاده کنند؛ فقط `tokens.color.*` و Tokenهای مشابه مجاز هستند.

---

## ۴. رنگ برند

- Presetهای نارنجی، آبی، بنفش، سبز و صورتی
- ورود رنگ سفارشی HEX
- تولید `primary`، `primaryHover`، `primaryPressed` و `onPrimary`
- تضمین حداقل کنتراست ۴٫۵ برای متن و کنترل‌های اصلی
- رنگ‌های success، warning و danger معنایی و ثابت می‌مانند

---

## ۵. کامپوننت‌های مشترک

- `ThemeModeSelector`
- `AccentColorPicker`

این کامپوننت‌ها Headless هستند و Rendering را از طریق Render Prop به موبایل یا PWA می‌سپارند؛ منطق انتخاب در هر دو پلتفرم یکسان است.

---

## ۶. Gallery

- موبایل: `apps/mobile/src/components/ThemeGallery.tsx`
- PWA: `apps/pwa/src/components/ThemeGallery.tsx`

Gallery رنگ‌ها، Typography، Spacing، Radius و Elevation را در تم فعال نمایش می‌دهد.

---

## ۷. تست‌ها

- تغییر تم سیستم در زمان اجرا
- انتخاب تم دستی و ماندگاری پس از Remount
- ذخیره رنگ برند
- رد رنگ HEX نامعتبر
- کنتراست AA برای Presetها در Light و Dark
- کنتراست برچسب مینی‌اپ‌ها
- تغییر تم در اپ موبایل
