# Auth مستقل سرویس‌ها

> مرحله: STEP-05
>
> پکیج: `@superapp/auth`

---

## ۱. تصمیم محصول

- عضویت و ورود سراسری وجود ندارد.
- پیام‌رسان و مدیریت حساب هرکدام Session مستقل دارند.
- CRM محلی بدون Auth هیچ سرویس قابل‌دسترسی است.
- خروج از یک سرویس، سرویس دیگر یا CRM را باطل نمی‌کند.
- در MVP، امنیت با Mock Adapter پیاده می‌شود.

---

## ۲. اجزا

- `ServiceSessionProvider`
- `ServiceAuthBoundary`
- `useServiceSession`
- `createMockAuthAdapter`
- `authStorageKey`

UI Kit این اجزا را از `@superapp/ui` نیز Export می‌کند.

---

## ۳. وضعیت‌ها

```text
disconnected
connecting
connected
expired
error
```

Flow هر سرویس:

- Connect
- Disconnect
- Refresh
- Expire
- Error 401/403 مخصوص همان سرویس

---

## ۴. ذخیره‌سازی

کلیدهای جداگانه:

```text
superapp.auth.messaging.v1
superapp.auth.account.v1
```

- موبایل: AsyncStorage با `StorageAdapter`
- PWA: localStorage با `StorageAdapter`
- Production: Session Token هر سرویس در SecureStore/Keychain/Keystore نگهداری می‌شود.
- Project Token Hub در هیچ لایه اپ ذخیره نمی‌شود.

---

## ۵. Mock Adapter

- رمز دسترسی Demo: `demo`
- Operator پیش‌فرض: `op_42`
- Project پیش‌فرض: `prj_12`
- Tokenهای ساختگی با پیشوند `mock_`
- عمر پیش‌فرض Session: ۱۵ دقیقه
- قابلیت شبیه‌سازی انقضا برای تست UI

Adapter واقعی باید همان Interface را پیاده کند:

```text
connect
refresh
validate
logout
expire (اختیاری)
```

---

## ۶. قواعد امنیتی

- هیچ Token یا داده حساسی در لاگ ثبت نمی‌شود.
- خطای یک سرویس روی سرویس دیگر اثر نمی‌گذارد.
- Provider هر سرویس با `key` مستقل در App Shellmount می‌شود.
- CRM خارج از Provider سرویس قرار می‌گیرد.
- Boundary تا پایان Hydration، محتوای محافظت‌شده را نمایش نمی‌دهد.
- Callback اختیاری `onLogout` پس از حذف Session اجرا می‌شود تا داده‌های متعلق به همان سرویس و اپراتور نیز پاک شوند.

---

## ۷. تست‌ها

- استقلال Session پیام‌رسان و مدیریت حساب
- ذخیره جداگانه در Storage
- بازیابی Session پس از Remount
- انقضای Session و نمایش Fallback
- خطای 401 برای اطلاعات ورودی نامعتبر
- اجرای `onLogout` با Session صحیح پیش از پاک‌شدن کامل State
- دسترسی CRM بدون Provider
