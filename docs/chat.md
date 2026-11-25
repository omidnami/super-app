# چت متنی و Real-Time

> مرحله: STEP-09
>
> پکیج: `@superapp/chat`
>
> کامپوننت‌ها: `@superapp/ui/native` و `@superapp/ui/web`

---

## ۱. هدف

صفحه چت متنی با تاریخچه صفحه‌بندی‌شده، ارسال Optimistic، دریافت زنده، Dedup، وضعیت تحویل و Cache آفلاین موبایل.

---

## ۲. اجزا

- `useChat`
- `ChatScreen`
- `ChatBubble`
- `MessageComposer`
- `MessageStatus`
- `EmojiButton`
- `MessageCache`

UI مستقیماً Socket، `fetch` یا SQL نمی‌نویسد.

---

## ۳. تاریخچه

- دریافت صفحه اول از `ConversationApi.listMessages`
- Pagination با Cursor از جدیدترین به قدیمی‌ترین
- ذخیره پیام‌های canonical در SQLite موبایل
- Fallback به Cache فقط در خطای شبکه
- نمایش داده Cache با برچسب آفلاین
- PWA هیچ Cache Persistent داده کسب‌وکار ندارد

رویدادهای Hub در زمان دریافت تاریخچه اولیه Buffer می‌شوند و پس از Merge آزاد می‌شوند.

---

## ۴. ارسال پیام

1. اعتبارسنجی متن خالی، طول بیش از ۴۰۰۰ کاراکتر و وضعیت اتصال
2. تولید `client_mutation_id`
3. افزودن پیام Optimistic با وضعیت `pending`
4. ارسال HubMessage هفت‌فیلدی از Socket
5. دریافت ACK
6. جایگزینی با نسخه canonical در صورت وجود
7. ذخیره نسخه canonical در Cache موبایل

HubMessage همچنان فقط هفت فیلد قرارداد دارد. `client_mutation_id` و Conversation ID فقط در Context محلی ارسال استفاده می‌شوند و به Wire اضافه نمی‌شوند.

---

## ۵. وضعیت تحویل

- `pending`: در حال ارسال
- `sent`: ارسال‌شده
- `unknown`: Timeout یا نتیجه نامشخص؛ اگر ACK دیررس برسد، Composer نیز پاک می‌شود
- `failed`: رد صریح Hub یا قطع اتصال

ارسال مجدد خودکار انجام نمی‌شود. Retry دستی باید همان `client_mutation_id` را استفاده کند.

در حالت آفلاین یا قطع Hub، Composer غیرفعال است. موبایل وضعیت اتصال و دسترسی به اینترنت را با `expo-network` می‌خواند؛ PWA از رویدادهای `online` و `offline` مرورگر استفاده می‌کند.

---

## ۶. Dedup و پیام زنده

- پیام زنده فقط برای گفتگوی فعلی پذیرفته می‌شود.
- HubMessage با Identifier پایدار محلی به Canonical Message نگاشت می‌شود.
- Merge بر اساس `message.id`، `client_mutation_id` و Signature محتوای پیام انجام می‌شود.
- اگر همان پیام زنده در تاریخچه canonical وجود داشته باشد، نمایش محلی `hub_*` کنار گذاشته می‌شود.
- رکورد مصنوعی `hub_*` پیش از ذخیره نسخه canonical در SQLite حذف می‌شود.
- Echo پیام خود اپراتور با Optimistic موجود ادغام می‌شود.
- رویداد تکراری باعث دو Bubble نمی‌شود.

---

## ۷. محدودیت Production

Hub فعلی `message_id` canonical در ACK ندارد. Adapter Mock برای MVP این شناسه را در ACK محلی تولید می‌کند تا جایگزینی Optimistic قابل‌آزمایش باشد.

در Integration واقعی، تا تأیید مسیر Ingest و Message ID در Planet، نسخه canonical از Backlog/Sync جایگزین می‌شود؛ این وابستگی در `BLK-03` و `BLK-05` ثبت شده است.

---

## ۸. تست‌ها

- ارسال موفق و جایگزینی Optimistic با Canonical
- Dedup رویداد زنده تکراری و تداخل آن با تاریخچه canonical
- حذف رکورد مصنوعی Hub پیش از ذخیره Canonical
- باز شدن تاریخچه از جدیدترین و بارگذاری قدیمی‌تر با Cursor
- تبادل پیام بین دو Chat Client با Transport مشترک
- Timeout و وضعیت نامشخص بدون ارسال مجدد
- قطع Hub و ارسال آفلاین
- Pagination تاریخچه
- Fallback آفلاین و عدم Fallback روی 403
- متن خالی و بیش از حد بلند
- نمایش Composer، ایموجی و وضعیت تحویل در موبایل و PWA
