# برنامه اجرایی و پرامپت‌های استپ‌به‌استپ سوپراپلیکیشن

> همراه مستند معماری: [`superapp-mvp.md`](./superapp-mvp.md)
>
> نسخه: 1.0
>
> تاریخ ایجاد: 2026-11-24
>
> هدف: اجرای سریع، قابل‌ردیابی و قابل‌تست MVP؛ هر استپ یک پرامپت مستقل دارد و باید پس از اتمام، وضعیت و گزارش آن در همین فایل ثبت شود.

---

## ۱. روش استفاده از این فایل

1. قبل از هر استپ، مستند `superapp-mvp.md` و پرامپت همان استپ را بخوان.
2. فقط یک استپ را هم‌زمان روی یک Branch/Workspace اجرا کن، مگر اینکه استپ‌ها واقعاً مستقل باشند.
3. پس از هر استپ:
   - تست‌ها و Build را اجرا کن.
   - چک‌باکس استپ را فقط در صورت موفقیت به `[x]` تغییر بده.
   - گزارش کوتاه را در بخش «لاگ اجرا» ثبت کن.
   - فایل‌های تغییرکرده، تست‌ها، Issues باقی‌مانده و استپ بعدی را بنویس.
4. استپ را در حالت زیر نگه دار:

```text
[ ] شروع نشده
[~] در حال اجرا
[!] مسدود
[x] تمام‌شده
```

در Markdown استاندارد، برای تیک نهایی از `- [x]` استفاده کن.

5. هیچ استپی با Test شکست‌خورده، Build شکست‌خورده یا Blocker حل‌نشده `Done` نمی‌شود.
6. Commit فقط در صورت درخواست صریح کاربر انجام شود.

---

## ۲. داشبورد پیشرفت

### وضعیت کلی

- کل استپ‌ها: **۲۲**
- تمام‌شده: **۹**
- در حال اجرا: **۰**
- مسدود فعال: **۰**
- باقی‌مانده: **۱۳**
- درصد پیشرفت: **۴۰٫۹٪**
- Blockerهای ثبت‌شده: **۱۰**
- Blockerهای باز: **۶**
- Blockerهای Resolved: **۱**
- Blockerهای Deferred/Mock در MVP: **۳**

فرمول:

```text
پیشرفت = تعداد استپ‌های Done ÷ 22 × 100
```

### فهرست استپ‌ها

| ID | استپ | وابستگی | مسیر موازی | زمان نسبی | وضعیت |
|---|---|---|---|---|---|
| STEP-00 | Audit مخزن و قفل تصمیم‌های اولیه | ندارد | همه | ۰٫۵ روز | [x] |
| STEP-01 | قرارداد API و Mock داده‌ها | STEP-00 | Backend | ۱–۲ روز | [x] |
| STEP-B01 | سند تغییر Hub برای Connection Ticket | STEP-01 | Backend Handoff | ۱ روز | [ ] |
| STEP-B02 | سند Ingest کامل و Message ID در Planet | STEP-01 | Backend Handoff | ۱ روز | [ ] |
| STEP-B03 | سند API امن Attachment/File/Voice | STEP-01 | Backend Handoff | ۱ روز | [ ] |
| STEP-02 | ساخت Monorepo و اپ‌های Mobile/PWA | STEP-00 | Foundation | ۱ روز | [x] |
| STEP-03 | Design Tokens، تم و رنگ قابل‌تنظیم | STEP-02 | UI | ۱ روز | [x] |
| STEP-04 | UI Kit و App Shell | STEP-03 | UI | ۱–۲ روز | [x] |
| STEP-05 | Mock Auth مستقل سرویس‌ها و Session Boundaries | STEP-02 | Auth | ۱ روز | [x] |
| STEP-06 | Hub Client و مدیریت اتصال | STEP-05 + STEP-B01 | Chat | ۱–۲ روز | [x] |
| STEP-07 | SQLite، Repository و Sync Core | STEP-01 + STEP-B02 | Chat / Offline | ۱–۲ روز | [x] |
| STEP-08 | صف گفتگوها و فیلترها | STEP-04 + STEP-06 | Chat | ۱ روز | [x] |
| STEP-09 | صفحه چت، متن، ایموجی و Real-Time | STEP-07 + STEP-08 | Chat | ۱–۲ روز | [ ] |
| STEP-10 | فایل، ویس و رسانه | STEP-09 + STEP-B03 | Chat / Media | ۱–۲ روز | [ ] |
| STEP-11 | تاریخچه آفلاین و Backlog Reconciliation | STEP-07 + STEP-09 | Offline | ۱–۲ روز | [ ] |
| STEP-12 | سطوح پشتیبانی، تخصیص و وضعیت گفتگو | STEP-08 + STEP-09 | Chat | ۱ روز | [ ] |
| STEP-13 | ماژول فروشگاه فقط‌خواندنی | STEP-03 + STEP-04 + STEP-07 | Business | ۱–۲ روز | [ ] |
| STEP-14 | ماژول حسابداری فقط‌خواندنی | STEP-03 + STEP-04 + STEP-07 | Business | ۱–۲ روز | [ ] |
| STEP-15 | CRM کاملاً محلی | STEP-03 + STEP-04 | CRM | ۱–۲ روز | [ ] |
| STEP-16 | PWA آنلاین | STEP-04 + STEP-05 + APIها | PWA | ۱–۲ روز | [ ] |
| STEP-17 | Hardening امنیت، عملکرد و دسترس‌پذیری | همه ماژول‌ها | QA | ۱–۲ روز | [ ] |
| STEP-18 | E2E، Release Checklist و خروجی نهایی | STEP-17 | Release | ۱–۲ روز | [ ] |

زمان‌ها تقریبی‌اند و شامل زمان انتظار تیم Backend نیستند. با اجرای موازی مسیرهای Backend، UI، CRM و Business، زمان کل می‌تواند به طور محسوسی کمتر شود.

---

## ۳. مسیرهای اجرای موازی

```text
مسیر اصلی محصول:
STEP-00 → STEP-01 → STEP-02 → STEP-03 → STEP-04 → STEP-05
        → STEP-06 → STEP-08 → STEP-09 → STEP-11 → STEP-12
        → STEP-17 → STEP-18

مسیر Backend:
STEP-01 → STEP-B01
        → STEP-B02
        → STEP-B03

مسیر Offline/Data:
STEP-01 → STEP-07 → STEP-11 → STEP-13 → STEP-14

مسیر CRM:
STEP-03 → STEP-04 → STEP-15

مسیر PWA:
STEP-03 → STEP-04 → STEP-05 → STEP-16
```

### ترتیب سریع پیشنهادی

1. هم‌زمان `STEP-01`، `STEP-B01`، `STEP-B02` و `STEP-B03` را شروع کن.
2. هم‌زمان `STEP-02` و `STEP-03` را اجرا کن.
3. پس از آماده‌شدن UI Kit، `STEP-08`، `STEP-13`، `STEP-14` و `STEP-15` را بین دو یا سه توسعه‌دهنده تقسیم کن.
4. Chat را به‌عنوان Critical Path پیش ببر.
5. رسانه را بعد از Chat متنی پیاده کن؛ رسانه نباید جلو افتادن نسخه متنی را متوقف کند.
6. آفلاین را فقط بعد از آماده‌شدن Message ID و Backlog API بساز.
7. PWA را پس از پایدارشدن Design System و Auth بساز.
8. آخرین دو استپ را برای امنیت، تست و Release خالی بگذار.

---

## ۴. قواعد موجود در همه پرامپت‌ها

هر پرامپت باید با این قواعد اجرا شود:

- Persian RTL پیش‌فرض است.
- عضویت و ورود سراسری وجود ندارد؛ هر سرویس Auth و Session مستقل دارد.
- CRM بدون اتصال به هیچ سرویس قابل‌استفاده است.
- ناوبری اصلی سه‌دکمه‌ای است: سوپرآپ، پیام‌رسان و مدیریت حساب؛ هر مینی‌اپ محیط و رنگ اختصاصی دارد.
- جزئیات امنیتی MVP فعلاً Mock هستند.
- TypeScript Strict فعال است.
- رنگ خام در کامپوننت hard-code نمی‌شود.
- `PROJECT_TOKEN` هرگز وارد اپ، PWA، SQLite یا localStorage نمی‌شود.
- Hub فقط Transport است؛ تاریخچه و اپراتور از Planet می‌آید.
- قرارداد هفت‌فیلدی پیام Hub تغییر نمی‌کند.
- کامپوننت‌ها Presentational و قابل‌استفاده مجدد هستند.
- هر صفحه حالت Loading، Empty، Error و Offline دارد.
- داده حساس در لاگ ثبت نمی‌شود.
- تست مرتبط و Build باید پاس شوند.
- `planet/` و `support-hub/` فقط‌خواندنی هستند؛ هیچ فایل، Migration، Test یا Build داخل آن‌ها اجرا نمی‌شود.
- استپ‌های `STEP-B01` تا `STEP-B03` در این پروژه فقط تهیه قرارداد و سند تحویل به تیم Backend هستند، نه پیاده‌سازی در سورس مرجع.
- وضعیت استپ و گزارش آن در `superapp-work-plan.md` به‌روز می‌شود.

---

# ۵. پرامپت‌های اجرایی

## STEP-00 — Audit مخزن و قفل تصمیم‌های اولیه

**وابستگی:** ندارد
**خروجی:** گزارش Audit، ساختار هدف، دستورات اجرا و فهرست Blockerها
**زمان نسبی:** ۰٫۵ روز

- [x] **STEP-00 تمام شد**

### پرامپت اجرا

```text
نقش شما توسعه‌دهنده و معمار فنی پروژه سوپراپلیکیشن است.

قبل از هر کار:
1. docs/superapp-mvp.md را بخوان.
2. docs/superapp-work-plan.md را بخوان.
3. ساختار مخزن فعلی، package manager، اسکریپت‌ها، تنظیمات TypeScript، تست و محیط توسعه را بررسی کن.

هدف این استپ فقط Audit و ثبت تصمیم‌های اولیه است؛ هیچ قابلیت محصولی پیاده نکن.

کارها:
- مشخص کن پروژه در همین مخزن ادامه پیدا می‌کند یا مخزن جدید لازم است.
- ساختار Monorepo پیشنهادی را با وضعیت فعلی تطبیق بده.
- ابزارهای موجود و ناقص را فهرست کن: Expo، React Native، Vite، Tailwind/NativeWind، ESLint، Prettier، Jest/Vitest، Testing Library و TypeScript.
- دستورهای نصب، اجرا، تست و Build هدف را مشخص کن.
- دسترسی لازم به مخزن Planet و Support Hub و وضعیت آن‌ها را ثبت کن.
- Blockerهای شناخته‌شده را از مستند MVP استخراج کن.
- اگر تصمیم محصولی نامشخصی مانده، آن را در بخش سؤال‌های باز ثبت کن و حدس نزن.

خروجی:
- docs/implementation-audit.md
- به‌روزرسانی داشبورد و لاگ در docs/superapp-work-plan.md

معیار پذیرش:
- وضعیت فعلی پروژه دقیق مستند شده باشد.
- مسیر پروژه و package manager مشخص باشد.
- هیچ فرض پنهانی درباره Backend یا Hub باقی نماند.
- هیچ کد محصولی نوشته نشده باشد.
```

---

## STEP-01 — قرارداد API و Mock داده‌ها

**وابستگی:** STEP-00
**خروجی:** قرارداد TypeScript/OpenAPI، fixtureها و Mock API
**زمان نسبی:** ۱–۲ روز

- [x] **STEP-01 تمام شد**

### پرامپت اجرا

```text
هدف: قراردادهای لازم MVP را دقیق کن تا توسعه Frontend منتظر Backend نماند.

مستندهای docs/superapp-mvp.md و مستندات Support Hub را مبنا بگیر.

کارها:
- قرارداد Auth مستقل سرویس پیام‌رسان و مدیریت حساب را ثبت کن؛ Auth سراسری وجود ندارد.
- جزئیات امنیتی MVP را به‌صورت Mock تعریف کن و قرارداد Production را جدا مستند کن.
- قرارداد POST /api/chat/connection-ticket را با Claimهای project_id، operator_id، support_level، allowed_sources و expires_at تعریف کن.
- مدل canonical Conversation و Message در Planet را تعریف کن؛ Hub همچنان پیام هفت‌فیلدی دارد.
- APIهای گفتگو، Backlog، تخصیص، ارتقا و تغییر وضعیت را تعریف کن.
- قرارداد cursor سینک، حذف رکورد و صفحه‌بندی را مشخص کن.
- APIهای فقط‌خواندنی فروشگاه و حسابداری را ثبت کن.
- قرارداد Proxy فایل Planet را مشخص کن.
- برای هر endpoint نمونه Success و Error بساز.
- Fixture فارسی برای Conversation، Message، Order، Product و Accounting Document بساز.
- یک Mock API یا MSW handlerها بساز تا اپ بدون Backend واقعی توسعه پیدا کند.

خروجی:
- docs/api-contract.md
- packages/chat-contracts
- packages/api-client/mocks
- fixtureهای تست

معیار پذیرش:
- Frontend می‌تواند Auth، Ticket، Conversation، Message، Shop و Accounting را با Mock consume کند.
- هیچ Project Token Hub در قرارداد اپ وجود ندارد.
- مدل Message شناسه canonical و client_mutation_id دارد.
- سناریوهای 401، 403، 409، 422 و Network Error مستند شده‌اند.
```

---

## STEP-B01 — سند تغییر Hub برای Connection Ticket

**وابستگی:** STEP-01
**مسیر:** Backend Handoff
**خروجی:** قرارداد دقیق Ticket، قواعد احراز هویت و معیار تحویل به تیم Hub

- [ ] **STEP-B01 تمام شد**

### پرامپت اجرا

```text
هدف: تهیه سند تغییر موردنیاز Support Hub برای پذیرش Connection Ticket، بدون تغییر فایل‌های ./support-hub.

قبل از کار:
- docs/backend-change-requests.md را بخوان.
- سورس مرجع ./support-hub را فقط مطالعه کن.
- هیچ فایل، Test، Migration یا Config داخل ./support-hub تغییر نکن.

کارها:
- احراز هویت فعلی operator با PROJECT_TOKEN را به‌عنوان Baseline ثبت کن.
- قرارداد auth: { connection_token: "..." } را برای تیم Hub تعریف کن.
- Claimهای iss، aud، sub، project_id، support_level، allowed_sources، iat، exp و jti را مشخص کن.
- قواعد Signature یا Introspection را با مزایا و ریسک‌ها مستند کن.
- سناریوهای Expired، Bad Signature، Wrong Project، Wrong Scope و Revoked را بنویس.
- قواعد Room یا Subscription سطح‌بندی‌شده را در صورت نیاز تعریف کن.
- تأکید کن Ticket فقط برای Socket.IO اپراتور است و در REST APIهای حساس Hub کار نمی‌کند.
- نمونه‌های غیرمحرمانه Ticket و Error Response را برای Frontend آماده کن.
- خروجی را به docs/backend-change-requests.md و در صورت نیاز docs/api-contract.md اضافه کن.

معیار پذیرش:
- سند برای توسعه‌دهنده Hub کافی برای پیاده‌سازی و تست است.
- هیچ Project Token در قرارداد Client وجود ندارد.
- رفتار backward-compatible توصیف شده است.
- هیچ فایلی در ./support-hub تغییر نکرده است.
```

---

## STEP-B02 — سند Ingest کامل و Message ID در Planet

**وابستگی:** STEP-01
**مسیر:** Backend Handoff
**خروجی:** قرارداد Ingest، Idempotency، Message ID و Delta Sync برای تیم Planet

- [ ] **STEP-B02 تمام شد**

### پرامپت اجرا

```text
هدف: مستند کردن تغییرات موردنیاز Planet برای ذخیره کامل پیام‌ها و ارائه تاریخچه قابل‌سینک، بدون تغییر ./planet.

قبل از کار:
- docs/backend-change-requests.md را بخوان.
- مدل‌ها، Service، Controller، Migration و Live.vue در ./planet را فقط مطالعه کن.
- الگوی فعلی «ذخیره در Planet ثم ارسال Hub» و webhook آفلاین را Baseline ثبت کن.

کارها:
- مسیر Server-side Ingest برای همه پیام‌های زنده و آفلاین را پیشنهاد بده.
- جریان Fallback با client_mutation_id را برای ارسال اپراتور مستند کن.
- ایجاد message_id canonical در Planet را مشخص کن.
- قواعد Dedup با delivery_id، dedupe_key و client_mutation_id را بنویس.
- ترتیب پیام و Conversation را بر اساس sent_at_ms و id تعریف کن.
- API Delta Sync با cursor، upsert و tombstone را طراحی کن.
- سناریوهای A آنلاین/B آفلاین، ACK گم‌شده، Duplicate و Restart را بنویس.
- تأکید کن قرارداد هفت‌فیلدی Hub تغییر نمی‌کند.
- خروجی را در docs/backend-change-requests.md و docs/api-contract.md ثبت کن.

معیار پذیرش:
- سند برای توسعه‌دهنده Planet کافی برای پیاده‌سازی است.
- History کامل و Dedup قابل‌تست توصیف شده‌اند.
- هیچ فایلی در ./planet یا ./support-hub تغییر نکرده است.
```

---

## STEP-B03 — سند API امن Attachment/File/Voice

**وابستگی:** STEP-01
**مسیر:** Backend Handoff
**خروجی:** قرارداد API رسانه، مدل Attachment و سیاست Voice/File برای تیم Planet/Hub

- [ ] **STEP-B03 تمام شد**

### پرامپت اجرا

```text
هدف: مستند کردن تغییرات رسانه موردنیاز برای اپ موبایل/PWA، بدون تغییر ./planet یا ./support-hub.

قبل از کار:
- docs/backend-change-requests.md را بخوان.
- SupportHubAttachmentStore، SupportHubClient، Controller رسانه و useSupportHubMedia.js را فقط مطالعه کن.

کارها:
- قابلیت‌های فعلی آپلود، Proxy و metadata را Baseline ثبت کن.
- API موبایل برای آپلود، metadata، دریافت و حذف Attachment طراحی کن.
- Attachment ID پایدار و دسترسی سطح Conversation را مشخص کن.
- سیاست Private Storage، URL امضاشده یا Endpoint احراز هویت‌شده را پیشنهاد بده.
- محدودیت نوع، حجم، MIME و Duration را مستند کن.
- مسیر Voice برای هر کانال و به‌ویژه بله را مشخص کن.
- دانلود آفلاین، Retention و پاک‌سازی را تعریف کن.
- سناریوهای Cancel، Retry، Expired و Oversized را بنویس.
- خروجی را در docs/backend-change-requests.md و docs/api-contract.md ثبت کن.

معیار پذیرش:
- سند برای توسعه‌دهنده Backend کافی برای پیاده‌سازی است.
- Project Token فقط در Backend مجاز است.
- هیچ فایلی در ./planet یا ./support-hub تغییر نکرده است.
```

---

## STEP-02 — ساخت Monorepo و اپ‌های Mobile/PWA

**وابستگی:** STEP-00
**خروجی:** پروژه اجراشدنی با Build و Test

- [x] **STEP-02 تمام شد**

### پرامپت اجرا

```text
هدف: زیرساخت Monorepo برای توسعه موازی Mobile و PWA بساز.

کارها:
- package manager و workspace را بر اساس Audit انتخاب کن.
- apps/mobile را با Expo و TypeScript Strict بساز.
- apps/pwa را با React + Vite + TypeScript Strict بساز.
- packages/ui، design-tokens، domain، api-client، chat-contracts، storage، theme و utils را ایجاد کن.
- ESLint، Prettier، aliasهای import و تنظیمات مشترک TypeScript را پیکربندی کن.
- اسکریپت‌های dev، build، lint، typecheck و test در root اضافه کن.
- یک صفحه Hello پایه در هر دو اپ اجرا کن.
- مسیر build و خروجی production را مستند کن.

محدودیت‌ها:
- منطق کسب‌وکار اضافه نکن.
- رنگ یا Navigation نهایی نساز.
- وابستگی غیرضروری اضافه نکن.

معیار پذیرش:
- npm/pnpm install، lint، typecheck، test و build موفق‌اند.
- هر دو اپ اجرا می‌شوند.
- aliasها و TypeScript بین packages درست کار می‌کنند.
```

---

## STEP-03 — Design Tokens، تم و رنگ قابل‌تنظیم

**وابستگی:** STEP-02
**خروجی:** Theme Provider مشترک و صفحه تنظیمات تم

- [x] **STEP-03 تمام شد**

### پرامپت اجرا

```text
هدف: سیستم تم روشن، تاریک، خودکار و قابل‌شخصی‌سازی رنگ را قبل از ساخت صفحه‌ها پیاده کن.

کارها:
- Tokenهای semantic رنگ، typography، spacing، radius و elevation برای Light و Dark تعریف کن.
- Tokenهای رنگ مینی‌اپ‌ها شامل nav.superapp، nav.messenger و nav.account را اضافه کن.
- ThemeProvider با حالت‌های system، light و dark بساز.
- تغییر تنظیم سیستم را در زمان اجرا شناسایی کن.
- themeMode و رنگ برند را ذخیره و بازیابی کن.
- Presetهای رنگ و یک Color Picker ساده اضافه کن.
- shades مناسب primary، hover، pressed و onPrimary را از رنگ پایه تولید کن.
- کنتراست متن و کنترل‌ها را برای هر تم بررسی کن.
- رنگ‌های success، warning و danger را معنایی و ثابت نگه دار.
- ThemeModeSelector و AccentColorPicker را به‌عنوان کامپوننت مشترک بساز.
- یک Component Gallery برای دیدن Tokenها در Light و Dark بساز.

محدودیت‌ها:
- هیچ رنگ خامی در کامپوننت‌های پایه استفاده نشود.
- تغییر رنگ نباید خوانایی را خراب کند.

معیار پذیرش:
- حالت سیستم با تغییر OS عوض می‌شود.
- انتخاب دستی و رنگ سفارشی پس از restart باقی می‌ماند.
- هر دو اپ از ThemeProvider مشترک استفاده می‌کنند.
- نمونه‌های Light و Dark و چند رنگ برند تست شده‌اند.
```

---

## STEP-04 — UI Kit و App Shell

**وابستگی:** STEP-03
**خروجی:** کامپوننت‌های پایه، Navigation و Gallery

- [x] **STEP-04 تمام شد**

### پرامپت اجرا

```text
هدف: یک UI Kit کوچک اما کامل و App Shell قابل‌استفاده در همه ماژول‌ها بساز.

کارها:
- Button، IconButton، TextField، SearchBar، Select، FilterChip، Tabs، Card، ListItem، Avatar، Badge، StatusPill، MoneyText و PersianDateText را بساز.
- EmptyState، ErrorState، Skeleton، InfiniteList، PaginationList، BottomSheet، Modal، ConfirmDialog و Toast را بساز.
- OfflineBanner و SyncStatusBar را بساز.
- Screen، Header، MiniAppShell، MiniAppHeader، MobileNavigation و DesktopSidebar را بساز.
- SuperAppNavigation سه‌دکمه‌ای شامل سوپرآپ، پیام‌رسان و مدیریت حساب را اضافه کن.
- برای هر مینی‌اپ محیط مستقل، Navigation داخلی و رنگ اختصاصی با Tokenهای nav.superapp، nav.messenger و nav.account بساز.
- ServiceAuthBoundary و ServiceSessionProvider را به‌عنوان مرز مستقل هر سرویس اضافه کن.
- همه کامپوننت‌ها RTL، typed و دارای accessibilityLabel باشند.
- برای هر کامپوننت نمونه در Component Gallery قرار بده.
- تست نمایش برای حالت‌های اصلی بنویس.

معیار پذیرش:
- هیچ صفحه‌ای مجبور نیست دکمه، فرم، لیست یا Banner اختصاصی بسازد.
- Navigation سه‌دکمه‌ای در موبایل و نمایش واکنش‌گرا در عرض بزرگ درست کار می‌کند.
- هر مینی‌اپ رنگ و محیط مستقل خودش را دارد و Session سرویس دیگر را وارد نمی‌کند.
- حالت‌های Dark و RTL تست شده‌اند.
- کامپوننت‌ها بدون منطق API نوشته شده‌اند.
```

---

## STEP-05 — Mock Auth مستقل سرویس‌ها و Session Boundaries

**وابستگی:** STEP-02
**خروجی:** Auth مستقل پیام‌رسان و مدیریت حساب، بدون ورود سراسری؛ CRM بدون Auth

- [x] **STEP-05 تمام شد**

### پرامپت اجرا

```text
هدف: مرزهای Auth و Session مستقل هر سرویس را با Mock امنیتی پیاده کن. عضویت یا ورود سراسری وجود ندارد.

کارها:
- ServiceAuthBoundary و ServiceSessionProvider را برای پیام‌رسان و مدیریت حساب بساز.
- برای هر سرویس Flow مستقل Connect، Disconnect و Session Expired داشته باش.
- یک Mock Auth Adapter بساز که بعداً با API واقعی همان سرویس جایگزین شود.
- Session Token هر سرویس را با کلید جداگانه در SecureStore/Keychain/Keystore نگه دار.
- در PWA Session هر سرویس را جدا و طبق سیاست مرورگر مدیریت کن؛ Project Token Hub ذخیره نشود.
- خروج از یک سرویس، سرویس دیگر یا CRM محلی را متأثر نکند.
- CRM را بدون هیچ Auth سرویس قابل‌دسترسی نگه دار؛ قفل محلی CRM اختیاری است.
- خطای 401/403 را فقط در همان سرویس مدیریت کن.
- هیچ Token یا داده حساسی در لاگ ننویس.

معیار پذیرش:
- صفحه ورود سراسری وجود ندارد.
- پیام‌رسان و مدیریت حساب Session مستقل دارند.
- خروج از پیام‌رسان، مدیریت حساب و CRM را از بین نمی‌برد.
- CRM بدون Auth سرویس باز می‌شود.
- Mock Auth به‌سادگی با Adapter واقعی قابل جایگزینی است.
- Project Token Hub در هیچ لایه اپ وجود ندارد.
```

---

## STEP-06 — Hub Client و مدیریت اتصال

**وابستگی:** STEP-05 + STEP-B01
**خروجی:** Connection Manager مقاوم با Ticket و reconnect

- [x] **STEP-06 تمام شد**

### پرامپت اجرا

```text
هدف: اتصال مستقیم اپ به Support Hub را با Connection Ticket پیاده کن؛ در MVP Ticket و جزئیات امنیتی Mock هستند.

کارها:
- socket.io-client را در پکیج chat-contracts یا Hub Client قرار بده.
- پیش از اتصال، Connection Ticket را از Mock Ticket Adapter بگیر؛ Adapter واقعی بعداً به Planet متصل شود.
- با auth: { connection_token } به Hub وصل شو.
- رویدادهای authenticated، connect، disconnect، connect_error، chat و chat_error را مدیریت کن.
- reconnect با Backoff و محدودیت تعداد تلاش پیاده کن.
- Ticket منقضی را تشخیص، اتصال را قطع و Ticket تازه بگیر.
- رویدادهای زنده هنگام Backlog Reconciliation در Buffer نگه دار.
- پیام‌های Hub را به مدل داخلی بدون تغییر قرارداد هفت‌فیلدی Map کن.
- Connection State را برای UI در دسترس بگذار.
- تست اتصال موفق، Ticket منقضی، قطع شبکه، reconnect و خطای Hub بنویس.

محدودیت‌ها:
- Project Token Hub دریافت یا ذخیره نکن.
- منطق نمایش پیام را داخل Hub Client ننویس.
- تاریخچه را از Hub نخواه؛ فقط Real-Time.

معیار پذیرش:
- اپ با Ticket Mock معتبر متصل و پیام زنده دریافت می‌کند.
- Ticket Mock منقضی بدون Crash بازیابی می‌شود و Adapter واقعی قابل جایگزینی است.
- قطع و وصل شبکه باعث Duplicate یا ازدست‌رفتن Buffer نمی‌شود.
```

---

## STEP-07 — SQLite، Repository و Sync Core

**وابستگی:** STEP-01 + STEP-B02
**خروجی:** دیتابیس محلی، Migration و موتور سینک پایه

- [x] **STEP-07 تمام شد**

### پرامپت اجرا

```text
هدف: زیرساخت داده محلی و سینک یک‌طرفه را بساز؛ هنوز UI چت را نساز.

کارها:
- Schema SQLite برای Conversation، Message، Sync State و App Settings را بساز.
- Schema اولیه Shop، Accounting و CRM را طبق مستند MVP اضافه کن.
- Migrationهای نسخه‌دار و قابل‌تست بساز.
- Repositoryهای typed برای خواندن و upsert داده بساز.
- شناسه canonical سرور و client_mutation_id را در Message نگه دار.
- cursor و last_synced_at را per dataset نگه دار.
- upsert idempotent و تراکنش atomic برای Batch سینک پیاده کن.
- حذف رکورد با deleted_at یا snapshot replacement را پشتیبانی کن.
- رمزنگاری دیتابیس حساس را پیاده یا Adapter آن را آماده کن.
- تست Migration، Duplicate، Ordering، Crash Before Commit و User Isolation بنویس.

محدودیت‌ها:
- Outbox و ارسال تغییرات آفلاین نساز.
- web_updated_at را برای pending محلی استفاده نکن.
- UI نباید مستقیماً SQL بنویسد.

معیار پذیرش:
- داده با شناسه یکتا بدون Duplicate ذخیره می‌شود.
- cursor فقط پس از موفقیت جلو می‌رود.
- خطای Batch، داده قبلی را خراب نمی‌کند.
- Schema بدون نوشتن SQL در صفحه‌ها قابل‌استفاده است.
```

---

## STEP-08 — صف گفتگوها و فیلترها

**وابستگی:** STEP-04 + STEP-06
**خروجی:** Inbox قابل‌استفاده با فیلتر و Pagination

- [x] **STEP-08 تمام شد**

### پرامپت اجرا

```text
هدف: صفحه اصلی چت و صف گفتگوها را بساز.

کارها:
- ConversationList و ConversationListItem را بساز.
- داده را در حالت آنلاین از Planet و در حالت آفلاین از Repository بخوان.
- فیلتر سطح پشتیبانی، وضعیت، کانال، اپراتور و خوانده‌نشده را اضافه کن.
- SearchBar، FilterChip و EmptyState را استفاده کن.
- Pagination یا InfiniteList با cursor پیاده کن.
- SupportLevelBadge، Assignee Avatar، LastMessagePreview و UnreadBadge نمایش بده.
- Pull to Refresh و خطای دریافت لیست را مدیریت کن.
- برای هر گفتگو مسیر بازشدن صفحه چت را وصل کن.
- تست فیلتر، Pagination، Empty و Offline بساز.

معیار پذیرش:
- لیست با داده Mock و API واقعی کار می‌کند.
- فیلترها درست عمل می‌کنند.
- حالت آفلاین داده کش‌شده را نشان می‌دهد.
- صفحه بدون hard-code رنگ یا داده تستی نهایی است.
```

---

## STEP-09 — صفحه چت، متن، ایموجی و Real-Time

**وابستگی:** STEP-07 + STEP-08
**خروجی:** چت متنی کامل آنلاین

- [ ] **STEP-09 تمام شد**

### پرامپت اجرا

```text
هدف: یک صفحه چت متنی قابل‌استفاده با ارسال و دریافت Real-Time بساز.

کارها:
- ChatScreen، ChatBubble، MessageComposer، MessageStatus و EmojiButton را بساز.
- تاریخچه را صفحه‌بندی‌شده از Planet یا Local Repository بخوان.
- پیام‌های زنده Hub را با message_id داخل SQLite upsert کن.
- برای ارسال پیام client_mutation_id تولید کن.
- پیام را Optimistic نمایش بده و پس از ACK با نسخه canonical جایگزین کن.
- timeout را به‌عنوان «نامشخص» نمایش بده؛ ارسال مجدد خودکار بدون Idempotency Key نکن.
- ارسال در حالت آفلاین را غیرفعال کن.
- متن بلند، پیام خالی، خطای Hub و پیام تکراری را مدیریت کن.
- Keyboard Avoidance، Scroll به آخرین پیام و Accessibility را رعایت کن.
- تست ارسال موفق، Duplicate، Disconnect و Offline بساز.

معیار پذیرش:
- پیام متنی بین دو کلاینت درست منتقل و ذخیره می‌شود.
- پیام تکراری دوبار نمایش داده نمی‌شود.
- حالت ارسال، ارسال‌شده، نامشخص و خطا دارد.
- در حالت آفلاین Composer غیرفعال است.
```

---

## STEP-10 — فایل، ویس و رسانه

**وابستگی:** STEP-09 + STEP-B03
**خروجی:** ارسال و دریافت فایل و ویس در محدوده پشتیبانی‌شده

- [ ] **STEP-10 تمام شد**

### پرامپت اجرا

```text
هدف: فایل و ویس را به چت اضافه کن، بدون شکستن محدودیت‌های provider.

کارها:
- AttachmentPicker، Upload Progress، FileBubble و VoicePlayer را بساز.
- فایل را ابتدا به Planet آپلود کن و attachment_id دریافت کن.
- پیام Hub را با metadata فایل مجاز ارسال کن.
- دریافت فایل را از endpoint امن Planet انجام بده.
- VoiceRecorder و VoicePlayer را با API صوت Expo پیاده کن.
- نوع و حجم فایل را پیش از آپلود اعتبارسنجی کن.
- برای ویس بله فقط مسیر تبدیل/فرمت پشتیبانی‌شده را فعال کن.
- فایل آفلاین دانلودشده و فایل نیازمند اینترنت را متفاوت نمایش بده.
- Cancel، Retry، Oversize و Unsupported Type را مدیریت کن.
- تست Mock رسانه و سناریوهای Voice/File هر کانال را بنویس.

محدودیت‌ها:
- Project Token Hub را برای دریافت فایل استفاده نکن.
- URL موقت provider را دائمی ذخیره نکن.
- قابلیت ارسال ویس نام پشتیبانی‌شده را در UI نشان نده.

معیار پذیرش:
- فایل متنی/تصویری پشتیبانی‌شده ارسال و دریافت می‌شود.
- ویس در کانال‌های تأییدشده کار می‌کند.
- فایل بدون مجوز Conversation دریافت نمی‌شود.
- حالت آفلاین برای رسانه درست نمایش داده می‌شود.
```

---

## STEP-11 — تاریخچه آفلاین و Backlog Reconciliation

**وابستگی:** STEP-07 + STEP-09
**خروجی:** تجربه آفلاین فقط‌خواندنی بدون Gap و Duplicate

- [ ] **STEP-11 تمام شد**

### پرامپت اجرا

```text
هدف: پس از reconnect، تاریخچه کامل و داده ازدست‌رفته را از Planet بگیر و در SQLite ادغام کن.

کارها:
- Backlog Repository و Sync Engine را تکمیل کن.
- ترتیب اتصال Hub → Buffer → دریافت Backlog → Merge → اعمال Buffer → به‌روزرسانی cursor را پیاده کن.
- پیام زنده و Backlog را با message_id dedup کن.
- cursor را per Conversation و per Dataset نگه دار.
- Snapshot و deleted_at را برای حذف داده پشتیبانی کن.
- OfflineBanner و StaleDataBadge را وصل کن.
- آخرین زمان سینک را در UI نمایش بده.
- خطای شبکه، 401، خطای سرور و cursor منقضی را مدیریت کن.
- تست Gap، Duplicate، Crash حین Merge، Deleted Message و Offline Read بنویس.

محدودیت‌ها:
- هیچ ارسال آفلاین یا Outbox نساز.
- در صورت خطا، Cache سالم حذف نشود.
- تشخیص آنلاین بودن فقط با پینگ واقعی سرور انجام شود، نه فقط NetInfo.

معیار پذیرش:
- پیام‌های دریافت‌شده در زمان آفلاین پس از reconnect دیده می‌شوند.
- هم‌زمانی Socket و Backlog باعث Gap یا Duplicate نمی‌شود.
- اپ آفلاین تاریخچه مجاز را نشان می‌دهد.
- زمان آخرین سینک درست است.
```

---

## STEP-12 — سطوح پشتیبانی، تخصیص و وضعیت گفتگو

**وابستگی:** STEP-08 + STEP-09
**خروجی:** کنترل چندسطحی گفتگو

- [ ] **STEP-12 تمام شد**

### پرامپت اجرا

```text
هدف: قابلیت‌های چندسطحی پشتیبانی را در UI و فرایند مجوز پیاده کن.

کارها:
- SupportLevelBadge و فیلتر سطح را تکمیل کن.
- AssignmentSheet، EscalationSheet و ConversationStatusSheet را بساز.
- APIهای assign، escalate و status را وصل کن.
- نمایش اپراتور مسئول و سطوح گفتگو را اضافه کن.
- عملیات مجاز را بر اساس نقش و سطح کاربر کنترل کن.
- خطای 403 و تعارض تغییر وضعیت را مدیریت کن.
- Optimistic Update را فقط برای UI انجام بده و با پاسخ سرور تطبیق بده.
- تست سطح مجاز، سطح غیرمجاز، ارتقا، بستن و بازکردن را بنویس.

محدودیت‌ها:
- فیلتر UI را به‌عنوان امنیت استفاده نکن.
- اگر Hub داده سطح دیگر را ارسال می‌کند، این Blocker را ثبت کن.
- API ناموجود را با داده Mock شبیه‌سازی نهایی نکن.

معیار پذیرش:
- گفتگو قابل تخصیص، ارتقا، بستن و بازکردن است.
- کاربر بدون مجوز عملیات را انجام نمی‌دهد.
- در صورت جداسازی سطح‌ها، داده غیرمجاز در کلاینت دریافت نمی‌شود.
```

---

## STEP-13 — ماژول فروشگاه فقط‌خواندنی

**وابستگی:** STEP-03 + STEP-04 + STEP-07
**خروجی:** داشبورد، لیست و جزئیات فروشگاه آنلاین/آفلاین

- [ ] **STEP-13 تمام شد**

### پرامپت اجرا

```text
هدف: ماژول فقط‌خواندنی فروشگاه را با داده آنلاین و Cache آفلاین بساز.

کارها:
- Dashboard، OrderList، OrderDetail، ProductList و ProductDetail را بساز.
- MetricCard، OrderCard، ProductCard و InventoryBadge را از UI Kit استفاده کن.
- APIهای فقط‌خواندنی Planet را وصل کن.
- داده مجاز Shop را در SQLite Cache کن.
- Search، Filter، Pagination و جزئیات سفارش/محصول را پیاده کن.
- زمان آخرین سینک و Badge داده قدیمی را نمایش بده.
- حالت آفلاین را با Repository محلی پشتیبانی کن.
- هیچ دکمه ثبت سفارش، ویرایش محصول، تغییر موجودی یا حذف نساز.
- تست Online، Offline، Empty و Stale Data بنویس.

معیار پذیرش:
- داده فروشگاه آنلاین و آفلاین درست نمایش داده می‌شود.
- ماژول هیچ عملیات نوشتن ندارد.
- مبالغ و تاریخ‌ها فارسی هستند.
- Cache با Retention و مجوز کاربر کنترل می‌شود.
```

---

## STEP-14 — ماژول حسابداری فقط‌خواندنی

**وابستگی:** STEP-03 + STEP-04 + STEP-07
**خروجی:** داشبورد، گزارش و جزئیات حسابداری آنلاین/آفلاین

- [ ] **STEP-14 تمام شد**

### پرامپت اجرا

```text
هدف: ماژول فقط‌خواندنی حسابداری را با حفاظت از داده مالی بساز.

کارها:
- AccountingDashboard، DocumentList، DocumentDetail، TransactionList و ReportTable را بساز.
- MoneyText و PersianDateText را برای همه مبالغ و تاریخ‌ها استفاده کن.
- APIهای فقط‌خواندنی Planet را وصل کن.
- داده مجاز حسابداری را رمزنگاری‌شده در SQLite Cache کن.
- گزارش‌ها و اسناد را با فیلتر بازه زمانی و نوع سند نمایش بده.
- آخرین زمان سینک و StaleDataBadge را اضافه کن.
- حالت آفلاین و خطای دسترسی مالی را مدیریت کن.
- هیچ ایجاد، ویرایش، حذف یا تأیید سند نساز.
- تست مجوز، Offline، Stale Data و Formatting بنویس.

معیار پذیرش:
- داده مالی بدون مجوز قابل‌دریافت نیست.
- ماژول هیچ عملیات نوشتن ندارد.
- Cache مالی رمزنگاری و محدود است.
- گزارش‌ها و مبالغ بدون خطای واحد یا تاریخ نمایش داده می‌شوند.
```

---

## STEP-15 — CRM کاملاً محلی

**وابستگی:** STEP-03 + STEP-04
**خروجی:** CRM آفلاین با قفل و Export

- [ ] **STEP-15 تمام شد**

### پرامپت اجرا

```text
هدف: CRM شخصی و کاملاً آفلاین را بدون هیچ اتصال سرور یا Auth سرویس پیاده کن؛ CRM از محیط سوپرآپ قابل‌دسترسی است.

کارها:
- ContactList، ContactCard، ContactDetail، TagInput، NoteEditor، TaskList و InteractionTimeline را بساز.
- CRUD مخاطب، برچسب، یادداشت، وظیفه و تعامل را در SQLite پیاده کن.
- Search و Filter محلی اضافه کن.
- PIN یا Biometric Lock برای ورود به CRM پیاده کن.
- Export داده به یک قالب امن و قابل‌بازیابی بساز.
- Backup/Import را فقط در صورت تعریف دقیق فرمت اضافه کن.
- هیچ API Client، Sync Job یا Network Call برای CRM نساز.
- داده CRM را از Analytics و Crash Report مستثنا کن.
- تست CRUD، Lock، Export و Dataset Isolation بنویس.

معیار پذیرش:
- CRM بدون اینترنت و بدون Auth هیچ سرویس کار می‌کند.
- CRM از ناوبری سوپرآپ قابل‌دسترسی است.
- هیچ درخواست شبکه برای CRM ارسال نمی‌شود.
- قفل و Export کار می‌کنند.
- داده CRM بین کاربران یا Sessions اشتباه قابل‌دسترسی نیست.
```

---

## STEP-16 — PWA آنلاین

**وابستگی:** STEP-04 + STEP-05 + APIهای لازم
**خروجی:** PWA قابل‌نصب و آنلاین با رابط مشترک

- [ ] **STEP-16 تمام شد**

### پرامپت اجرا

```text
هدف: نسخه PWA آنلاین را با استفاده از Design System و منطق مشترک بساز.

کارها:
- App Shell، Navigation سه‌دکمه‌ای و Auth مستقل Mock هر سرویس را در apps/pwa اجرا کن؛ Auth سراسری نساز.
- Theme Provider و شخصی‌سازی رنگ را فعال کن.
- Chat آنلاین، فروشگاه فقط‌خواندنی و حسابداری فقط‌خواندنی را طبق APIهای آماده پیاده کن.
- PWA Manifest، Icon، Splash و Installability را تنظیم کن.
- فقط Static Shell را Cache کن.
- داده فروشگاه و حسابداری را Persistent Cache نکن.
- داده چت را فقط در حافظه و State آنلاین نگه دار.
- Connection Ticket را در حافظه مدیریت و Project Token Hub را ذخیره نکن.
- Desktop و Tablet Responsive را تست کن.
- CRM در PWA فقط در صورت تعریف صریح محدوده، با IndexedDB محلی و بدون سرور اضافه شود.

معیار پذیرش:
- PWA نصب‌شدنی و آنلاین کار می‌کند.
- تم سیستم/دستی و رنگ برند در PWA کار می‌کند.
- Navigation سه‌دکمه‌ای و رنگ مستقل هر مینی‌اپ در PWA کار می‌کند.
- Auth سراسری وجود ندارد و Session هر سرویس مستقل است.
- داده فروشگاه و حسابداری پس از بستن مرورگر Persistent Cache نمی‌شود.
- هیچ Project Token Hub در مرورگر ذخیره نمی‌شود.
```

---

## STEP-17 — Hardening امنیت، عملکرد و دسترس‌پذیری

**وابستگی:** همه ماژول‌ها
**خروجی:** گزارش QA و رفع مشکلات Release Blocker

- [ ] **STEP-17 تمام شد**

### پرامپت اجرا

```text
هدف: کیفیت Release را بررسی و مشکلات امنیتی، عملکرد و دسترس‌پذیری را رفع کن.

کارها:
- کد را برای Token hard-code، لاگ داده حساس، Project Token Hub و دسترسی نامناسب اسکن کن.
- Ticket Expiry، 401/403، Logout مستقل هر سرویس، Service Session Isolation، دسترسی CRM بدون Auth و Cache Isolation را تست کن.
- Dark/Light، چند رنگ برند، RTL، بزرگ‌نمایی متن و Screen Reader را بررسی کن.
- لیست‌های بلند، Gallery رسانه، SQLite و Scroll را Profile کن.
- خطاهای Network، Hub Disconnect، Planet Down و Storage Full را شبیه‌سازی کن.
- Crash-free Startup و Cold Start را بسنج.
- TODO و Mock باقی‌مانده را فهرست و برای Production غیرمجاز علامت بزن.
- Test Suite، Lint، Typecheck و Build نهایی هر دو اپ را اجرا کن.

خروجی:
- docs/qa-report.md
- فهرست Blockerها و Issues باقی‌مانده
- تغییرات رفع‌شده

معیار پذیرش:
- هیچ Secret یا Project Token Hub در Bundle وجود ندارد.
- هیچ Crash مسیرهای اصلی وجود ندارد.
- مشکل دسترس‌پذیری بحرانی باقی نمانده است.
- Build و Test نهایی موفق‌اند.
```

---

## STEP-18 — E2E، Release Checklist و خروجی نهایی

**وابستگی:** STEP-17
**خروجی:** نسخه قابل‌تحویل MVP و مستندات Release

- [ ] **STEP-18 تمام شد**

### پرامپت اجرا

```text
هدف: کل مسیرهای اصلی MVP را End-to-End تست و خروجی نهایی را آماده کن.

سناریوهای E2E:
- اتصال مستقل سرویس پیام‌رسان با Mock Auth و دریافت Ticket Mock
- اتصال Hub و دریافت پیام
- ارسال متن، فایل و ویس در محدوده پشتیبانی‌شده
- قطع شبکه، دریافت پیام در Planet و reconnect
- مشاهده تاریخچه آفلاین بدون Duplicate
- تخصیص، ارتقا و بستن گفتگو
- مشاهده سفارش و سند مالی آنلاین و آفلاین
- استفاده کامل CRM بدون اینترنت و بدون Auth سرویس
- جابه‌جایی بین سوپرآپ، پیام‌رسان و مدیریت حساب با رنگ و محیط مستقل
- خروج از یک سرویس بدون تأثیر بر سرویس دیگر و CRM
- تغییر تم و رنگ برند
- اجرای PWA آنلاین

کارها:
- Buildهای Android و iOS را آماده و Verify کن.
- Build و Deploy نمونه PWA را اجرا کن.
- Environmentهای غیرمحیط و Secretهای لازم را مستند کن؛ مقدار واقعی Secret را در سند ننویس.
- Release Checklist، Known Issues و Rollback Plan را بنویس.
- وضعیت همه استپ‌ها و درصد پیشرفت را در superapp-work-plan.md به‌روز کن.
- خروجی نهایی، فایل‌های تغییر، تست‌ها و Limitations را گزارش بده.

معیار پذیرش:
- همه سناریوهای بحرانی پاس شده‌اند.
- هیچ Blocker باز باقی نمانده است.
- خروجی Mobile و PWA قابل‌تحویل است.
- گزارش پیشرفت نهایی ثبت شده است.
```

---

## ۶. گزارش اجباری بعد از هر استپ

پس از هر پرامپت، گزارش را دقیقاً با این قالب ثبت کن:

```text
STEP-ID:
عنوان:
وضعیت: Done / In Progress / Blocked
زمان صرف‌شده:
فایل‌های تغییرکرده:
تست‌های اجراشده:
نتیجه Build:
Issues باقی‌مانده:
Blockerها:
استپ بعدی:
```

### لاگ اجرا

| تاریخ | STEP-ID | وضعیت | نتیجه تست | Build | گزارش کوتاه / استپ بعدی |
|---|---|---|---|---|---|
| 2026-11-24 | STEP-00 | Done | Audit مستندات، محیط و سورس مرجع؛ بدون Test محصول | N/A | مسیرهای مرجع `./planet` و `./support-hub` فقط‌خواندنی شدند؛ گزارش در `docs/implementation-audit.md` و Change Requests در `docs/backend-change-requests.md`؛ استپ بعدی STEP-01 |
| 2026-11-24 | STEP-01 | Done | ۱۱ تست Node برای Mock API پاس شد؛ Syntax Check تایپ‌ها و اعتبارسنجی OpenAPI/Fixtureها موفق | N/A | قراردادها در `docs/api-contract.md` و `docs/openapi.yaml`؛ تایپ‌ها در `packages/chat-contracts`؛ Mock و Fixtureها در `packages/api-client/mocks`؛ استپ بعدی STEP-02 |
| 2026-11-24 | STEP-02 | Done | lint، typecheck، format:check و ۱۳ تست (۱۱ Package + ۱ PWA + ۱ Mobile) پاس شد | PWA و Expo Export Android/iOS موفق | Monorepo، Expo SDK 58، Vite 8، Workspaceها و اسکریپت‌های Root آماده‌اند؛ مستند Setup در `docs/development-setup.md`؛ استپ بعدی STEP-03 |
| 2026-11-24 | STEP-03 | Done | lint، typecheck، format:check و ۱۹ تست (۱۱ Package + ۷ PWA + ۱ Mobile) پاس شد | PWA و Expo Export Android/iOS موفق | Design Tokenها، Theme Provider مشترک، سیستم/روشن/تاریک، Preset و رنگ سفارشی، ذخیره تنظیمات، کنترل کنتراست و Gallery در هر دو اپ آماده‌اند؛ مستند در `docs/theme-system.md`؛ استپ بعدی STEP-04 |
| 2026-11-25 | STEP-04 | Done | lint، typecheck، format:check و ۱۹ تست (۱۱ Package + ۷ PWA + ۱ Mobile) پاس شد | PWA و Expo Export Android/iOS موفق | UI Kit موبایل/PWA، فرم‌ها، بازخورد، لیست‌ها، Overlayها، App Shell، Navigation سه‌دکمه‌ای، رنگ مستقل مینی‌اپ‌ها و Service Auth Boundary آماده‌اند؛ مستند در `docs/ui-kit.md`؛ استپ بعدی STEP-05 |
| 2026-11-25 | STEP-05 | Done | lint، typecheck، format:check و ۲۴ تست (۱۱ Package + ۱۲ PWA + ۱ Mobile) پاس شد | PWA و Expo Export Android/iOS موفق | پکیج `@superapp/auth`، Mock Adapter، Session مستقل پیام‌رسان/مدیریت حساب، Connect/Disconnect/Expire، Storage جداگانه و دسترسی CRM بدون Auth آماده‌اند؛ مستند در `docs/service-auth.md`؛ استپ بعدی STEP-06 |
| 2026-11-25 | STEP-06 | Done | lint، typecheck، format:check و ۲۹ تست (۱۱ Package + ۱۷ PWA + ۱ Mobile) پاس شد | PWA و Expo Export Android/iOS موفق | پکیج `@superapp/hub-client`، Ticket Adapter، Socket.IO Transport، Reconnect، Refresh Ticket، Buffer رویدادها و Demo اتصال آماده‌اند؛ مستند در `docs/hub-client.md`؛ استپ بعدی STEP-07 |
| 2026-11-25 | STEP-07 | Done | lint، typecheck، format:check و ۳۶ تست (۱۱ Package + ۲۴ PWA + ۱ Mobile) پاس شد | PWA و Expo Export Android/iOS موفق | پکیج `@superapp/local-db`، Schema و Migration، Repositoryهای typed، Upsert اتمیک، Tombstone، Cursor و Sync Engine آماده‌اند؛ مستند در `docs/local-db.md`؛ استپ بعدی STEP-08 |
| 2026-11-25 | STEP-08 | Done | lint، typecheck، format:check و ۴۷ تست (۱۱ Package + ۳۵ PWA + ۱ Mobile) پاس شد | PWA و Expo Export Android/iOS موفق | صف گفتگوها، جستجو، فیلترهای سطح/وضعیت/کانال/اپراتور/خوانده‌نشده، Pagination، Refresh، Cache آفلاین موبایل، Adapter واقعی Planet و مسیر گفتگو آماده‌اند؛ مستند در `docs/conversation-inbox.md`؛ استپ بعدی STEP-09 |

---

## ۷. لاگ Blockerها

| ID | تاریخ ثبت | استپ related | توضیح Blocker | مسئول | وضعیت | راه‌حل |
|---|---|---|---|---|---|---|
| BLK-01 | 2026-11-24 | STEP-01 / B01–B03 | مسیر مرجع Planet و Hub مشخص نبود | کاربر | Resolved | مسیرهای مرجع `./planet` و `./support-hub` تأیید و فقط‌خواندنی شدند |
| BLK-02 | 2026-11-24 | STEP-B01 / STEP-06 | Hub فعلی Connection Ticket را نمی‌پذیرد؛ MVP با Mock پیش می‌رود | تیم Hub | Deferred / Mock in MVP | افزودن احراز هویت Ticket کوتاه‌عمر برای Production |
| BLK-03 | 2026-11-24 | STEP-B02 / STEP-07 / STEP-11 | ثبت کامل پیام‌های زنده در Planet برای موبایل تأیید نشده | تیم Planet | Open | Server-side Ingest یا جریان معادل با Idempotency |
| BLK-04 | 2026-11-24 | STEP-B01 / STEP-12 | سطوح پشتیبانی و Assignment در Planet/Hub وجود ندارد | تیم Hub / Planet | Confirmed | مدل سطح/تخصیص و Room یا Subscription سطح‌بندی‌شده |
| BLK-05 | 2026-11-24 | STEP-B02 / STEP-07 | پیام زنده Hub شناسه canonical ندارد | تیم Planet | Confirmed | نگاشت پیام Hub به `message_id` canonical در Planet |
| BLK-06 | 2026-11-24 | STEP-B03 / STEP-10 | API موبایل Attachment/File و Voice آماده نیست؛ MVP با Mock پیش می‌رود | تیم Planet / Hub | Deferred / Mock in MVP | API Token-based، Attachment ID و مسیر Voice کانال‌ها برای Production |
| BLK-07 | 2026-11-24 | STEP-18 | Toolchain Build Native آماده نیست | تیم Release | Open | نصب Android Toolchain یا استفاده از EAS؛ iOS با macOS/EAS |
| BLK-08 | 2026-11-24 | STEP-07 / STEP-11 / STEP-13 / STEP-14 | Retention و سیاست خروج از حساب مشخص نیست | محصول / امنیت | Open | تعیین بازه Cache و رفتار Logout |
| BLK-09 | 2026-11-24 | STEP-05 / STEP-06 / STEP-16 | Auth API واقعی موبایل/PWA وجود ندارد؛ MVP با Mock پیش می‌رود | تیم Planet | Deferred / Mock in MVP | Auth مستقل هر سرویس، Access/Refresh Token، Revoke و Permissions API |
| BLK-10 | 2026-11-24 | STEP-02 / STEP-17 | npm audit: ۲۰ Moderate؛ ۳ مورد Production در زنجیره Expo Fingerprint/Minimatch | Frontend / Release | Open | بازبینی Upgrade هماهنگ Expo SDK؛ بدون Downgrade خودکار |

---

## ۸. چک‌لیست سریع پیشرفت

- [x] Audit و مسیر پروژه مشخص شده است.
- [x] قرارداد API و Mockها آماده‌اند.
- [ ] Hub Ticket را پشتیبانی می‌کند.
- [ ] Planet همه پیام‌ها را ذخیره می‌کند.
- [ ] مسیر امن فایل و ویس آماده است.
- [x] Monorepo و Build پایه آماده است.
- [x] تم و رنگ قابل‌تنظیم آماده است.
- [x] UI Kit و Navigation سه‌دکمه‌ای با محیط و رنگ مستقل مینی‌اپ‌ها آماده است.
- [x] Auth و Session مستقل هر سرویس با Mock آماده است.
- [x] Hub Client مقاوم آماده است.
- [x] SQLite و Sync Core آماده است.
- [x] صف گفتگوها آماده است.
- [ ] چت متنی Real-Time آماده است.
- [ ] فایل و ویس آماده است.
- [ ] تاریخچه آفلاین آماده است.
- [ ] سطوح پشتیبانی و تخصیص آماده است.
- [ ] فروشگاه فقط‌خواندنی آماده است.
- [ ] حسابداری فقط‌خواندنی آماده است.
- [ ] CRM محلی آماده است.
- [ ] PWA آنلاین آماده است.
- [ ] Hardening انجام شده است.
- [ ] E2E و Release انجام شده است.

---

## ۹. تاریخچه برنامه

| نسخه | تاریخ | تغییر |
|---|---|---|
| 1.0 | 2026-11-24 | ایجاد ۲۲ استپ اجرایی، پرامپت‌های مستقل، وابستگی‌ها، مسیرهای موازی، داشبورد و قالب گزارش |
| 1.1 | 2026-11-24 | تکمیل STEP-00، ثبت Audit، تصمیم npm Workspaces، ثبت ۸ Blocker و به‌روزرسانی پیشرفت به ۱ از ۲۲ |
| 1.2 | 2026-11-24 | تعیین مسیرهای فقط‌خواندنی Planet/Hub، اصلاح Audit بر اساس سورس مرجع، افزودن Backend Change Requests و تبدیل استپ‌های B به Handoff مستند |
| 1.3 | 2026-11-24 | حذف Auth سراسری، افزودن Auth مستقل و Mock امنیت MVP، دسترسی CRM بدون سرویس و ناوبری سه‌دکمه‌ای با رنگ مستقل مینی‌اپ‌ها |
| 1.4 | 2026-11-24 | تکمیل STEP-01، ایجاد قرارداد API/OpenAPI، تایپ‌های مشترک، Mock API، Fixtureها و ۱۱ تست موفق |
| 1.5 | 2026-11-24 | تکمیل STEP-02، ایجاد Monorepo، Expo/Vite، Workspaceها، ESLint/Prettier/TypeScript/Test و Build موفق؛ ثبت Blocker امنیتی وابستگی‌ها |
| 1.6 | 2026-11-24 | تکمیل STEP-03، پیاده‌سازی Design Tokenها، Theme Provider، تم سیستم/دستی، رنگ سفارشی، کنتراست، Gallery و ۱۹ تست موفق |
| 1.7 | 2026-11-25 | تکمیل STEP-04، ایجاد UI Kit موبایل/PWA، App Shell، Navigation سه‌دکمه‌ای، Gallery و مرز Auth سرویس |
| 1.8 | 2026-11-25 | تکمیل STEP-05، ایجاد پکیج Auth، Mock Adapter، Session مستقل سرویس‌ها، Connect/Disconnect/Expire و دسترسی CRM بدون Auth |
| 1.9 | 2026-11-25 | تکمیل STEP-06، ایجاد Hub Client، Ticket Adapter، Socket.IO Transport، Reconnect، Refresh Ticket و Buffer رویدادها |
| 1.10 | 2026-11-25 | تکمیل STEP-07، ایجاد SQLite، Migration، Repositoryها، Sync Engine، Tombstone و تست‌های اتمیک |
| 1.11 | 2026-11-25 | تکمیل STEP-08، ایجاد صف گفتگوها، فیلترها، Pagination، Adapter Planet، Cache آفلاین موبایل و مسیر گفتگو |
