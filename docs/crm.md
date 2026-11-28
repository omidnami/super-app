# CRM محلی سوپرآپ

STEP-15 یک CRM شخصی و کاملاً محلی به محیط «سوپرآپ» اضافه می‌کند. این ماژول به Auth پیام‌رسان یا مدیریت حساب، Hub، Planet، Analytics و Crash Report وابسته نیست و هیچ درخواست شبکه یا Sync Job ندارد.

## قابلیت‌ها

- CRUD مخاطب، برچسب، یادداشت، وظیفه و تعامل در SQLite
- جست‌وجوی نام، تلفن، ایمیل و برچسب؛ فیلتر برچسب و وضعیت کار
- صفحه‌بندی مخاطبین در Repository و بارگذاری همهٔ صفحه‌ها در رابط موبایل
- حذف نرم مخاطب و حذف وابستهٔ یادداشت‌ها، کارها و تعامل‌های او
- حذف برچسب از همهٔ مخاطبین در یک Transaction
- قفل محلی PIN و Export/Import رمزنگاری‌شده با تأیید PIN
- حالت‌های Loading، Empty، Error و Toast، رابط فارسی RTL و کنترل‌های دسترس‌پذیر

## داده و ایزوله‌سازی

- دیتابیس موبایل: `superapp.db` و جداول موجود `crm_contacts`، `crm_tags`، `crm_notes`، `crm_tasks` و `crm_interactions`
- فضای شخصی پیش‌فرض دستگاه: `local-personal`
- همهٔ Query و Mutationهای `CrmRepository` با `owner_id` محدود می‌شوند.
- رکوردهای حذف‌شده در List، Get و Export ظاهر نمی‌شوند.
- Import فقط رکوردهای همان مالک را می‌پذیرد؛ شناسه‌های تکراری یا مراجع مخاطب/برچسب نامعتبر باعث Rollback کامل می‌شوند.
- تاریخ‌های ایجاد/به‌روزرسانی و موعد/زمان تعامل به ISO UTC تبدیل می‌شوند تا Backup قابل اعتبارسنجی باشد.
- خروج از پیام‌رسان یا مدیریت حساب دادهٔ CRM را پاک یا افشا نمی‌کند.

## قفل PIN

- رکورد قفل در `expo-secure-store` با سرویس `superapp.crm` و سیاست `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` نگهداری می‌شود.
- کلید ذخیره‌سازی از SHA-256 شناسهٔ مالک ساخته می‌شود؛ PIN خام هرگز ذخیره نمی‌شود.
- PIN باید ۴ تا ۸ رقم باشد.
- Hash با PBKDF2-HMAC-SHA256، ۲۴۰٬۰۰۰ تکرار، Salt ۱۶ بایتی و خروجی ۳۲ بایتی ساخته می‌شود.
- مقایسهٔ Hash ثابت‌زمان است. قفل‌کردن دستی، State و دادهٔ در حافظهٔ CRM را پاک می‌کند.

## Backup امن

Export فقط با ورود PIN فعلی و اقدام کاربر انجام می‌شود. متن Dataset پیش از نوشتن فایل با AES-256-GCM رمزنگاری می‌شود:

- KDF: PBKDF2-HMAC-SHA256 با ۲۴۰٬۰۰۰ تکرار
- Salt: ۱۶ بایت، IV: ۱۲ بایت، Tag احراز اصالت: ۱۶ بایت
- AAD: `format`، `version` و `owner_id` Envelope
- فرمت Dataset: `superapp.crm.backup` نسخهٔ ۱
- فرمت Envelope: `superapp.crm.backup.encrypted` نسخهٔ ۱

Envelope شامل فیلدهای `format`، `version`، `owner_id`، `kdf`، `iterations`، `salt`، `iv` و `ciphertext` است. فایل موقت فقط در Cache دستگاه نوشته و پس از پایان اشتراک‌گذاری حذف می‌شود. متن رمزنگاری‌شده در UI نمایش داده نمی‌شود.

Import فایل را با PIN فعلی احراز و decrypt می‌کند؛ Dataset، مالک، تاریخ‌ها، شناسه‌ها، نوع تعامل و مراجع مخاطب/برچسب پیش از نوشتن اعتبارسنجی می‌شوند. Import یک عملیات Merge است: رکوردهای Backup به داده‌های فعلی مالک اضافه می‌شوند و داده‌های موجود حذف نمی‌شوند؛ برخورد شناسه باعث رد کل Import می‌شود.

## محدودیت‌های MVP

- Biometric در این استپ پیاده نشده است؛ قفل PIN پیاده‌سازی شده است.
- دیتابیس SQLite با رمزنگاری at-rest جداگانه محافظت نشده است؛ امنیت دستگاه و قفل PIN لایه‌های محافظت این MVP هستند.
- فراموشی PIN امکان بازکردن دادهٔ محلی را نمی‌دهد؛ Backup رمزنگاری‌شده نیز به همان PIN نیاز دارد.
- CRM چندکاربره، سینک سرور و PWA Persistent CRM در این استپ وجود ندارند.

## تست و اجرا

- تست‌های Repository و امنیت: `apps/pwa/src/crm/repository.test.ts` و `apps/pwa/src/crm/security.test.ts`
- تست‌های Runtime، Hook، فایل Backup، UI و دسترسی بدون Auth/Network: `apps/mobile/src/crm/` و `apps/mobile/App.test.tsx`
- اجرای موبایل: `npm run start --workspace @superapp/mobile -- --port 8081 --host lan`
- Build: `npm run build`
