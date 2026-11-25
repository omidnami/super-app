# تاریخچه آفلاین و Backlog Reconciliation

> مرحله: STEP-11

---

## ۱. هدف

پس از reconnect، پیام‌های ازدست‌رفده از Planet دریافت و بدون Gap یا Duplicate با رویدادهای زنده ادغام شوند.

---

## ۲. ترتیب Reconciliation

1. اتصال Hub برقرار می‌شود.
2. رویدادهای زنده در Buffer محلی نگه داشته می‌شوند.
3. Cursor آخرین گفتگو از `sync_state` خوانده می‌شود.
4. صفحه‌های Delta Sync از Planet دریافت می‌شوند.
5. صفحه‌های میانی و صفحه نهایی در Transaction اعمال می‌شوند؛ Cursor هنوز جلو نمی‌رود.
6. رویدادهای Buffer، از جمله رویدادهای رسیده حین Transaction، به‌صورت durable ذخیره می‌شوند.
7. Cursor فقط پس از ذخیره موفق Buffer در Commit جداگانه جلو می‌رود.
8. Crash قبل از Commit Cursor باعث Replay و Dedup می‌شود، نه Gap.
7. تاریخچه آخرین صفحه و Buffer با شناسه Canonical ادغام می‌شوند.
8. زمان `server_time` به‌عنوان آخرین سینک ثبت می‌شود.

---

## ۳. Cursor

- Dataset به‌ازای هر Conversation: `chat:{conversation_id}`
- داده‌ها با Scope اپراتور/پروژه ایزوله می‌شوند.
- Cursor منقضی (`410`) باعث Full Snapshot می‌شود.
- Snapshot کامل، رکوردهای غایب را Tombstone می‌کند و Cursor را Reset می‌کند؛ Snapshot ناقص هرگز جایگزین Cache نمی‌شود.

---

## ۴. Dedup و حذف

- Upsert بر اساس Canonical `message_id`
- URL و فیلدهای موقت Provider پیش از ذخیره Sync حذف می‌شوند
- Tombstone با `updated_at` و `version` در برابر Upsert قدیمی مقاوم است
- حذف synthetic `hub_*` هنگام رسیدن نسخه Canonical هم‌متن
- حذف سرور با `deleted_at` از تاریخچه قابل‌مشاهده خارج می‌شود
- Crash یا Change نامعتبر، داده و Cursor را Rollback می‌کند

---

## ۵. حالت‌های خطا

- شبکه یا خطای سرور: Cache سالم حفظ و با Badge «داده قدیمی» نمایش داده می‌شود.
- `401` و `403`: Cache بدون احراز مجاز نمایش داده نمی‌شود.
- `410`: Full Resync انجام می‌شود.
- خطای Sync، پیام‌های زنده Buffer را پاک نمی‌کند مگر اینکه Component خارج شود.

---

## ۶. UI

- `OfflineBanner`
- `StaleDataBadge`
- `SyncStatusBar`
- نمایش آخرین زمان سینک
- Composer آفلاین غیرفعال می‌ماند

PWA داده کسب‌وکار را Persistent نمی‌کند؛ Cursor در حافظه همان Session باقی می‌ماند.

---

## ۷. تست‌ها

- Gap پس از reconnect
- Duplicate هم‌زمان Socket و Backlog
- Crash حین Merge و Rollback
- Deleted Message
- Snapshot و Cursor منقضی
- Offline Read با آخرین زمان سینک
