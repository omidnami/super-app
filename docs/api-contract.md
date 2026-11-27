# قرارداد API و Mock سوپراپلیکیشن

> نسخه: 1.0
>
> تاریخ: 2026-11-24
>
> وضعیت: قرارداد MVP با امنیت Mock؛ آماده اتصال به API واقعی Planet پس از تأیید Backend

---

## ۱. اصول قرارداد

- عضویت یا ورود سراسری وجود ندارد.
- سرویس پیام‌رسان و سرویس مدیریت حساب، Auth و Session مستقل دارند.
- CRM هیچ Endpoint شبکه ندارد.
- Project Token Hub هرگز در قرارداد Client وجود ندارد.
- Connection Ticket فقط برای Socket.IO اپراتور است.
- Hub همچنان پیام هفت‌فیلدی دارد؛ Model canonical در Planet و اپ استفاده می‌شود.
- فروشگاه و حسابداری فقط `GET` هستند.
- سینک یک‌طرفه از سرور به دستگاه است.
- در MVP، Token، Ticket، مجوز و خطاهای امنیتی Mock هستند.

---

## ۲. Base URL و Response Envelope

### Mock

```text
https://mock.superapp.local
```

### Production

Base URL واقعی Planet توسط تیم Backend ارائه می‌شود و در Environment Config قرار می‌گیرد.

### موفق

```json
{
  "status": true,
  "data": {}
}
```

### خطا

```json
{
  "status": false,
  "code": "VALIDATION_ERROR",
  "message": "داده ورودی معتبر نیست.",
  "retryable": false,
  "errors": {
    "client_mutation_id": ["الزامی است."]
  }
}
```

---

## ۳. Auth مستقل سرویس پیام‌رسان

### ۳.۱. ایجاد Session

```http
POST /api/v1/messaging/auth/session
Content-Type: application/json
```

Request:

```json
{
  "operator_id": "op_42",
  "project_id": "prj_12",
  "access_code": "demo"
}
```

Response:

```json
{
  "status": true,
  "data": {
    "access_token": "mock_messaging_access_op_42",
    "refresh_token": "mock_messaging_refresh_op_42",
    "token_type": "Bearer",
    "expires_in": 900,
    "service": "messaging",
    "context": {
      "operator_id": "op_42",
      "operator_name": "سارا رضایی",
      "project_id": "prj_12",
      "project_name": "فروشگاه توکا",
      "support_level": "level_1",
      "permissions": ["chat.read", "chat.write", "chat.assign", "chat.escalate"]
    }
  }
}
```

### ۳.۲. Refresh

```http
POST /api/v1/messaging/auth/refresh
```

```json
{
  "refresh_token": "mock_messaging_refresh_op_42"
}
```

### ۳.۳. Logout

```http
POST /api/v1/messaging/auth/logout
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
```

```json
{
  "refresh_token": "mock_messaging_refresh_op_42"
}
```

### ۳.۴. Context

```http
GET /api/v1/messaging/auth/context
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
```

خروجی شامل Operator، Project، سطح پشتیبانی و مجوزهای چت است.

---

## ۴. Auth مستقل سرویس مدیریت حساب

### ۴.۱. ایجاد Session

```http
POST /api/v1/account/auth/session
```

Request:

```json
{
  "operator_id": "op_42",
  "project_id": "prj_12",
  "access_code": "demo"
}
```

Response:

```json
{
  "status": true,
  "data": {
    "access_token": "mock_account_access_op_42",
    "refresh_token": "mock_account_refresh_op_42",
    "token_type": "Bearer",
    "expires_in": 900,
    "service": "account",
    "context": {
      "operator_id": "op_42",
      "operator_name": "سارا رضایی",
      "project_id": "prj_12",
      "project_name": "فروشگاه توکا",
      "permissions": ["shop.read", "accounting.read", "account.settings.read"]
    }
  }
}
```

### ۴.۲. سایر مسیرها

| متد | مسیر |
|---|---|
| POST | `/api/v1/account/auth/refresh` |
| POST | `/api/v1/account/auth/logout` |
| GET | `/api/v1/account/auth/context` |

خروج از سرویس مدیریت حساب نباید Session پیام‌رسان یا CRM محلی را باطل کند.

---

## ۵. Connection Ticket

### ۵.۱. صدور Ticket

```http
POST /api/v1/chat/connection-ticket
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
```

Response:

```json
{
  "status": true,
  "data": {
    "hub_url": "wss://mock-hub.superapp.local",
    "connection_token": "mock_ticket_0001",
    "expires_at": "2026-11-24T12:15:00.000Z",
    "project_id": "prj_12",
    "operator_id": "op_42",
    "support_level": "level_1",
    "allowed_sources": ["bale", "chat"]
  }
}
```

### ۵.۲. Refresh Ticket

```http
POST /api/v1/chat/connection-ticket/refresh
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
```

### ۵.۳. Claimهای Production

```text
iss
aud
sub
project_id
support_level
allowed_sources
allowed_conversations
iat
exp
jti
```

قواعد:

- Ticket در حافظه اپ نگهداری می‌شود.
- Ticket در SQLite یا localStorage ذخیره نمی‌شود.
- Ticket فقط برای Socket.IO اپراتور است.
- Project Token Hub در پاسخ Ticket وجود ندارد.

---

## ۶. Bootstrap چت

```http
GET /api/v1/chat/bootstrap
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
```

Response:

```json
{
  "status": true,
  "data": {
    "project": { "id": "prj_12", "name": "فروشگاه توکا" },
    "operator": {
      "id": "op_42",
      "name": "سارا رضایی",
      "project_id": "prj_12",
      "project_name": "فروشگاه توکا",
      "support_level": "level_1",
      "permissions": ["chat.read", "chat.write", "chat.assign", "chat.escalate"]
    },
    "support_levels": [
      { "id": "level_1", "title": "پشتیبانی سطح یک", "color": "#f97316" },
      { "id": "level_2", "title": "پشتیبانی سطح دو", "color": "#0ea5e9" },
      { "id": "level_3", "title": "پشتیبانی سطح سه", "color": "#8b5cf6" }
    ]
  }
}
```

---

## ۷. Conversationها

### ۷.۱. فهرست

```http
GET /api/v1/chat/conversations?cursor=&limit=30&search=&source=bale&support_level=level_1&status=open&assignee_operator_id=op_42&unread_only=true
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
```

Response:

```json
{
  "status": true,
  "data": {
    "items": [
      {
        "id": "conv_1001",
        "project_id": "prj_12",
        "source": "bale",
        "robot_id": "987654",
        "chat_id": "501",
        "customer": {
          "id": "usr_501",
          "display_name": "علی محمدی",
          "mobile": "۰۹۱۲۱۲۳۴۵۶۷",
          "initials": "عم"
        },
        "support_level": "level_1",
        "status": "open",
        "assignee": { "id": "op_42", "name": "سارا رضایی" },
        "last_message": "سلام، وضعیت سفارش من چیست؟",
        "last_message_at": "2026-11-24T10:42:00.000Z",
        "unread_count": 2,
        "created_at": "2026-11-24T10:40:00.000Z",
        "updated_at": "2026-11-24T10:42:00.000Z",
        "deleted_at": null
      }
    ],
    "next_cursor": "offset_1",
    "has_more": true,
    "total": 3
  }
}
```

### ۷.۲. جزئیات

```http
GET /api/v1/chat/conversations/{conversation_id}
```

### ۷.۳. تاریخچه پیام

```http
GET /api/v1/chat/conversations/{conversation_id}/messages?before=&cursor=&limit=50
```

Response:

```json
{
  "status": true,
  "data": {
    "items": [
      {
        "id": "msg_2001",
        "conversation_id": "conv_1001",
        "client_mutation_id": null,
        "sender": "client",
        "sender_id": "usr_501",
        "text": "سلام، وضعیت سفارش من چیست؟",
        "attachment": null,
        "sent_at": "2026-11-24T10:40:00.000Z",
        "created_at": "2026-11-24T10:40:00.000Z",
        "updated_at": "2026-11-24T10:40:00.000Z",
        "deleted_at": null,
        "delivery_status": "sent"
      }
    ],
    "next_cursor": null,
    "has_more": false,
    "conversation": {}
  }
}
```

---

## ۸. ارسال پیام و وضعیت تحویل

### ۸.۱. ارسال

```http
POST /api/v1/chat/messages
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
```

```json
{
  "source": "bale",
  "robot_id": "987654",
  "channel_chat_id": "501",
  "sender": "operator",
  "text": "شماره مرسوله ارسال شد.",
  "attachment": null,
  "client_mutation_id": "cm_01JABC123",
  "sent_at": "2026-11-24T10:45:00.000Z"
}
```

Response:

```json
{
  "status": true,
  "data": {
    "created": true,
    "conversation": {},
    "message": {
      "id": "msg_2100",
      "conversation_id": "conv_1001",
      "client_mutation_id": "cm_01JABC123",
      "sender": "operator",
      "sender_id": "op_42",
      "text": "شماره مرسوله ارسال شد.",
      "attachment": null,
      "sent_at": "2026-11-24T10:45:00.000Z",
      "created_at": "2026-11-24T10:45:00.000Z",
      "updated_at": "2026-11-24T10:45:00.000Z",
      "deleted_at": null,
      "delivery_status": "pending"
    }
  }
}
```

اگر همان `client_mutation_id` دوباره ارسال شود، پاسخ با `created: false` و همان `message.id` برگردد.

### ۸.۲. تغییر وضعیت

```http
POST /api/v1/chat/messages/{message_id}/status
```

```json
{
  "status": "sent"
}
```

### ۸.۳. ثبت خواندن

```http
POST /api/v1/chat/conversations/{conversation_id}/read
```

---

## ۹. تخصیص، ارتقا و وضعیت گفتگو

| عملیات | مسیر | Body |
|---|---|---|
| تخصیص | `POST /api/v1/chat/conversations/{id}/assign` | `{ "operator_id": "op_42" }` |
| ارتقا | `POST /api/v1/chat/conversations/{id}/escalate` | `{ "support_level": "level_2", "reason": "نیاز به بررسی فنی" }` |
| تغییر وضعیت | `POST /api/v1/chat/conversations/{id}/status` | `{ "status": "closed" }` |

وضعیت‌های مجاز:

```text
open
assigned
pending_customer
escalated
closed
```

---

## ۱۰. قرارداد پیام Hub

Hub همچنان دقیقاً هفت فیلد دارد:

```json
{
  "user_id": "501",
  "sender": "operator",
  "text": "سلام",
  "file": null,
  "robot_id": "987654",
  "timestamp": 1794841200000,
  "source": "bale"
}
```

نگاشت از Model canonical:

| Hub | Planet |
|---|---|
| `user_id` | `conversation.chat_id` |
| `sender` | `message.sender` |
| `text` | `message.text` |
| `file` | `message.attachment` |
| `robot_id` | `conversation.robot_id` |
| `timestamp` | `Date.parse(message.sent_at)` |
| `source` | `conversation.source` |

`message_id`، `conversation_id`، `support_level` و `delivery_status` به پیام Hub اضافه نمی‌شوند.

---

## ۱۱. Delta Sync

```http
GET /api/v1/chat/sync?cursor=&limit=100&conversation_id=&project_id=
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
```

Response:

```json
{
  "status": true,
  "data": {
    "changes": [
      {
        "entity": "conversation",
        "id": "conv_1001",
        "op": "upsert",
        "version": 3,
        "updated_at": "2026-11-24T10:42:00.000Z",
        "deleted_at": null,
        "data": {}
      },
      {
        "entity": "message",
        "id": "msg_2003",
        "op": "upsert",
        "version": 1,
        "updated_at": "2026-11-24T10:42:00.000Z",
        "deleted_at": null,
        "data": {}
      }
    ],
    "next_cursor": "mock_cursor_1",
    "server_time": "2026-11-24T10:46:00.000Z",
    "has_more": false
  }
}
```

قواعد:

- cursor فقط پس از Commit موفق محلی جلو می‌رود.
- حذف با `op: delete` و `deleted_at` منتقل می‌شود.
- cursor منقضی در Production با HTTP 410 و نیاز به Full Resync برگردد.
- تغییر `delivery_status` نیز یک Change است.
- داده خارج از Scope اپراتور برگردانده نمی‌شود.

---

## ۱۲. Attachment و File

### ۱۲.۱. آپلود

```http
POST /api/v1/chat/attachments?conversation_id={conversation_id}
Authorization: Bearer <MESSAGING_ACCESS_TOKEN>
Content-Type: application/json
```

در MVP، Mock آپلود را با metadata شبیه‌سازی می‌کند:

```json
{
  "kind": "voice",
  "file_name": "voice-001.ogg",
  "mime_type": "audio/ogg",
  "file_size": 24512,
  "duration": 8
}
```

Response:

```json
{
  "status": true,
  "data": {
    "id": "att_3100",
    "provider": "planet",
    "type": "voice",
    "file_name": "voice-001.ogg",
    "mime_type": "audio/ogg",
    "file_size": 24512,
    "duration": 8,
    "url": null,
    "created_at": "2026-11-24T10:47:00.000Z"
  }
}
```

در Production، آپلود می‌تواند Multipart باشد؛ قرارداد نهایی توسط CR-06 تعیین می‌شود.

### ۱۲.۲. دریافت metadata و محتوا

```http
GET /api/v1/chat/attachments/{attachment_id}?conversation_id={conversation_id}
GET /api/v1/chat/attachments/{attachment_id}/content?conversation_id={conversation_id}
```

Mock برای `content` یک Blob شبیه‌سازی‌شده همراه metadata برمی‌گرداند؛ Production فایل واقعی را Stream می‌کند. مجوز Conversation در هر سه Endpoint بررسی می‌شود و URL موقت Provider نباید در Message یا SQLite ذخیره شود.

---

## ۱۳. فروشگاه فقط‌خواندنی

| متد | مسیر |
|---|---|
| GET | `/api/v1/account/shop/dashboard` |
| GET | `/api/v1/account/shop/orders` |
| GET | `/api/v1/account/shop/orders/{order_id}` |
| GET | `/api/v1/account/shop/products` |
| GET | `/api/v1/account/shop/products/{product_id}` |

همه مسیرها نیازمند `ACCOUNT_ACCESS_TOKEN` هستند.

نمونه Order:

```json
{
  "id": "ord_4001",
  "code": "TK-1008",
  "customer_name": "علی محمدی",
  "status": "processing",
  "payment_status": "paid",
  "total": { "amount": 12989000, "currency": "IRR" },
  "created_at": "2026-11-24T08:20:00.000Z",
  "updated_at": "2026-11-24T10:30:00.000Z",
  "deleted_at": null,
  "lines": []
}
```

هر درخواست نوشتن با HTTP 405 رد می‌شود.

---

## ۱۴. حسابداری فقط‌خواندنی

| متد | مسیر |
|---|---|
| GET | `/api/v1/account/accounting/dashboard` |
| GET | `/api/v1/account/accounting/documents` |
| GET | `/api/v1/account/accounting/documents/{document_id}` |

Queryهای فهرست اسناد: `search`، `type`، `status`، `issued_from`، `issued_to`، `cursor` و `limit` هستند. بازه `issued_from/issued_to` می‌تواند ISO DateTime یا `YYYY-MM-DD` باشد و مرزهای آن inclusive هستند. تاریخ نامعتبر یا بازه معکوس با `422 VALIDATION_ERROR` رد می‌شود.

نمونه سند:

```json
{
  "id": "acc_6001",
  "code": "INV-2026-1108",
  "type": "invoice",
  "status": "confirmed",
  "counterparty_name": "علی محمدی",
  "total": { "amount": 12989000, "currency": "IRR" },
  "issued_at": "2026-11-24T08:25:00.000Z",
  "updated_at": "2026-11-24T08:25:00.000Z",
  "deleted_at": null,
  "description": "فاکتور فروش سفارش TK-1008"
}
```

هر درخواست نوشتن با HTTP 405 رد می‌شود.

---

## ۱۵. خطاهای استاندارد

| HTTP | Code | retryable | کاربرد |
|---|---|---|---|
| 401 | `UNAUTHENTICATED` | false | نبود یا انقضای Session |
| 401 | `TICKET_EXPIRED` | true | Ticket منقضی |
| 401 | `TICKET_INVALID` | false | Ticket نامعتبر |
| 403 | `FORBIDDEN` | false | عدم مجوز |
| 403 | `CONVERSATION_FORBIDDEN` | false | گفتگو خارج از Scope |
| 404 | `NOT_FOUND` | false | منبع پیدا نشد |
| 405 | `METHOD_NOT_ALLOWED` | false | عملیات نوشتن در ماژول فقط‌خواندنی |
| 409 | `CONFLICT` | false | تعارض وضعیت یا Mutation |
| 410 | `CURSOR_EXPIRED` | true | نیاز به Full Resync |
| 422 | `VALIDATION_ERROR` | false | داده ورودی نامعتبر |
| 429 | `RATE_LIMITED` | true | محدودیت نرخ |
| 503 | `UPSTREAM_UNAVAILABLE` | true | Hub یا Provider در دسترس نیست |
| Network | `NETWORK_ERROR` | true | خطای شبکه |

### شبیه‌سازی خطا در Mock

```text
x-mock-scenario: unauthorized
x-mock-scenario: forbidden
x-mock-scenario: conflict
x-mock-scenario: validation
x-mock-scenario: rate
x-mock-scenario: upstream
x-mock-scenario: network
```

---

## ۱۶. استفاده از Mock Fetch

```js
import { createMockFetch } from '@superapp/api-client/mocks'

const mockFetch = createMockFetch()

const sessionResponse = await mockFetch('/api/v1/messaging/auth/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operator_id: 'op_42',
    project_id: 'prj_12',
    access_code: 'demo',
  }),
})

const session = await sessionResponse.json()
const token = session.data.access_token

const conversationsResponse = await mockFetch('/api/v1/chat/conversations', {
  headers: { Authorization: `Bearer ${token}` },
})
```

---

## ۱۷. تفاوت Mock و Production

| موضوع | MVP Mock | Production |
|---|---|---|
| Auth | Token ساختگی و `access_code=demo` | Auth واقعی هر سرویس |
| Ticket | Ticket Mock کوتاه‌عمر | Ticket امضاشده یا Introspection |
| Message ID | شناسه Mock پایدار | شناسه canonical Planet |
| Attachment | metadata ساختگی | Multipart/Stream و Object Storage |
| Sync | cursor ساده Mock | cursor امن و Scope‌دار |
| Error | سناریوهای قابل شبیه‌سازی | خطاهای واقعی Backend |
| Project Token | وجود ندارد | فقط در Backend |

---

## ۱۸. خروجی‌های این استپ

- `docs/api-contract.md`
- `docs/openapi.yaml`
- `packages/chat-contracts/src`
- `packages/api-client/mocks`
- `packages/api-client/mocks/fixtures`
- `packages/api-client/mocks/index.test.mjs`

---

## ۱۹. معیار پذیرش STEP-01

- [x] Auth مستقل پیام‌رسان و مدیریت حساب تعریف شده است.
- [x] Auth سراسری وجود ندارد.
- [x] امنیت MVP به‌صورت Mock تعریف شده است.
- [x] Connection Ticket و Claimهای آن مستند است.
- [x] Conversation و Message canonical مستند است.
- [x] قرارداد هفت‌فیلدی Hub حفظ شده است.
- [x] APIهای گفتگو، Backlog، تخصیص، ارتقا و وضعیت مستند هستند.
- [x] cursor، حذف و صفحه‌بندی مستند هستند.
- [x] APIهای فقط‌خواندنی فروشگاه و حسابداری مستند هستند.
- [x] Proxy فایل و Attachment مستند هستند.
- [x] نمونه Success و Error برای Endpointها وجود دارد.
- [x] Fixtureهای فارسی ساخته شده‌اند.
- [x] Mock API قابل استفاده است.
- [x] سناریوهای 401، 403، 409، 422 و Network Error تست شده‌اند.
- [x] هیچ Project Token Hub در قرارداد Client وجود ندارد.
