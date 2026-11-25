# راه‌اندازی و Build سوپراپلیکیشن

> مرحله: STEP-02
>
> Package Manager: npm Workspaces

---

## ۱. پیش‌نیازها

- Node.js 22 یا بالاتر
- npm 10 یا بالاتر
- برای Build iOS: macOS با Xcode یا EAS Build
- برای Build محلی Android: Java، Android SDK و adb

در محیط فعلی، Java، Android SDK و Xcode موجود نیستند؛ Build Native با EAS انجام می‌شود.

---

## ۲. نصب

```bash
npm install
```

npm وابستگی‌های همه Workspaceها را نصب و پکیج‌های داخلی را به هم متصل می‌کند.

---

## ۳. اجرای توسعه

### هر دو اپ

```bash
npm run dev
```

### موبایل

```bash
npm run dev:mobile
```

### PWA

```bash
npm run dev:pwa
```

PWA به‌صورت پیش‌فرض روی پورت `5173` اجرا می‌شود.

### اتصال به Planet

برای استفاده از API واقعی گفتگوها، URL پایه Planet را در Environment اپ تنظیم کنید:

```bash
# موبایل / Expo
EXPO_PUBLIC_PLANET_API_URL=https://planet.example.com

# PWA / Vite
VITE_PLANET_API_URL=https://planet.example.com
```

بدون این متغیر، اپ‌ها برای MVP از Mock Conversation API استفاده می‌کنند.

---

## ۴. بررسی کیفیت

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
```

### تست‌ها

- `npm run test:packages`: تست Mock API
- `npm run test:pwa`: Vitest + Testing Library
- `npm run test:mobile`: Jest + React Native Testing Library

---

## ۵. Build

### PWA

```bash
npm run build:pwa
```

خروجی:

```text
apps/pwa/dist/
```

### موبایل

```bash
npm run build:mobile
```

خروجی:

```text
apps/mobile/dist/
```

این خروجی Bundleهای Expo Export است و جایگزین Build نهایی Android/iOS روی Expo Application Services نیست. برای Verify بدون شبکه، اسکریپت محلی از `--no-bytecode` استفاده می‌کند؛ Build Production باید با EAS و Bytecode معمولی انجام شود.

### Build کامل

```bash
npm run build
```

ابتدا PWA و سپس موبایل Build می‌شود.

---

## ۶. Workspaceها

| Package | نام |
|---|---|
| Auth | `@superapp/auth` |
| Chat | `@superapp/chat` |
| Media | `@superapp/media` |
| Conversation Inbox | `@superapp/conversation-inbox` |
| Hub Client | `@superapp/hub-client` |
| Local DB | `@superapp/local-db` |
| Mobile | `@superapp/mobile` |
| PWA | `@superapp/pwa` |
| UI | `@superapp/ui` |
| Design Tokens | `@superapp/design-tokens` |
| Domain | `@superapp/domain` |
| API Client | `@superapp/api-client` |
| Chat Contracts | `@superapp/chat-contracts` |
| Storage | `@superapp/storage` |
| Theme | `@superapp/theme` |
| Utils | `@superapp/utils` |

نمونه Import بین پکیج‌ها:

```ts
import { APP_NAME } from '@superapp/domain'
import { DEFAULT_THEME_MODE } from '@superapp/design-tokens'
```

---

## ۷. قواعد Monorepo

- `planet/` و `support-hub/` فقط‌خواندنی و Ignore شده‌اند.
- Source Code محصول فقط در `apps/`، `packages/` و `features/` توسعه می‌یابد.
- رنگ و Navigation نهایی در STEP-02 ساخته نشده‌اند.
- رنگ خام در کامپوننت‌های نهایی مجاز نیست؛ Design Tokenها در STEP-03 تکمیل می‌شوند.
- TypeScript Strict در همه Workspaceها فعال است.
- Build و Test باید پیش از تیک زدن هر استپ پاس شوند.

### نکته امنیتی وابستگی‌ها

در Audit STEP-02، npm تعداد ۲۰ هشدار Moderate گزارش کرد؛ ۳ مورد در Dependencyهای Production متعلق به زنجیره `expo → @expo/fingerprint → minimatch` است. هیچ High یا Critical وجود ندارد. Downgrade خودکار Expo انجام نشده؛ بازبینی و Upgrade هماهنگ با SDK در STEP-17 ثبت شده است.
