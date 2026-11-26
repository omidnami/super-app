# Superapp Monorepo

زیرساخت توسعه موبایل و PWA سوپراپلیکیشن.

## ساختار

```text
apps/
  mobile/   # Expo + React Native + TypeScript
  pwa/      # React + Vite + TypeScript

packages/
  auth/
  chat/
  conversation-inbox/
  media/
  hub-client/
  local-db/
  shop/
  ui/
  design-tokens/
  domain/
  api-client/
  chat-contracts/
  storage/
  theme/
  utils/
```

## دستورها

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

جزئیات بیشتر در `docs/development-setup.md`.
