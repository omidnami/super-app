# مستند تغییرات موردنیاز Backend و Support Hub

> تاریخ: 2026-11-24
>
> وضعیت: **Handoff Specification — آماده بازبینی و تحویل اولیه به توسعه‌دهنده Backend/Hub**
>
> این سند هیچ دستور تغییر مستقیم در `planet/` یا `support-hub/` نیست. توسعه‌دهنده Backend باید تغییرات را در Repository اصلی و Branch مستقل خودش انجام دهد.
>
> در MVP، جزئیات امنیتی Auth، Ticket و مجوزها Mock هستند. این سند قرارداد اتصال واقعی Post-MVP را تعریف می‌کند. عضویت یا ورود سراسری وجود ندارد؛ هر سرویس Auth و Session مستقل دارد.

---

## ۱. هدف

این سند فاصله بین قابلیت‌های فعلی Planet و Support Hub و نیازهای MVP سوپراپلیکیشن را مشخص می‌کند.

خروجی مورد انتظار از تیم Backend:

- API موبایل/PWA با احراز هویت Token-based و مستقل برای هر سرویس
- صدور Connection Ticket کوتاه‌عمر بدون افشای Project Token Hub
- ذخیره کامل پیام‌های زنده و آفلاین در Planet
- شناسه canonical پیام و Idempotency
- APIهای Delta Sync و Backlog
- مدل سطوح پشتیبانی، Assignment و وضعیت گفتگو
- API امن Attachment/File/Voice
- APIهای فقط‌خواندنی فروشگاه و حسابداری
- تست‌های امنیتی و یکپارچه

---

## ۲. مراجع فقط‌خواندنی

| مرجع | مسیر | کاربرد |
|---|---|---|
| Planet | `./planet` | استخراج API، مدل داده، Service و Controller |
| Support Hub | `./support-hub` | استخراج قرارداد Socket.IO، Message و Webhook |
| مستند MVP | `./docs/superapp-mvp.md` | تصمیم‌های محصول |
| برنامه اجرایی | `./docs/superapp-work-plan.md` | وابستگی استپ‌ها |
| Audit | `./docs/implementation-audit.md` | یافته‌های سورس |

قواعد:

- این پوشه‌ها فقط خوانده می‌شوند.
- هیچ Migration، Test یا Build داخل آن‌ها اجرا نمی‌شود.
- هیچ Secret یا Token واقعی در این سند ثبت نمی‌شود.
- تمام تغییرات Backend باید خارج از این بررسی و در Repository اصلی توسعه‌دهنده انجام شود.

---

## ۳. وضعیت فعلی موجود

### ۳.۱. Planet

قابلیت‌های موجود:

- ذخیره `support_hub_conversations` و `support_hub_messages`
- Dedup با `dedupe_key` و `delivery_id`
- ثبت پیام اپراتور پیش از ارسال Hub
- وضعیت `pending` / `sent` / `failed`
- آپلود Attachment در Planet
- Proxy دریافت فایل Hub با Project Token سمت سرور
- Webhook امضاشده `chat.offline`
- پنل Admin با Vue/Inertia
- endpoint صدور Project Token برای صاحب فروشگاه

APIهای فعلی:

| متد | مسیر | Auth |
|---|---|---|
| POST | `/admin/support-hub/operator-token` | Admin Session + settings |
| GET | `/admin/support-hub/conversations` | Admin Session + tickets |
| GET | `/admin/support-hub/conversations/{id}/messages` | Admin Session + tickets |
| POST | `/admin/support-hub/messages` | Admin Session + tickets write |
| POST | `/admin/support-hub/messages/{id}/status` | Admin Session + tickets write |
| POST | `/admin/support-hub/attachments` | Admin Session + tickets write |
| GET | `/admin/support-hub/files` | Admin Session + tickets |
| POST | `/api/support-hub/webhook` | HMAC |

محدودیت:

- این APIها Session/Inertia محورند و برای Mobile/PWA مناسب نیستند.
- endpoint `operator-token` توکن ریشه Hub را برمی‌گرداند و نباید مبنای اپ موبایل باشد.

### ۳.۲. Support Hub

قابلیت‌های موجود:

- Socket.IO v4
- اتصال اپراتور با Project Token
- اتصال Client با HMAC کوتاه‌عمر
- اتصال Bridge بله
- اتاق `project:{project_id}`
- پیام هفت‌فیلدی
- webhook فقط در حالت نبود اپراتور آنلاین
- File Resolver با Project Token

محدودیت‌ها:

- بدون تاریخچه، اپراتور، سطح پشتیبانی یا Assignment
- بدون Connection Ticket
- بدون `message_id` در پیام
- بدون ingest همه پیام‌ها
- بدون ذخیره دائمی فایل
- تک‌نمونه و بدون Redis Socket.IO Adapter

---

## ۴. خلاصه Change Requests

| ID | عنوان | اولویت | مالک | استپ مرتبط |
|---|---|---|---|---|
| CR-01 | Auth API مستقل هر سرویس برای Mobile/PWA | P2 / Post-MVP | Planet | STEP-05 |
| CR-02 | Connection Ticket در Hub | P0 | Hub + Planet | STEP-B01 / STEP-06 |
| CR-03 | Ingest کامل و Message ID canonical | P0 | Planet + Hub | STEP-B02 / STEP-07 |
| CR-04 | Delta Sync و Backlog API | P0 | Planet | STEP-07 / STEP-11 |
| CR-05 | سطوح پشتیبانی و Assignment | P1 | Planet + Hub | STEP-12 |
| CR-06 | Attachment/File/Voice API | P0 | Planet + Hub | STEP-B03 / STEP-10 |
| CR-07 | API فقط‌خواندنی فروشگاه و حسابداری | P1 | Planet | STEP-13 / STEP-14 |
| CR-08 | امنیت، Audit و Observability | P1 | Planet + Hub | STEP-17 |

---

## CR-01 — Auth API مستقل هر سرویس برای Mobile و PWA

### مشکل

اپ موبایل و PWA نباید از Session/Inertia پنل Admin استفاده کنند. همچنین محصول تصمیم گرفته است عضویت و ورود سراسری نداشته باشد؛ هر سرویس اتصال و احراز هویت مستقل خودش را دارد.

در MVP، این جزئیات با Mock پیش می‌روند. این CR برای اتصال واقعی Post-MVP است.

### نیازمندی

- Flow مستقل برای سرویس پیام‌رسان
- Flow مستقل برای سرویس مدیریت حساب
- بدون Login یا Signup سراسری
- بدون انتقال Session بین سرویس‌ها
- Access Token کوتاه‌عمر برای هر سرویس
- Refresh Token با Rotation برای هر سرویس
- Logout و Revoke فقط همان سرویس
- مجوزهای مخصوص همان سرویس
- CRM هیچ Endpoint Auth ندارد

### API پیشنهادی

| متد | مسیر | کاربرد |
|---|---|---|
| POST | `/api/v1/messaging/auth/session` | اتصال به سرویس پیام‌رسان |
| POST | `/api/v1/messaging/auth/refresh` | تازه‌سازی Session پیام‌رسان |
| POST | `/api/v1/messaging/auth/logout` | خروج از پیام‌رسان |
| GET | `/api/v1/messaging/auth/context` | اپراتور، Project، سطح و مجوزهای چت |
| POST | `/api/v1/account/auth/session` | اتصال به سرویس مدیریت حساب |
| POST | `/api/v1/account/auth/refresh` | تازه‌سازی Session مدیریت حساب |
| POST | `/api/v1/account/auth/logout` | خروج از مدیریت حساب |
| GET | `/api/v1/account/auth/context` | Project، نقش و مجوزهای فروشگاه/حسابداری |

### پاسخ پیشنهادی Session پیام‌رسان

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 900,
  "service": "messaging",
  "context": {
    "operator_id": 42,
    "project_id": 12,
    "support_level": "level_1",
    "permissions": ["chat.read", "chat.write"]
  }
}
```

### قواعد امنیتی

- Access Token هر سرویس با کلید جداگانه در SecureStore/Keychain/Keystore.
- Refresh Token طبق سیاست امنیتی Mobile/PWA نگهداری شود.
- Project Token Hub هرگز در پاسخ Auth باشد.
- Token در لاگ ثبت نشود.
- Password یا Token در Query String نباشد.
- Refresh Token Rotation و تشخیص Replay پیاده شود.
- خروج از پیام‌رسان، Session مدیریت حساب و CRM محلی را باطل نکند.
- CRM بدون Auth سرویس قابل‌دسترسی بماند.

### معیار پذیرش

- هیچ صفحه Login سراسری وجود ندارد.
- پیام‌رسان و مدیریت حساب Session مستقل دارند.
- Access Token منقضی فقط Session همان سرویس را Refresh می‌کند.
- Logout یک سرویس، سرویس دیگر و CRM را متأثر نکند.
- کاربر بدون مجوز `chat.write` پیام ارسال نمی‌کند.
- درخواست اتصال هر سرویس Rate Limited است.

---

## CR-02 — Connection Ticket کوتاه‌عمر برای Hub

### مشکل

Hub فعلی فقط `auth: { token: PROJECT_TOKEN }` را می‌پذیرد. Planet نیز endpointی دارد که Project Token ریشه را به صاحب فروشگاه برمی‌گرداند.

این مدل برای اپ موبایل چندکاربره و چندسطحی امن نیست.

### نیازمندی Hub

Hub باید حالت جدید زیر را بپذیرد:

```text
auth: { connection_token: "<SIGNED_TICKET>" }
```

Ticket باید فقط برای Socket.IO اپراتور معتبر باشد و در REST APIهای حساس Hub قابل استفاده نباشد.

### Claimهای الزامی

| Claim | توضیح |
|---|---|
| `iss` | Planet |
| `aud` | Support Hub |
| `sub` | Operator ID |
| `project_id` | پروژه مجاز |
| `support_level` | سطح پشتیبانی |
| `allowed_sources` | کانال‌های مجاز |
| `allowed_conversations` | اختیاری؛ در صورت Subscription-based |
| `iat` | زمان صدور |
| `exp` | زمان انقضا |
| `jti` | شناسه یکتای Ticket |

### API پیشنهادی Planet

```http
POST /api/v1/chat/connection-ticket
Authorization: Bearer <MESSAGING_SERVICE_ACCESS_TOKEN>
```

پاسخ:

```json
{
  "hub_url": "wss://hub.example.com",
  "connection_token": "...",
  "expires_at": "2026-11-24T12:15:00Z",
  "project_id": 12,
  "operator_id": 42,
  "support_level": "level_1",
  "allowed_sources": ["bale", "chat"]
}
```

### قواعد

- Ticket در حافظه اپ نگهداری شود، نه SQLite یا localStorage.
- عمر پیشنهادی چند دقیقه؛ مقدار نهایی توسط تیم Backend تأیید شود.
- Ticket قبل از انقضا Refresh شود.
- Logout، تغییر نقش یا تعلیق اپراتور باید Ticket را باطل کند.
- Hub باید `exp`، `aud`، `project_id` و Scope را بررسی کند.
- در صورت استفاده از Introspection، Hub باید Timeout و Fail-closed داشته باشد.
- در صورت Signature، Rotation Key بدون قطع اتصال‌های معتبر انجام شود.

### معیار پذیرش

- اپ بدون Project Token به Hub متصل می‌شود.
- Ticket منقضی، Signature نامعتبر، Project نامعتبر یا Scope نامعتبر رد می‌شود.
- Ticket در REST APIهای مدیریت Hub کار نمی‌کند.
- تغییر سطح دسترسی، Ticket قدیمی را باطل می‌کند.
- رفتار backward-compatible اتصال‌های فعلی حفظ می‌شود.

---

## CR-03 — Ingest کامل پیام‌ها و Message ID canonical

### مشکل

Hub تاریخچه ندارد و webhook فقط وقتی اتاق اپراتور خالی است صدا زده می‌شود. پنل وب فعلی پیام‌های زنده را از سمت UI در Planet ذخیره می‌کند.

برای سوپراپ، History کامل و Dedup قابل‌اعتماد باید سمت سرور تضمین شود.

### روش پیشنهادی

Hub برای همه پیام‌های ورودی و خروجی یک رویداد `message.ingest` امضاشده به Planet بفرستد.

جایگزین قابل‌قبول: Planet یک Socket client دائمی روی Hub داشته باشد که همه پیام‌ها را دریافت و ذخیره کند.

### قواعد Ingest

- قرارداد هفت‌فیلدی Hub تغییر نکند.
- Planet برای هر پیام `message_id` canonical بسازد.
- `operator_id` از Ticket یا اتصال معتبر استخراج شود، نه از Payload کلاینت.
- پیام تکراری با `delivery_id` یا `dedupe_key` حذف شود.
- ترتیب پیام با `sent_at_ms` و `message_id` مشخص شود.
- Conversation باید از `(project_id, source, robot_id, channel_chat_id)` ساخته شود.
- ذخیره باید پیش از ACK موفق انجام شود.
- خطای ذخیره نباید به فرستنده ACK موفق بدهد.

### جریان ارسال اپراتور

دو الگوی مجاز:

**الگوی پیشنهادی Server Ingest:**

1. اپ پیام را به Hub می‌فرستد.
2. Hub پیام را به اپراتورها و Planet Ingest می‌فرستد.
3. Planet Message را ذخیره و شناسه می‌دهد.
4. اپ از Backlog یا رویداد Planet نسخه canonical را می‌گیرد.

**الگوی Fallback با ذخیره از اپ:**

1. اپ `client_mutation_id` تولید می‌کند.
2. اپ پیام را در Planet به‌صورت `pending` ذخیره می‌کند.
3. Planet `message_id` برمی‌گرداند.
4. اپ همان پیام را به Hub می‌فرستد.
5. Hub ACK می‌دهد.
6. اپ وضعیت را در Planet به `sent` تغییر می‌دهد.

الگوی Fallback نیازمند Idempotency قوی است.

### قالب پیام داخلی Planet

```text
id
conversation_id
client_mutation_id
sender_type
sender_id
text
attachment
sent_at_ms
created_at
updated_at
deleted_at
delivery_status
```

### معیار پذیرش

- وقتی اپراتور A آنلاین است و B آفلاین، پیام در Planet باقی می‌ماند.
- دریافت تکراری Hub باعث پیام تکراری نمی‌شود.
- هر پیام یک `message_id` پایدار دارد.
- پیام اپراتور با `operator_id` صحیح ذخیره می‌شود.
- History پس از Restart کامل است.
- قرارداد هفت‌فیلدی Hub حفظ شده است.

---

## CR-04 — Delta Sync و Backlog API

### مشکل

APIهای فعلی Planet:

- Conversation با Page Pagination
- Message با `before id`
- بدون cursor افزایشی
- بدون Tombstone
- بدون `updated_after`

برای آفلاین‌خواندنی، اپ باید تغییرات جدید، به‌روزرسانی‌ها و حذف‌ها را دریافت کند.

### API پیشنهادی

```http
GET /api/v1/chat/sync?cursor=<opaque>&limit=100
```

پاسخ:

```json
{
  "changes": [
    {
      "entity": "conversation",
      "id": "123",
      "op": "upsert",
      "version": 45,
      "updated_at": "2026-11-24T12:10:00Z",
      "data": {}
    },
    {
      "entity": "message",
      "id": "987",
      "op": "upsert",
      "version": 46,
      "updated_at": "2026-11-24T12:10:01Z",
      "data": {}
    },
    {
      "entity": "message",
      "id": "986",
      "op": "delete",
      "version": 47,
      "updated_at": "2026-11-24T12:10:02Z",
      "deleted_at": "2026-11-24T12:10:02Z"
    }
  ],
  "next_cursor": "opaque-cursor",
  "server_time": "2026-11-24T12:10:03Z",
  "has_more": false
}
```

### قواعد

- Cursor باید opaque و وابسته به Operator/Project باشد.
- Cursor فقط برای داده‌ای که کاربر مجاز به دیدن آن است صدور شود.
- تغییر نقش یا Project، Cursor قبلی را باطل کند.
- Cursor منقضی با HTTP 410 و نیاز به Full Resync برگردد.
- حذف باید Tombstone یا Change Log داشته باشد.
- آپدیت `delivery_status` نیز یک Change محسوب شود.
- Snapshot کامل برای اولین سینک ارائه شود.
- Pagination و Limit اجباری باشند.

### APIهای تکمیلی

```http
GET /api/v1/chat/conversations
GET /api/v1/chat/conversations/{id}/messages?before=<message_id>&limit=50
GET /api/v1/chat/bootstrap
```

### معیار پذیرش

- اپ پس از reconnect فقط تغییرات جدید را دریافت می‌کند.
- حذف رکورد در دستگاه اعمال می‌شود.
- تغییر وضعیت پیام هم سینک می‌شود.
- Cursor منقصری Full Resync امن انجام می‌دهد.
- کاربر داده خارج از Scope خود را دریافت نمی‌کند.

---

## CR-05 — سطوح پشتیبانی، Assignment و وضعیت گفتگو

### مشکل

در مدل فعلی Planet، Conversation هیچ `support_level`، `assigned_admin_id` یا `status` ندارد. Hub نیز فقط اتاق Project دارد.

### تغییرات داده پیشنهادی

```text
support_levels
  id
  project_id
  name
  slug
  sort_order
  active

operator_support_level
  operator_id
  support_level_id

support_hub_conversations
  support_level_id
  assigned_admin_id
  status
  updated_at
```

وضعیت‌های پیشنهادی:

```text
open
assigned
pending_customer
escalated
closed
```

### API پیشنهادی

| متد | مسیر | کاربرد |
|---|---|---|
| GET | `/api/v1/chat/support-levels` | سطوح مجاز اپراتور |
| POST | `/api/v1/chat/conversations/{id}/assign` | تخصیص اپراتور |
| POST | `/api/v1/chat/conversations/{id}/escalate` | ارتقای سطح |
| PATCH | `/api/v1/chat/conversations/{id}/status` | تغییر وضعیت |
| GET | `/api/v1/chat/operators` | اپراتورهای مجاز |

### قواعد

- اپراتور فقط گفتگوی سطح مجاز خود را ببیند، در صورت تأیید جداسازی داده.
- Assignment باید Transaction و بررسی مجوز داشته باشد.
- Escalation باید سطح مقصد را اعتبارسنجی کند.
- بستن گفتگو، ارسال پیام جدید را طبق سیاست محصول محدود کند.
- Hub باید Room یا Subscription سطح‌بندی‌شده بسازد؛ فیلتر UI کافی نیست.
- Ticket باید `support_level` و Scope به‌روز داشته باشد.

### معیار پذیرش

- گفتگو قابل تخصیص، ارتقا، بستن و بازکردن است.
- اپراتور سطح یک، در صورت جداسازی، پیام سطح سه را دریافت نمی‌کند.
- تغییر سطح، Ticket و Room را به‌روز می‌کند.
- عملیات بدون مجوز با 403 رد می‌شود.

---

## CR-06 — Attachment، File و Voice API

### وضعیت فعلی

Planet قبلاً موارد زیر را دارد:

- آپلود Attachment
- محدودیت حجم و MIME
- Proxy فایل Hub با Project Token سمت سرور
- metadata شامل `provider`، `type`، `url`، `file_name`، `mime_type`، `file_size`، `duration`

محدودیت‌ها:

- APIها Admin Session محورند.
- Attachment ID پایدار وجود ندارد.
- فایل روی Public Disk قرار می‌گیرد.
- Voice جدید بله نیازمند تبدیل و مسیر آپلود مناسب است.

### نیازمندی

- API موبایل برای آپلود و دریافت فایل
- Attachment ID پایدار
- دسترسی در سطح Conversation
- URL امضاشده یا Endpoint احراز هویت‌شده
- Retention و حذف فایل
- پشتیبانی از Cancel/Retry
- تعیین دامنه Voice/File هر کانال

### API پیشنهادی

| متد | مسیر | کاربرد |
|---|---|---|
| POST | `/api/v1/chat/attachments` | آپلود Multipart |
| GET | `/api/v1/chat/attachments/{id}` | metadata |
| GET | `/api/v1/chat/attachments/{id}/content` | دریافت فایل |
| DELETE | `/api/v1/chat/attachments/{id}` | حذف طبق Retention |

### پاسخ آپلود پیشنهادی

```json
{
  "attachment": {
    "id": "att_01J...",
    "provider": "planet",
    "type": "voice",
    "file_name": "voice-20261124.ogg",
    "mime_type": "audio/ogg",
    "file_size": 24512,
    "duration": 8,
    "url": null,
    "created_at": "2026-11-24T12:00:00Z"
  }
}
```

### Voice

- اپ فایل را به Planet آپلود کند.
- Planet تبدیل فرمت مناسب کانال را انجام دهد یا Adapter انجام دهد.
- برای بله، محدودیت `sendVoice` و OGG رعایت شود.
- در صورت عدم پشتیبانی، UI قابلیت Voice برای آن کانال را نشان ندهد.
- ویس آفلاین فقط در صورت دانلود عمدی فایل پخش شود.

### معیار پذیرش

- اپ بدون Project Token فایل مجاز را آپلود و دریافت می‌کند.
- فایل بدون مجوز Conversation دریافت نمی‌شود.
- فایل پس از Restart و منقضی‌شدن لینک provider در دسترس است.
- Voice در کانال‌های تأییدشده کار می‌کند.
- حذف و Retention طبق سیاست انجام می‌شود.

---

## CR-07 — API فقط‌خواندنی فروشگاه و حسابداری

### هدف

اپ موبایل/PWA فقط داده می‌خواند؛ هیچ عملیات نوشتن ندارد.

### APIهای موردنیاز فروشگاه

| دسته | داده |
|---|---|
| Dashboard | فروش، سفارش، مشتری، رشد |
| Orders | لیست، جزئیات، وضعیت، پرداخت، ارسال |
| Products | لیست، جزئیات، تنوع، موجودی |
| Inventory | موجودی و انبار |
| Reports | گزارش‌های پایه |

### APIهای موردنیاز حسابداری

| دسته | داده |
|---|---|
| Dashboard | مانده، دریافت، پرداخت، سود |
| Documents | لیست و جزئیات سند |
| Transactions | تراکنش و صورت‌حساب |
| Reports | گزارش‌های مالی پایه |
| Accounts | مانده حساب‌ها |

### قواعد

- همه Endpointها فقط `GET` باشند.
- Auth مستقل سرویس مدیریت حساب و مجوز ماژول بررسی شود؛ Auth سراسری استفاده نشود.
- پاسخ‌ها `id`، `updated_at` و در صورت نیاز `deleted_at` داشته باشند.
- برای آفلاین، Cursor یا `updated_after` پشتیبانی شود.
- داده حساس فقط با مجوز صریح دریافت شود.
- PWA داده فروشگاه و حسابداری را Persistent Cache نکند.
- در صورت نبود API،Endpointهای Admin/Inertia مستقیماً به اپ داده نشوند.

### معیار پذیرش

- اپلیکیشن هیچ عملیات POST/PATCH/DELETE در این ماژول‌ها ندارد.
- داده آنلاین و آفلاین درست نمایش داده می‌شود.
- آخرین زمان سینک مشخص است.
- کاربر بدون مجوز مالی داده حسابداری دریافت نمی‌کند.

---

## CR-08 — امنیت، Audit و Observability

### نیازمندی‌ها

- HTTPS برای Planet و WSS برای Hub
- عدم افشای Project Token به Client
- عدم ثبت Token، پیام یا داده مالی در لاگ
- Audit Log برای اتصال مستقل هر سرویس، Ticket، Assignment، Escalation و Export
- Rate Limit برای Ticket، اتصال هر سرویس، ارسال پیام و Attachment
- ابطال Session و Ticket هنگام Logout
- جداسازی داده Project/Operator
- Backup و Retention برای Message و Attachment
- متریک Connection، Ticket Failure، Ingest Lag و Sync Error
- هشدار در صورت رشد تأخیر Ingest

### تست‌های امنیتی

- Ticket با Audience اشتباه
- Ticket منقضی
- Ticket بازگشتی
- دسترسی به Conversation سطح دیگر
- دانلود فایل بدون مجوز
- ارسال پیام با `operator_id` جعلی
- تکرار `client_mutation_id`
- CSRF/XSS در متن پیام
- Rate Limit

---

## ۵. مدل خطای پیشنهادی

```json
{
  "status": false,
  "code": "TICKET_EXPIRED",
  "message": "اعتبار اتصال به پایان رسیده است.",
  "retryable": true,
  "errors": {}
}
```

کدهای حداقلی:

| کد | HTTP | معنی |
|---|---|---|
| `UNAUTHENTICATED` | 401 | نشست نامعتبر |
| `FORBIDDEN` | 403 | عدم مجوز |
| `TICKET_EXPIRED` | 401 | Ticket منقضی |
| `TICKET_INVALID` | 401 | Ticket نامعتبر |
| `CONVERSATION_FORBIDDEN` | 403 | گفتگو خارج از Scope |
| `CURSOR_EXPIRED` | 410 | نیاز به Full Resync |
| `DUPLICATE_MUTATION` | 200 | Mutation تکراری با نتیجه قبلی |
| `RATE_LIMITED` | 429 | محدودیت نرخ |
| `UPSTREAM_UNAVAILABLE` | 503 | Hub یا Provider در دسترس نیست |

---

## ۶. ماتریس تست تحویل Backend

| سناریو | نتیجه مورد انتظار |
|---|---|
| اتصال معتبر به یک سرویس | Access و Refresh Token همان سرویس |
| اتصال نامعتبر به یک سرویس | 401 بدون افشای اطلاعات |
| Ticket معتبر | اتصال Hub برقرار |
| Ticket منقضی | اتصال رد و نیاز به Refresh |
| Ticket سطح نامعتبر | عدم دریافت Room |
| پیام مشتری وقتی اپراتور آنلاین | ذخیره در Planet |
| پیام مشتری وقتی اپراتور آفلاین | ذخیره با webhook |
| ارسال تکراری پیام | یک رکورد canonical |
| قطع پاسخ پس از ذخیره | Retry بدون Duplicate |
| دریافت Backlog | همه پیام‌های ازدست‌رفته |
| حذف پیام | Tombstone و حذف محلی |
| فایل بدون مجوز | 403 |
| ویس نام پشتیبانی‌شده | خطای کنترل‌شده |
| خروج از یک سرویس | فقط Session و Ticket همان سرویس باطل |
| تغییر سطح اپراتور | دسترسی و Room به‌روز |

---

## ۷. مواردی که Backend نباید تغییر دهد

- قرارداد هفت‌فیلدی پیام Hub
- اصل transport-only بودن Hub
- منع ذخیره تاریخچه در Hub
- HMAC و مدل امنیتی webhook
- تک‌نمونه بودن Hub و Bale Service، مگر اینکه Redis Adapter و طراحی متناظر اضافه شود
- محدودیت‌های Provider بله
- رفتار ACK فقط پس از ذخیره ماندگار

---

## ۸. ترتیب پیشنهادی اجرای Backend

1. **CR-01:** Auth API مستقل هر سرویس؛ در MVP با Mock
2. **CR-02:** Ticket در Hub و Planet
3. **CR-03:** Ingest کامل و Message ID
4. **CR-04:** Delta Sync
5. **CR-06:** Attachment/File/Voice API
6. **CR-05:** سطوح پشتیبانی و Assignment
7. **CR-07:** APIهای فروشگاه و حسابداری
8. **CR-08:** Hardening و Observability

---

## ۹. چک‌لیست تحویل

- [x] سورس مرجع Planet و Hub فقط‌خواندنی است.
- [x] قابلیت‌های موجود مستند شده‌اند.
- [x] APIهای فعلی و Auth آنها استخراج شده‌اند.
- [x] مدل داده موجود مستند شده است.
- [x] Change Requestها اولویت‌بندی شده‌اند.
- [x] قراردادهای پیشنهادی API ثبت شده‌اند.
- [x] معیار پذیرش هر Change Request نوشته شده است.
- [ ] تصمیم نهایی Auth API مستقل هر سرویس توسط تیم Backend
- [ ] تصمیم نهایی Ticket Signature/Introspection
- [ ] تصمیم نهایی سطوح پشتیبانی
- [ ] تصمیم نهایی Voice/File کانال‌ها
- [ ] تصمیم نهایی Retention
- [ ] پیاده‌سازی CR-01 تا CR-08 توسط توسعه‌دهنده Backend
- [ ] تحویل Staging API و نمونه Ticket به تیم Frontend

---

## ۱۰. تاریخچه سند

| نسخه | تاریخ | تغییر |
|---|---|---|
| 1.0 | 2026-11-24 | استخراج قابلیت‌های موجود و ثبت CR-01 تا CR-08 |
| 1.1 | 2026-11-24 | حذف Auth سراسری، تعریف Auth مستقل هر سرویس، Mock بودن امنیت MVP و جداکردن قرارداد Production |
