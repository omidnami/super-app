# گزارش Audit اولیه سوپراپلیکیشن — STEP-00

> تاریخ: 2026-11-24
>
> وضعیت استپ: **Done**
>
> این گزارش فقط نتیجه بررسی مستندات، سورس مرجع، محیط توسعه و قراردادهای قابل‌استخراج است. هیچ کد محصولی یا وابستگی جدیدی اضافه نشده و هیچ فایلی در `planet/` یا `support-hub/` تغییر نکرده است.

---

## ۱. خلاصه اجرایی

- مسیر مرجع Planet: `/home/omid/Projects/q2b/planet`
- مسیر مرجع Support Hub: `/home/omid/Projects/q2b/support-hub`
- هر دو پوشه فقط برای مطالعه و استخراج قرارداد API هستند و در `.gitignore` نیز قرار گرفته‌اند.
- تمام توسعه سوپراپلیکیشن باید در `apps/`، `packages/`، `features/` و `docs/` انجام شود.
- پروژه Frontend هنوز Initialize نشده و پوشه اصلی فقط مستندات و این دو سورس مرجع دارد.
- Planet یک اپ Laravel 12 با Vue/Inertia و یک Integration کامل Support Hub دارد.
- Support Hub یک relay transport-only با Socket.IO، بدون تاریخچه، اپراتور یا سطح پشتیبانی است.
- APIهای فعلی Support Hub در Planet برای پنل Admin و Session-based هستند؛ برای اپ موبایل/PWA آماده نیستند.
- endpoint فعلی `operator-token` در Planet، Project Token ریشه Hub را فقط به صاحب فروشگاه برمی‌گرداند؛ این توکن نباید به اپ سوپراپ داده شود.
- برای MVP، تغییرات Backend و Hub باید توسط توسعه‌دهنده دیگر انجام شوند. خروجی ما مستند قرارداد و Backend Change Request است.
- عضویت و ورود سراسری وجود ندارد؛ هر سرویس Auth و Session مستقل دارد.
- CRM بدون اتصال به هیچ سرویس قابل‌استفاده است.
- ناوبری اصلی سه‌دکمه‌ای است: سوپرآپ، پیام‌رسان و مدیریت حساب؛ هر مینی‌اپ محیط و رنگ اختصاصی دارد.
- جزئیات امنیتی MVP فعلاً Mock هستند.

---

## ۲. سیاست مرزهای مخزن

### پوشه‌های فقط‌خواندنی

```text
q2b/
├── planet/          # مرجع Planet؛ فقط مطالعه
├── support-hub/     # مرجع Support Hub؛ فقط مطالعه
├── apps/            # توسعه سوپراپ
├── packages/        # پکیج‌های مشترک
├── features/        # ماژول‌های محصول
└── docs/            # مستندات و قراردادها
```

### قواعد غیرقابل نقض

1. هیچ فایلی در `planet/` تغییر نکند.
2. هیچ فایلی در `support-hub/` تغییر نکند.
3. Migration، Test، Format یا Build داخل این دو پوشه اجرا نشود؛ اجرای Test ممکن است فایل موقت یا Cache بسازد.
4. هیچ Secret از `.env` این پوشه‌ها خوانده، کپی یا ثبت نشود.
5. استخراج قرارداد فقط با خواندن Source و Documentation انجام می‌شود.
6. هر تغییر لازم Backend در `docs/backend-change-requests.md` ثبت و به توسعه‌دهنده Backend تحویل داده می‌شود.
7. کد سوپراپ فقط خارج از این دو پوشه توسعه می‌یابد.

---

## ۳. وضعیت فعلی مخزن سوپراپ

### مسیر

```text
/home/omid/Projects/q2b
```

### ساختار فعلی

```text
q2b/
├── .gitignore
├── docs/
│   ├── superapp-mvp.md
│   ├── superapp-work-plan.md
│   ├── implementation-audit.md
│   └── backend-change-requests.md
├── planet/
└── support-hub/
```

### یافته‌ها

| موضوع | وضعیت |
|---|---|
| Git مخزن اصلی | مقداردهی نشده |
| Node.js | `v22.23.1` |
| npm | `10.9.8` |
| Corepack | `0.34.6` |
| package.json سوپراپ | وجود ندارد |
| Lockfile سوپراپ | وجود ندارد |
| Source Code سوپراپ | وجود ندارد |
| Test/Build سوپراپ | وجود ندارد |
| TypeScript / Expo / Vite | در سوپراپ نصب نشده‌اند |
| `.gitignore` | شامل `/planet/` و `/support-hub/` |

### تصمیم مسیر پروژه

**تصمیم:** توسعه در همین مخزن و خارج از پوشه‌های مرجع انجام می‌شود.

دلایل:

- مستندات و سورس مرجع در یک محیط مشترک قرار دارند.
- Monorepo می‌تواند موبایل، PWA و پکیج‌های مشترک را مستقل از Backend توسعه دهد.
- جداسازی با `.gitignore` باعث می‌شود سورس مرجع وارد Commit نشود.

---

## ۴. Package Manager و ساختار هدف

### تصمیم Package Manager

**npm Workspaces**

دلایل:

- Node و npm از قبل در محیط موجودند.
- هیچ lockfile یا Package Manager قبلی برای سوپراپ وجود ندارد.
- راه‌اندازی بدون نصب ابزار اضافی است.
- Expo و Vite با npm پشتیبانی می‌کنند.

pnpm، Yarn و Bun در محیط نصب نیستند و در MVP استفاده نمی‌شوند.

### ساختار هدف

```text
q2b/
├── apps/
│   ├── mobile/
│   └── pwa/
├── packages/
│   ├── ui/
│   ├── design-tokens/
│   ├── domain/
│   ├── api-client/
│   ├── chat-contracts/
│   ├── storage/
│   ├── theme/
│   └── utils/
├── features/
│   ├── chat/
│   ├── shop/
│   ├── accounting/
│   ├── crm/
│   └── settings/
├── docs/
├── package.json
├── tsconfig.base.json
├── eslint.config.js
├── .prettierrc
└── .gitignore
```

### مرز UI

- Design Token، Type، Formatter و منطق Domain مشترک هستند.
- Primitiveهای Native و Web در صورت تفاوت API، Adapter یا پکیج جداگانه دارند.
- اجبار همه کامپوننت‌ها به Cross-Platform بودن توصیه نمی‌شود.

---

## ۵. ابزارهای هدف Frontend

| ابزار | انتخاب هدف | وضعیت فعلی |
|---|---|---|
| زبان | TypeScript Strict | نصب نشده |
| موبایل | React Native + Expo | نصب نشده |
| PWA | React + Vite | نصب نشده |
| استایل PWA | Tailwind CSS | نصب نشده |
| استایل موبایل | NativeWind یا Adapter بر پایه Design Token | انتخاب نهایی در STEP-03 |
| دیتابیس موبایل | Expo SQLite | نصب نشده |
| Lint | ESLint Flat Config | نصب نشده |
| Format | Prettier | نصب نشده |
| تست Shared/PWA | Vitest + React Testing Library | نصب نشده |
| تست Mobile | React Native Testing Library + Runner سازگار Expo | انتخاب نهایی در STEP-02 |
| Build موبایل | Expo / EAS | پیکربندی نشده |
| Build PWA | Vite Production Build | پیکربندی نشده |

هیچ‌کدام در STEP-00 نصب نشده‌اند.

---

## ۶. دستورهای هدف

پس از `STEP-02` باید در Root موجود باشند:

```bash
npm install
npm run dev
npm run dev:mobile
npm run dev:pwa
npm run lint
npm run typecheck
npm run test
npm run test:mobile
npm run test:pwa
npm run build
npm run build:mobile
npm run build:pwa
```

در وضعیت فعلی این دستورها قابل اجرا نیستند.

---

## ۷. محیط توسعه و Build Native

| موضوع | وضعیت |
|---|---|
| سیستم‌عامل | Linux |
| PHP | `8.3.6` |
| Composer | `2.10.2` |
| Python | `3.12.3` |
| Java | نصب نیست |
| Android SDK / ANDROID_HOME | تنظیم نشده |
| adb | نصب نیست |
| Watchman | نصب نیست |
| Xcode | روی Linux در دسترس نیست |

پیامدها:

- توسعه TypeScript و Expo Go ممکن است.
- Build محلی Android آماده نیست.
- Build iOS روی Linux ممکن نیست؛ نیاز به macOS/Xcode یا EAS Build است.
- این موارد در STEP-00 نصب یا تغییر داده نشده‌اند.

پیشنهاد: استفاده از EAS Build برای خروجی Native، مگر اینکه Toolchain محلی در اختیار تیم باشد.

---

## ۸. Audit سورس مرجع Planet

### مسیر

```text
/home/omid/Projects/q2b/planet
```

### هویت فنی

- Laravel 12
- PHP 8.2+
- Vue 3 + Inertia
- Vite
- Tailwind CSS
- Sanctum در Composer وجود دارد، اما در کد بررسی‌شده `HasApiTokens` یا API Token Flow پیدا نشد.
- پشتیبانی از RTL و Design Token در پنل وجود دارد.
- دستورهای موجود: `composer run dev`، `composer run test`، `npm run dev`، `npm run build`.

### Integration موجود Support Hub

فایل‌های کلیدی:

```text
app/Models/SupportHubConversation.php
app/Models/SupportHubMessage.php
app/Services/SupportHub/SupportHubChat.php
app/Services/SupportHub/SupportHubClient.php
app/Services/SupportHub/SupportHubSettings.php
app/Services/SupportHub/SupportHubAttachmentStore.php
app/Http/Controllers/Admin/SupportHubController.php
app/Http/Controllers/Admin/SupportHubChatController.php
app/Http/Controllers/Api/SupportHubWebhookController.php
routes/support_hub.php
config/support_hub.php
database/migrations/2026_11_23_120000_create_support_hub_chat_tables.php
database/migrations/2026_11_23_130000_add_delivery_status_to_support_hub_messages.php
resources/js/Pages/admin/SupportHub/Live.vue
```

### قابلیت‌های موجود

- ذخیره Conversation و Message در دیتابیس Planet
- Dedup با `dedupe_key` و `delivery_id`
- دریافت webhook امضاشده `chat.offline`
- ثبت پیام اپراتور پیش از ارسال به Hub
- وضعیت `pending`، `sent`، `failed`
- آپلود فایل و ویس در Planet
- Proxy دریافت فایل از Hub با Project Token سمت سرور
- فهرست و تاریخچه گفتگو برای پنل Admin
- اتصال پنل Admin به Hub با Project Token
- endpoint صدور Project Token فقط برای صاحب فروشگاه

### APIهای فعلی پنل Admin

| متد | مسیر | کاربرد | Auth فعلی |
|---|---|---|---|
| POST | `/admin/support-hub/operator-token` | دریافت Project Token ریشه Hub | Admin Session + مجوز settings |
| GET | `/admin/support-hub/conversations` | فهرست گفتگوها | Admin Session + tickets |
| GET | `/admin/support-hub/conversations/{id}/messages?before=` | تاریخچه پیام | Admin Session + tickets |
| POST | `/admin/support-hub/messages` | ذخیره پیام | Admin Session + tickets write |
| POST | `/admin/support-hub/messages/{id}/status` | تغییر وضعیت تحویل | Admin Session + tickets write |
| POST | `/admin/support-hub/attachments` | آپلود فایل | Admin Session + tickets write |
| GET | `/admin/support-hub/files` | Proxy فایل Hub | Admin Session + tickets read |
| POST | `/api/support-hub/webhook` | دریافت پیام آفلاین Hub | HMAC |

این APIها برای اپ موبایل/PWA مناسب نیستند، چون Session/Inertia محورند و برای یک Client خارجی Token API پایدار ندارند.

### مدل داده موجود

`support_hub_conversations`:

- `id`
- `source`
- `robot_id`
- `channel_chat_id`
- `user_id`
- `last_message_preview`
- `last_message_at`
- `created_at` / `updated_at`

`support_hub_messages`:

- `id`
- `conversation_id`
- `sender`
- `delivery_status`
- `admin_id`
- `customer_id`
- `text`
- `file`
- `sent_at_ms`
- `dedupe_key`
- `delivery_id`
- `created_at` / `updated_at`

### محدودیت‌های فعلی Planet برای سوپراپ

- API موبایل با Token/Refresh Token وجود ندارد.
- Connection Ticket سطح‌بندی‌شده وجود ندارد؛ فقط Project Token ریشه صادر می‌شود.
- سطوح پشتیبانی و Assignment در مدل Conversation وجود ندارد.
- Delta Sync با cursor یا `updated_after` وجود ندارد؛ فهرست با Page و پیام با `before id` کار می‌کند.
- Tombstone یا `deleted_at` برای Conversation/Message وجود ندارد.
- Attachment ID پایدار وجود ندارد؛ فایل با URL و metadata نمایش داده می‌شود.
- APIهای موبایل فروشگاه و حسابداری در این Audit بررسی و تأیید نشده‌اند.

---

## ۹. Audit سورس مرجع Support Hub

### مسیر

```text
/home/omid/Projects/q2b/support-hub
```

### هویت فنی

- Python 3.12
- Socket.IO v4
- aiohttp
- MariaDB/MySQL
- Redis اختیاری برای Metadata Cache
- Hub و Bale Service تک‌نمونه

### قابلیت‌های موجود

- اتصال اپراتور با Project Token
- اتصال Client با امضای کوتاه‌عمر
- اتصال Bridge بله
- اتاق `project:{project_id}`
- قرارداد هفت‌فیلدی پیام
- webhook امضاشده وقتی هیچ اپراتوری آنلاین نیست
- File Resolver با Project Token
- Rate Limit و محدودیت پیام

### محدودیت‌های تأییدشده

- Hub تاریخچه، اپراتور، سطح پشتیبانی و Assignment ندارد.
- Hub Connection Ticket را نمی‌پذیرد.
- Hub شناسه canonical پیام در قرارداد هفت‌فیلدی ندارد.
- webhook فقط حالت آفلاین را پوشش می‌دهد.
- فایل دائماً در Hub ذخیره نمی‌شود.
- دریافت فایل با Project Token است.
- ارسال Voice جدید بله و تبدیل صوت محدودیت دارد.
- Hub چندپروسه‌ای بدون Redis Socket.IO Adapter نیست.

---

## ۱۰. نتیجه تطبیق Planet و Hub

### جریان فعلی پنل وب

```text
اپراتور → Planet Admin API → ذخیره Message با شناسه و admin_id
        → Hub Socket → تحویل Real-Time
        → Planet API → ثبت وضعیت sent/failed

مشتری → Hub → اگر اپراتور آنلاین:
                 Hub emit → پنل وب → Planet Admin API → ذخیره Message
              اگر اپراتور آفلاین:
                 webhook امضاشده → Planet → ذخیره Message
```

### پیامد برای سوپراپ

- اپ موبایل می‌تواند الگوی «ذخیره در Planet ثم ارسال Hub» را تکرار کند، اما API موبایل معتبر لازم است.
- برای History کامل، هر پیام زنده باید در Planet ثبت شود؛ اتکا به Hub کافی نیست.
- چون Hub شناسه پیام ندارد، Planet باید Message ID canonical ایجاد کند و اپ پیام زنده را با همان رکورد dedup کند.
- Connection Ticket باید در Hub توسط تیم Hub اضافه شود.
- Surfaceهای Admin فعلی باید به API Token-based برای Mobile/PWA تبدیل یا تکامل پیدا کنند.

---

## ۱۱. Blockerهای ثبت‌شده

| ID | Blocker / ریسک | شاهد | استپaffected | وضعیت |
|---|---|---|---|---|
| BLK-02 | Hub فعلی Connection Ticket را نمی‌پذیرد؛ MVP با Mock پیش می‌رود | Auth اپراتور فقط Project Token است | STEP-B01، STEP-06 | Deferred / Mock in MVP |
| BLK-03 | ثبت کامل پیام‌های زنده در Planet برای موبایل تأیید نشده | پنل وب پیام را از UI ثبت می‌کند؛ Hub خودش ذخیره نمی‌کند | STEP-B02، STEP-07، STEP-11 | Open |
| BLK-04 | سطوح پشتیبانی و Assignment در Planet/Hub وجود ندارد | مدل Conversation فاقد level و assignee است | STEP-B01، STEP-12 | Confirmed |
| BLK-05 | پیام زنده Hub شناسه canonical ندارد | قرارداد هفت‌فیلدی فاقد `message_id` است | STEP-B02، STEP-07 | Confirmed؛ Planet ID دارد |
| BLK-06 | API موبایل برای Attachment/File و Voice آماده نیست؛ MVP با Mock پیش می‌رود | APIهای فعلی Admin Session محورند | STEP-B03، STEP-10 | Deferred / Mock in MVP |
| BLK-07 | Toolchain Build Native آماده نیست | Java، Android SDK، adb و Xcode در دسترس نیستند | STEP-18 | Open |
| BLK-08 | Retention و سیاست خروج از حساب مشخص نیست | در MVP Open Decision است | STEP-07، STEP-11، STEP-13، STEP-14 | Open |
| BLK-09 | Auth API واقعی موبایل/PWA وجود ندارد؛ MVP با Mock پیش می‌رود | Sanctum نصب است اما Flow Token در کد پیدا نشد | STEP-05، STEP-06، STEP-16 | Deferred / Mock in MVP |

BLK-01 مربوط به ابهام checkout Planet بود و با تعیین مسیر مرجع `./planet` **Resolved** شده است.

---

## ۱۲. سؤال‌های باز

این موارد پاسخ داده نشده‌اند و حدس زده نشده‌اند:

1. اپلیکیشن فقط برای اپراتور است یا مشتری هم چت دارد؟
2. سطوح پشتیبانی دقیقاً چه هستند و آیا داده‌های هر سطح باید مخفی بماند؟
3. Ticket با Signature مشترک یا Introspection Planet اعتبارسنجی شود؟
4. عمر Ticket و سیاست Refresh/Revoke چیست؟
5. آیا Hub باید Room سطح‌بندی‌شده بسازد یا همه اپراتورهای پروژه همه گفتگوها را می‌بینند؟
6. مسیر ingest همه پیام‌ها در Planet از قبل وجود دارد یا باید به سمت سرور منتقل شود؟
7. ارسال ویس روی بله در MVP ضروری است؟
8. پخش ویس و فایل آفلاین لازم است یا فقط metadata؟
9. داده آفلاین فروشگاه و حسابداری برای چه بازه‌ای نگهداری شود؟
10. خروج از حساب، Cache را پاک کند یا نسخه رمزنگاری‌شده حفظ شود؟
11. هر کاربر به یک فروشگاه دسترسی دارد یا چند فروشگاه؟
12. فرمت Backup/Export CRM چیست؟
13. رنگ قابل‌تنظیم فقط رنگ برند است یا Surfaceها هم قابل‌شخصی‌سازی هستند؟
14. وضعیت نهایی تحویل پیام نمایش داده شود یا فقط «ارسال‌شده به سرور»؟
15. APIهای فقط‌خواندنی فروشگاه و حسابداری برای Mobile کدام مسیرها هستند؟
16. جای‌گذاری CRM در محیط سوپرآپ تأیید می‌شود یا مینی‌اپ جداگانه‌ای لازم است؟

---

## ۱۳. تصمیم‌های اولیه ثبت‌شده

| موضوع | تصمیم Audit |
|---|---|
| مسیر پروژه | ادامه در `/home/omid/Projects/q2b` |
| سورس مرجع Planet | `./planet`؛ فقط‌خواندنی |
| سورس مرجع Hub | `./support-hub`؛ فقط‌خواندنی |
| Package Manager | npm Workspaces |
| Mobile | Expo + React Native + TypeScript |
| PWA | React + Vite + TypeScript |
| Database | Expo SQLite در موبایل |
| Theme | روشن/تاریک/سیستم + رنگ برند قابل‌تنظیم |
| Auth | بدون ورود سراسری؛ Auth و Session مستقل هر سرویس |
| امنیت MVP | Mock تا تأیید قرارداد نهایی |
| CRM | محلی، بدون Auth یا اتصال به هیچ سرویس |
| ناوبری | سه دکمه: سوپرآپ، پیام‌رسان، مدیریت حساب |
| مینی‌اپ‌ها | محیط مستقل و رنگ اختصاصی برای هر مقصد |
| UI | Design Token مشترک؛ Primitiveها در صورت نیاز Platform-specific |
| تست Shared/PWA | Vitest + React Testing Library |
| تست Mobile | React Native Testing Library با Runner سازگار Expo |
| Build Native | EAS یا Toolchain محلی؛ تصمیم نهایی پیش از Release |
| Backend | Planet؛ تغییرات فقط از طریق Backend Change Request |
| Real-Time | Support Hub؛ Ticket باید توسط تیم Hub اضافه شود |
| Offline | فقط‌خواندنی؛ بدون Outbox |

---

## ۱۴. گزارش STEP-00

```text
STEP-ID: STEP-00
عنوان: Audit مخزن و قفل تصمیم‌های اولیه
وضعیت: Done
زمان صرف‌شده: یک جلسه Audit و تطبیق سورس مرجع
فایل‌های تغییرکرده:
- docs/implementation-audit.md
- docs/backend-change-requests.md
- docs/superapp-work-plan.md

تست‌های اجراشده:
- بررسی وجود فایل‌های Package/Config
- بررسی Node، npm، Corepack، Python، PHP و Composer
- خواندن سورس و مستندات Planet و Support Hub
- استخراج API، مدل داده و محدودیت‌های موجود

نتیجه Build:
- اجرا نشد؛ پروژه Frontend هنوز Initialize نشده و STEP-00 نباید کد محصولی اضافه کند.
- Test داخل planet/ و support-hub/ اجرا نشد؛ این پوشه‌ها فقط‌خواندنی هستند.

Issues باقی‌مانده:
- API موبایل و Connection Ticket نیازمند تغییر Backend/Hub است.
- سطوح پشتیبانی و Delta Sync هنوز طراحی نشده‌اند.
- Toolchain Native در این محیط آماده نیست.

Blockerها:
- BLK-02 تا BLK-09 در بخش ۱۱ ثبت شده‌اند.

استپ بعدی:
- STEP-01: نهایی‌سازی قرارداد API موبایل و Mock داده‌ها، بر اساس Backend Change Requests
```

---

## ۱۵. معیار پذیرش STEP-00

- [x] وضعیت فعلی پروژه دقیق مستند شده است.
- [x] مسیر پروژه و Package Manager مشخص شده است.
- [x] ابزارهای موجود و ناقص فهرست شده‌اند.
- [x] دستورهای نصب، اجرا، تست و Build هدف مشخص شده‌اند.
- [x] مسیر مرجع Planet و Support Hub تأیید و فقط‌خواندنی اعلام شده است.
- [x] APIها و مدل‌های موجود از سورس مرجع استخراج شده‌اند.
- [x] Blockerهای MVP ثبت شده‌اند.
- [x] سؤال‌های باز بدون حدس ثبت شده‌اند.
- [x] هیچ فایلی در `planet/` یا `support-hub/` تغییر نکرده است.
- [x] هیچ کد محصولی یا وابستگی جدیدی اضافه نشده است.
