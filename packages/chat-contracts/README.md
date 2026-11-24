# Chat Contracts

تایپ‌های مشترک Auth، Ticket، Conversation، Message، Hub Message، Sync، Media، Shop و Accounting سوپراپلیکیشن.

## استفاده

```ts
import type { Conversation, CanonicalMessage, ConnectionTicket } from '@superapp/chat-contracts'
```

## قواعد

- قرارداد پیام Hub هفت فیلد دارد و در `HubMessage` تعریف شده است.
- Model canonical پیام در `CanonicalMessage` و فقط در Planet/اپ استفاده می‌شود.
- Auth سراسری وجود ندارد؛ `ServiceSession` برای هر سرویس مستقل است.
- Project Token Hub در این پکیج وجود ندارد.
