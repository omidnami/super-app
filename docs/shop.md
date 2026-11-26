# ماژول فروشگاه فقط‌خواندنی

> مرحله: STEP-13
>
> پکیج: `@superapp/shop`

---

## ۱. هدف

داشبورد، سفارش‌ها و محصولات فقط‌خواندنی با داده آنلاین Planet و Cache آفلاین موبایل.

---

## ۲. اجزا

- `ShopScreen`
- `MetricCard`
- `OrderCard` و `OrderDetail`
- `ProductCard` و `ProductDetail`
- `InventoryBadge`
- `useShop`
- `ShopApi` و `ShopCache`

هیچ API یا دکمه ثبت، ویرایش، حذف یا تغییر موجودی وجود ندارد.

---

## ۳. دسترسی

- مجوز `shop.read` الزامی است.
- بدون مجوز، هیچ درخواست فروشگاهی اجرا نمی‌شود.
- Cache موبایل با Scope اپراتور/پروژه ایزوله می‌شود.
- Logout حساب، Cache فروشگاه همان Scope را پاک می‌کند.
- PWA داده فروشگاه را Persistent نمی‌کند.

---

## ۴. API

- `GET /api/v1/account/shop/dashboard`
- `GET /api/v1/account/shop/orders`
- `GET /api/v1/account/shop/orders/{id}`
- `GET /api/v1/account/shop/products`
- `GET /api/v1/account/shop/products/{id}`

Bearer Token حساب، Queryهای Search/Status/Cursor و AbortSignal پشتیبانی می‌شوند.

---

## ۵. آفلاین و Stale Data

- موبایل Dashboard، سفارش‌ها و محصولات را در SQLite ذخیره می‌کند.
- در قطع شبکه یا خطای سرور، Cache خوانده می‌شود؛ Pagination آفلاین نیز صفحه بعد را از Repository محلی می‌خواند.
- `401`، `403` و `404` هرگز به Cache فروشگاهی Fallback نمی‌کنند.
- آخرین زمان سینک و Badge «داده قدیمی» در لیست و جزئیات نمایش داده می‌شود.
- نتیجه خالیِ سینک‌شده با «نبود داده آفلاین» اشتباه گرفته نمی‌شود.
- تغییر Scope یا مجوز، درخواست‌های قبلی را Abort و داده قبلی را پاک می‌کند.

---

## ۶. فرمت

- مبالغ با `MoneyText` و تومان
- تاریخ‌ها با `PersianDateText`
- اعداد با ارقام فارسی
- RTL در موبایل و وب

---

## ۷. تست‌ها

- Online Dashboard/Orders/Products
- Offline Cache، Pagination آفلاین و Stale Data
- Empty Result و تفکیک Cache خالی از نبود داده
- عدم Fallback روی 403/404
- Search، Status و Pagination
- جزئیات سفارش و محصول
- Cache Logout، Scope کاربر و Abort درخواست‌ها
- اعتبارسنجی پاسخ Planet و AbortSignal
- نبود عملیات نوشتن
