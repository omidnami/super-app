# ماژول حسابداری فقط‌خواندنی

> مرحله: STEP-14
>
> پکیج: `@superapp/accounting`

---

## ۱. هدف

نمایش داشبورد مالی، اسناد، تراکنش‌ها و گزارش تجمیعی با داده آنلاین Planet و Cache آفلاین رمزنگاری‌شده موبایل.

هیچ API یا دکمه ایجاد، ویرایش، حذف، تأیید سند یا تغییر موجودی وجود ندارد.

---

## ۲. اجزا

- `AccountingScreen`
- `AccountingDashboard`
- `AccountingDocumentCard` / `InvoiceCard`
- `DocumentList` / `DocumentDetail`
- `TransactionList`
- `ReportTable`
- `MetricCard` و `StaleDataBadge`
- `useAccounting`
- `AccountingApi` و `AccountingCache`

---

## ۳. دسترسی

- مجوز `accounting.read` الزامی است.
- بدون مجوز، هیچ درخواست یا خواندن Cache مالی انجام نمی‌شود.
- خطای `401` و `403` هرگز Cache را نمایش نمی‌دهند.
- خطای `404` به Cache سند Fallback نمی‌کند.
- Cache موبایل با Scope ترکیبی اپراتور/پروژه ایزوله می‌شود.
- Logout مدیریت حساب، Cache فروشگاه و Cache مالی همان Scope را پاک می‌کند.
- PWA داده مالی را Persistent نمی‌کند.

---

## ۴. API

| متد | مسیر |
|---|---|
| GET | `/api/v1/account/accounting/dashboard` |
| GET | `/api/v1/account/accounting/documents` |
| GET | `/api/v1/account/accounting/documents/{document_id}` |

Queryهای فهرست اسناد:

- `search`: کد، طرف حساب یا توضیح
- `type`: `invoice`، `receipt`، `payment`، `journal`
- `status`: `draft`، `confirmed`، `cancelled`
- `issued_from` و `issued_to`: تاریخ ISO یا `YYYY-MM-DD` با مرزهای inclusive
- `cursor` و `limit`

تاریخ نامعتبر یا بازه معکوس با `422 VALIDATION_ERROR` رد می‌شود. همه درخواست‌ها Bearer Token مدیریت حساب و فقط GET هستند.

---

## ۵. گزارش و تراکنش

- `TransactionList` اسناد مجاز snapshot را به‌ترتیب `issued_at` نمایش می‌دهد.
- `ReportTable` تعداد و جمع مبلغ اسناد را بر اساس نوع سند تجمیع می‌کند.
- گزارش فقط پس از دریافت کامل صفحه‌ها ساخته می‌شود.
- حداکثر ۱۰ صفحه × ۱۰۰ سند پردازش می‌شود؛ در صورت بیشتر، خطای صریح «گزارش کامل نیست» نمایش داده می‌شود.
- اگر دریافت چند صفحه گزارش نیمه‌کاره بماند، Hook گزارش را به Cache تبدیل نمی‌کند و صفحه‌های ناقص ذخیره نمی‌شود.

---

## ۶. رمزنگاری Cache

- Payload اسناد و داشبورد با AES-256-GCM رمزنگاری می‌شود.
- هر Payload Nonce تصادفی ۱۲ بایتی دارد.
- Scope اپراتور/پروژه در Additional Authenticated Data استفاده می‌شود.
- کلید ۳۲ بایتی در `expo-secure-store` با سطح دسترسی `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` نگهداری می‌شود.
- نام کلید، Hash SHA-256 Scope است و خود Scope در Keychain ذخیره نمی‌شود.
- ستون‌های حساس Plaintext مثل کد، طرف حساب، مبلغ و توضیح در SQLite وجود ندارند.
- Metadata همگام‌سازی مانند `owner_id`، `server_id`، تاریخ صدور/به‌روزرسانی و `expires_at` برای فیلتر، Tombstone و Retention Plaintext می‌ماند.
- تغییر Ciphertext یا استفاده از کلید اشتباه با خطای احراز هویت Payload رد می‌شود.
- Migration نسخه ۴ جدول Plaintext قدیمی حسابداری را حذف و Schema رمزنگاری‌شده را می‌سازد.

اگر پاک‌سازی SQLite هنگام Logout شکست بخورد، کلید SecureStore با وجود خطا حذف می‌شود تا داده باقی‌مانده قابل‌خواندن نباشد. در اجرای بعدی، ساخت کلید جدید باعث پاک‌سازی رکوردهای قدیمیِ ناخوانا پیش از استفاده می‌شود.

---

## ۷. Retention

- Retention پیش‌فرض Cache مالی: **۳۰ روز**.
- مقدار بین ۱ تا ۳۶۵ روز قابل تنظیم است.
- `expires_at` روی اسناد و داشبورد ذخیره می‌شود.
- رکوردهای منقضی هنگام خواندن، ذخیره snapshot و Sync حذف می‌شوند.
- Logout، کلید و تمام داده مالی همان Scope را حذف می‌کند.

---

## ۸. آفلاین و Stale Data

- Dashboard، اسناد و جزئیات در قطع شبکه از SQLite رمزنگاری‌شده خوانده می‌شوند.
- Pagination آفلاین از Repository محلی ادامه می‌یابد.
- نتیجه خالیِ سینک‌شده با «نبود داده آفلاین» اشتباه گرفته نمی‌شود.
- آخرین زمان سینک، `StaleDataBadge` و Banner آفلاین نمایش داده می‌شود.
- تغییر Scope یا مجوز، درخواست‌های قبلی را Abort و داده قبلی را پاک می‌کند.

---

## ۹. فرمت

- مبالغ با `MoneyText` و تومان
- تاریخ‌ها با `PersianDateText`
- اعداد با ارقام فارسی
- RTL در موبایل و وب

---

## ۱۰. تست‌ها

- مجوز و عدم Fallback روی 403/404
- Online Dashboard/Documents/Report
- Offline Cache، Pagination و Stale Data
- Empty Result و تفکیک Cache خالی از نبود داده
- Search، Type، Status و بازه زمانی
- رد تاریخ نامعتبر یا بازه معکوس
- رمزنگاری Payload، Tamper و کلید اشتباه
- Retention و پاک‌سازی Scope
- Logout، Race ذخیره و حذف کلید
- گزارش چندصفحه‌ای و سقف گزارش
- فرمت فارسی و نبود عملیات نوشتن
