# Hub Client و مدیریت اتصال

> مرحله: STEP-06
>
> پکیج: `@superapp/hub-client`

---

## ۱. هدف

اتصال مستقیم اپ به Support Hub با Connection Ticket کوتاه‌عمر، بدون دریافت Project Token Hub.

---

## ۲. اجزا

- `HubConnectionProvider`
- `useHubConnection`
- `createSocketIoHubTransport`
- `createMockTicketAdapter`
- `createMockHubTransport`
- `TicketAdapter` و `HubTransport` Interfaceها

---

## ۳. وضعیت اتصال

```text
disconnected
connecting
connected
reconnecting
expired
error
```

رویدادهای مدیریت‌شده:

- `connect`
- `authenticated`
- `disconnect`
- `connect_error`
- `chat`
- `chat_error`

---

## ۴. Ticket

Ticket Adapter با Session سرویس پیام‌رسان کار می‌کند و Ticket زیر را برمی‌گرداند:

```text
hub_url
connection_token
expires_at
project_id
operator_id
support_level
allowed_sources
```

قواعد:

- Ticket فقط برای Socket.IO اپراتور است.
- Ticket در حافظه نگهداری می‌شود.
- پیش از انقضا Refresh می‌شود.
- Refresh Ticket اتصال قبلی را قطع و اتصال تازه ایجاد می‌کند.
- Project Token Hub دریافت یا ذخیره نمی‌شود.

---

## ۵. Reconnect

- حداکثر ۵ تلاش
- Backoff نمایی از ۱ ثانیه تا ۱۰ ثانیه
- ریست شمارنده پس از احراز هویت موفق
- امکان Retry دستی
- قطع عمدی، Reconnect را متوقف می‌کند

---

## ۶. Buffer رویدادها

هنگام Backlog Reconciliation:

1. `startBuffering` فراخوانی می‌شود.
2. رویدادهای `chat` در Buffer نگهداری می‌شوند.
3. Backlog از Planet دریافت و Merge می‌شود.
4. `stopBuffering` رویدادهای باقی‌مانده را برمی‌گرداند.
5. Merge نهایی با `message_id` انجام می‌شود.

تا پایان Reconciliation، رویدادهای Buffer به Listenerها تحویل داده نمی‌شوند.

---

## ۷. قرارداد پیام

Hub همچنان هفت فیلد دارد:

```text
user_id
sender
text
file
robot_id
timestamp
source
```

`message_id` و `conversation_id` از Planet می‌آیند و به پیام Hub اضافه نمی‌شوند.

---

## ۸. امنیت

- هیچ Token یا محتوای پیام در لاگ ثبت نمی‌شود.
- Ticket Adapter باید Session معتبر پیام‌رسان را بررسی کند.
- Transport فقط Real-Time است و تاریخچه از Hub دریافت نمی‌کند.
- Adapter واقعی باید همان Interfaceهای Mock را پیاده کند.

---

## ۹. تست‌ها

- اتصال با Ticket Mock
- ارسال و دریافت پیام زنده
- قطع و اتصال مجدد
- Buffer رویدادها
- Refresh Ticket منقضی
- خطای اتصال و بازیابی

تست‌های فعلی با Mock Transport اجرا می‌شوند؛ اتصال واقعی به Hub در فاز Integration آزمایش می‌شود.
