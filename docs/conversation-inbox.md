# صف گفتگوها و فیلترها

> مرحله: STEP-08
>
> پکیج State: `@superapp/conversation-inbox`
>
> کامپوننت‌ها: `@superapp/ui/native` و `@superapp/ui/web`

---

## ۱. هدف

ساخت Inbox قابل‌استفاده برای موبایل و PWA با فیلتر، جستجو، Pagination، مدیریت خطا و اتصال به مسیر گفتگو.

---

## ۲. لایه‌ها

- `ConversationApi`: دریافت فهرست، جزئیات و پیام‌ها از Planet
- `useConversationInbox`: State مشترک فیلتر، Pagination، Refresh و Fallback
- `ConversationList`: کنترل‌های جستجو و فیلتر به‌همراه نمایش لیست
- `ConversationListItem`: نام مشتری، آخرین پیام، زمان، کانال، سطح، اپراتور و خوانده‌نشده
- `ConversationRoute`: مسیر بازشدن گفتگو؛ صفحه کامل چت در STEP-09 پیاده می‌شود

UI مستقیماً `fetch` یا SQL نمی‌نویسد.

---

## ۳. اتصال Planet

Adapter واقعی:

```ts
createPlanetConversationApi({
  baseUrl,
  getAccessToken,
  fetch,
})
```

ویژگی‌ها:

- Endpoint استاندارد `/api/v1/chat/conversations`
- ارسال Bearer Token پیام‌رسان
- پاس‌دادن Queryهای مستند از جمله Cursor و فیلترها
- خطای تایپ‌شده `PlanetApiError`
- پشتیبانی از `AbortSignal`

آپ‌ها با `createConfiguredConversationApi` Adapter را انتخاب می‌کنند:

- موبایل: `EXPO_PUBLIC_PLANET_API_URL`
- PWA: `VITE_PLANET_API_URL`

اگر URL تنظیم نشده باشد، Mock اجرا می‌شود تا پروژه بدون Backend قابل‌اجرا باشد. با تنظیم URL، همان اپ‌ها مستقیماً از Adapter واقعی Planet استفاده می‌کنند و UI یا Hook تغییر نمی‌کند.

---

## ۴. فیلترها

- جستجو در نام مشتری، متن آخرین پیام، شناسه گفتگو و نام اپراتور
- سطح پشتیبانی
- وضعیت گفتگو
- کانال
- اپراتور
- فقط خوانده‌نشده

جستجو با Debounce کوتاه اجرا می‌شود. تغییر فیلترها درخواست قبلی را Abort و نتیجه قدیمی را نادیده می‌گیرد. گزینه‌های اپراتور از گفتگوهای دریافت‌شده حفظ می‌شوند تا با تغییر جستجو یا فیلتر از منوی انتخاب ناپدید نشوند.

---

## ۵. Pagination و Refresh

- Pagination با Cursor سرور
- دکمه «نمایش بیشتر» در UI Kit
- ادغام صفحه‌ها بر اساس `conversation.id`
- جلو رفتن Cursor فقط با پاسخ معتبر
- Refresh دستی
- Pull to Refresh در موبایل
- حفظ نتیجه هنگام خطای دریافت صفحه بعد

---

## ۶. آفلاین و Cache

### موبایل

- پاسخ موفق Planet در SQLite و با `owner_id` ذخیره می‌شود.
- در صورت خطای شبکه، همان Query از `ConversationRepository` خوانده می‌شود.
- داده Cache با برچسب «آفلاین» نمایش داده می‌شود.
- خطای نوشتن Cache، پاسخ موفق سرور را پنهان نمی‌کند.
- Fallback فقط برای خطای شبکه انجام می‌شود؛ پاسخ 401، 403 و سایر خطاهای HTTP هرگز داده Cache را نمایش نمی‌دهند.
- Scope داده شامل `operator_id` و `project_id` است و در `owner_id` ذخیره می‌شود.
- خروج از پیام‌رسان، Cache همان اپراتور/پروژه را پاک می‌کند.
- Migration نسخه ۲، Cache قدیمیِ فقط Project-scoped را حذف می‌کند.
- Cache فقط داده خواندنی Planet را نگه می‌دارد؛ Outbox ندارد.

در Snapshot کامل و بدون فیلتر، گفتگوهای غایب از پاسخ Planet با Tombstone از Cache حذف می‌شوند. برای Queryهای فیلترشده، غیبت یک رکورد به‌معنای حذف سرور نیست و Cache دست‌نخورده می‌ماند.

### PWA

- هیچ Cache داده کسب‌وکار در SQLite، IndexedDB یا localStorage ایجاد نمی‌شود.
- PWA فقط از Adapter آنلاین استفاده می‌کند.
- در قطع شبکه، خطای قابل Retry نمایش داده می‌شود.

---

## ۷. مسیر گفتگو

انتخاب هر گفتگو، `ConversationRoute` را باز می‌کند و دکمه بازگشت به Inbox را ارائه می‌دهد.

این مسیر عمداً فقط مرز Navigation برای STEP-09 است؛ ارسال پیام، تاریخچه و Real-Time در آن استپ اضافه می‌شود.

---

## ۸. تست‌ها

- فیلترهای سطح، وضعیت، کانال، اپراتور، خوانده‌نشده و جستجو
- حذف رکوردهای Tombstone از نتیجه
- ارسال Query و Bearer Token به Adapter واقعی Planet
- Pagination با Cursor و بدون Duplicate
- تمایز نتیجه خالی از خطا
- Fallback به Cache با `owner_id`
- عدم Fallback روی پاسخ 401، 403 و 503
- Scope جداگانه اپراتور و پروژه
- پاک‌سازی Cache با Callback خروج از سرویس
- حذف Cache قدیمی در Migration نسخه ۲
- Tombstone گفتگوهای غایب از Snapshot کامل
- جستجوی آفلاین بدون Wildcard و تطبیق دقیق اپراتور
- حفظ پاسخ سرور هنگام خطای Cache
- خطای شبکه بدون Cache
- فیلتر و جستجو در UI موبایل و PWA
- بازشدن و بازگشت از مسیر گفتگو
