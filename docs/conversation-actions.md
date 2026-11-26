# سطوح پشتیبانی و عملیات گفتگو

> مرحله: STEP-12

---

## ۱. هدف

تخصیص اپراتور، ارجاع به سطح بالاتر، بستن و بازکردن گفتگو با Optimistic Update و بررسی مجوز.

---

## ۲. اجزا

- `useConversationActions`
- `AssignmentSheet`
- `EscalationSheet`
- `ConversationStatusSheet`
- `ConversationActionsBar`
- `SupportLevelBadge`

---

## ۳. مجوزها

- `chat.assign`: تخصیص و تغییر وضعیت
- `chat.escalate`: ارجاع به سطح بالاتر
- اپراتور فقط روی گفتگو با سطح کمتر یا مساوی سطح خود عمل می‌کند
- ارجاع فقط به سطح بالاتر انجام می‌شود
- گفتگوی بسته قابل تخصیص یا ارجاع نیست، اما می‌تواند باز شود

این بررسی‌ها برای UI هستند؛ مجوز نهایی باید در Planet و Hub بررسی شود.

---

## ۴. API

- `POST /api/v1/chat/conversations/{id}/assign`
- `POST /api/v1/chat/conversations/{id}/escalate`
- `POST /api/v1/chat/conversations/{id}/status`

همه درخواست‌ها Bearer Token پیام‌رسان، JSON Body و AbortSignal دارند.

---

## ۵. Optimistic Update

1. تغییر فقط در UI و State محلی اعمال می‌شود.
2. پاسخ سرور نسخه Canonical را جایگزین می‌کند.
3. در خطا، نسخه قبلی Rollback می‌شود.
4. خطای 403 پیام دسترسی نمایش می‌دهد.
5. خطای 409، گفتگو را با `GET` تازه می‌کند.
6. Retry خودکار انجام نمی‌شود.

---

## ۶. محدودیت Hub

Hub فعلی سطح پشتیبانی و اپراتور مسئول را در پیام هفت‌فیلدی ارسال نمی‌کند. این Blocker قبلاً در `BLK-04` ثبت شده است؛ فیلتر UI جایگزین جداسازی سمت سرور نیست.

---

## ۷. تست‌ها

- تخصیص مجاز و Optimistic Update
- عدم مجوز نقش یا سطح
- ارجاع، بستن و بازکردن
- Rollback پس از 403
- Rollback و Refresh پس از 409
- تعارض API Mock
- Body و Bearer Token Adapter واقعی
- جریان کامل Sheetها در PWA
