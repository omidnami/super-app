# Mock API سوپراپلیکیشن

Mock این پکیج برای توسعه Frontend بدون Backend واقعی است. تمام Tokenها و Ticketها ساختگی هستند و نباید در Production استفاده شوند.

## استفاده سریع

```js
import { createMockFetch, createMockApi } from '@superapp/api-client/mocks'

const mockFetch = createMockFetch()
const response = await mockFetch('/api/v1/messaging/auth/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operator_id: 'op_42',
    project_id: 'prj_12',
    access_code: 'demo',
  }),
})

const session = await response.json()
```

برای استفاده مستقیم:

```js
import { createMockApi } from '@superapp/api-client/mocks'

const api = createMockApi()
const result = await api.request('GET', '/api/v1/chat/conversations', {
  headers: { Authorization: 'Bearer mock_messaging_access_op_42' },
})
```

## خطاهای قابل شبیه‌سازی

با هدر زیر می‌توانید خطاهای استاندارد را آزمایش کنید:

```text
x-mock-scenario: unauthorized
x-mock-scenario: forbidden
x-mock-scenario: conflict
x-mock-scenario: validation
x-mock-scenario: rate
x-mock-scenario: upstream
x-mock-scenario: network
```

## Fixtureها

فایل‌های `fixtures/*.json` شامل داده‌های فارسی گفتگو، پیام، سفارش، محصول، سند حسابداری، پیوست و سینک هستند.

برای بازتولید Fixtureها:

```bash
node packages/api-client/mocks/generate-fixtures.mjs
```

## تست

```bash
node --test packages/api-client/mocks/index.test.mjs
```
