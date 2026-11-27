# دیتابیس محلی و Sync Core

> مرحله: STEP-07
>
> پکیج: `@superapp/local-db`

---

## ۱. هدف

ذخیره داده‌های قابل‌مشاهده آفلاین، Repositoryهای typed و سینک یک‌طرفه از سرور به SQLite.

---

## ۲. دیتابیس

- Expo SQLite
- Migrationهای نسخه‌دار
- Transaction اتمیک
- Interface `LocalDatabase`
- Interface `DatabaseFactory`

Adapter فعلی: `createExpoDatabaseFactory`

Adapterهای جایگزین مانند SQLCipher باید همان `DatabaseFactory` را پیاده کنند.

> وضعیت MVP: دیتابیس استاندارد Expo SQLite است. فعال‌سازی SQLCipher و مدیریت کلید رمزنگاری پیش از Release باید جداگانه انجام شود.

---

## ۳. Schema

- `cached_conversations`
- `cached_messages`
- `sync_state`
- `app_settings`
- `cached_orders`
- `cached_products`
- `cached_accounting_documents`
- `cached_reports`
- `crm_contacts`
- `crm_tags`
- `crm_notes`
- `crm_tasks`
- `crm_interactions`
- `schema_migrations`

همه داده‌های سروری با `owner_id` ایزوله می‌شوند. Cache گفتگوها از Scope ترکیبی اپراتور و پروژه استفاده می‌کند و `project_id` واقعی در ستون جداگانه نگهداری می‌شود. Migration نسخه ۲ داده Cache قدیمیِ بدون Scope اپراتور را حذف می‌کند. Migration نسخه ۳ ستون `sync_version` را برای مقاومت Tombstone در برابر Delta قدیمی اضافه می‌کند. Migration نسخه ۴ جدول Plaintext قدیمی حسابداری را حذف و Payload اسناد/داشبورد مالی را به `payload_ciphertext` با `expires_at` منتقل می‌کند.

---

## ۴. Repositoryها

- `ConversationRepository`
- `MessageRepository`
- `SyncStateRepository`
- `OrderRepository`
- `ProductRepository`
- `AccountingRepository`
- `AppSettingsRepository`

قواعد:

- UI مستقیماً SQL نمی‌نویسد.
- Upsert بر اساس `owner_id + server_id`.
- پیام دارای `client_mutation_id` و ایندکس یکتا است.
- ترتیب پیام بر اساس `sent_at` و `server_id`.
- فیلتر پیش‌فرض، رکوردهای `deleted_at IS NULL` را برمی‌گرداند.
- `AccountingRepository` برای خواندن/نوشتن Payload مالی به `PayloadCipher` نیاز دارد و بدون آن خطا می‌دهد.
- فیلتر نوع/وضعیت/جستجو پس از Decrypt و Pagination پس از فیلتر انجام می‌شود.
- Retention پیش‌فرض مالی ۳۰ روز است و رکوردهای منقضی حذف می‌شوند.

---

## ۴.۱. رمزنگاری Payload مالی

- AES-256-GCM با Nonce تصادفی ۱۲ بایتی
- Scope اپراتور/پروژه در AAD
- کلید ۳۲ بایتی در SecureStore موبایل
- حذف کلید هنگام Logout، حتی اگر پاک‌سازی SQLite شکست بخورد
- ساخت کلید جدید، رکوردهای قدیمیِ ناخوانا را پیش از استفاده پاک می‌کند

---

## ۵. Sync Engine

- `applyChatChanges`
- `applyShopSnapshot`
- `applyAccountingSnapshot`
- `getCursor`

جریان:

1. دریافت تغییرات از سرور
2. شروع Transaction
3. Upsert یا Tombstone هر تغییر
4. ثبت Cursor و `last_synced_at`
5. Commit

اگر هر تغییر شکست بخورد، تمام Batch و Cursor Rollback می‌شود.

---

## ۶. حذف

حذف با Tombstone انجام می‌شود:

```text
deleted_at
updated_at
synced_at
cache_status = deleted
```

Conversation حذف‌شده از فهرست خارج می‌شود، اما پیام‌های آن برای حفظ تاریخچه و امکان بازیابی نگهداری می‌شوند.

---

## ۷. محدودیت‌های MVP

- Outbox وجود ندارد.
- ارسال تغییرات آفلاین وجود ندارد.
- `web_updated_at` برای pending محلی استفاده نمی‌شود.
- Snapshot کامل فروشگاه و حسابداری رکوردهای حذف‌شده را خودکار پاک نمی‌کند؛ حذف باید با Tombstone یا Full Resync مدیریت شود.
- رمزنگاری Native Database (SQLCipher) در این مرحله فعال نشده است؛ در عوض Payload مالی با AES-GCM رمزنگاری می‌شود.

---

## ۸. تست‌ها

- اجرای Idempotent Migration
- Upsert بدون Duplicate
- نادیده‌گرفتن Update قدیمی‌تر
- ترتیب پیام‌ها
- Rollback کامل Batch و Cursor
- جلو رفتن Cursor فقط پس از Commit
- ایزوله‌سازی User
- Tombstone و حفظ تاریخچه
- مقاومت Tombstone در برابر Upsert قدیمی و بازیابی با نسخه جدیدتر

تست‌ها با `node:sqlite` اجرا می‌شوند و Schema واقعی را بررسی می‌کنند.
