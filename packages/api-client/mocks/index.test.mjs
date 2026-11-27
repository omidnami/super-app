import test from 'node:test'
import assert from 'node:assert/strict'
import { createMockFetch, createMockApi, MockApiError, mockData } from './index.mjs'

const base = 'https://mock.superapp.local'

async function request(mockFetch, path, { method = 'GET', token, body, scenario } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (scenario) headers['x-mock-scenario'] = scenario
  const response = await mockFetch(`${base}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await response.json()
  return { response, json }
}

async function messagingSession(mockFetch) {
  const { json } = await request(mockFetch, '/api/v1/messaging/auth/session', {
    method: 'POST',
    body: { operator_id: 'op_42', project_id: 'prj_12', access_code: 'demo' },
  })
  assert.equal(json.status, true)
  return json.data
}

async function accountSession(mockFetch) {
  const { json } = await request(mockFetch, '/api/v1/account/auth/session', {
    method: 'POST',
    body: { operator_id: 'op_42', project_id: 'prj_12', access_code: 'demo' },
  })
  assert.equal(json.status, true)
  return json.data
}

test('Auth سراسری وجود ندارد', async () => {
  const mockFetch = createMockFetch()
  const { response, json } = await request(mockFetch, '/api/v1/auth/session', {
    method: 'POST',
    body: {},
  })
  assert.equal(response.status, 404)
  assert.equal(json.code, 'NOT_FOUND')
})

test('Session پیام‌رسان و مدیریت حساب مستقل هستند', async () => {
  const mockFetch = createMockFetch()
  const messaging = await messagingSession(mockFetch)
  const account = await accountSession(mockFetch)

  assert.equal(messaging.service, 'messaging')
  assert.equal(account.service, 'account')
  assert.notEqual(messaging.access_token, account.access_token)

  const wrongService = await request(mockFetch, '/api/v1/account/auth/context', {
    token: messaging.access_token,
  })
  assert.equal(wrongService.response.status, 401)

  const accountContext = await request(mockFetch, '/api/v1/account/auth/context', {
    token: account.access_token,
  })
  assert.equal(accountContext.response.status, 200)
  assert.deepEqual(accountContext.json.data.permissions, [
    'shop.read',
    'accounting.read',
    'account.settings.read',
  ])
})

test('خروج از پیام‌رسان، Session مدیریت حساب را باطل نمی‌کند', async () => {
  const mockFetch = createMockFetch()
  const messaging = await messagingSession(mockFetch)
  const account = await accountSession(mockFetch)

  await request(mockFetch, '/api/v1/messaging/auth/logout', {
    method: 'POST',
    token: messaging.access_token,
  })
  const expiredMessaging = await request(mockFetch, '/api/v1/messaging/auth/context', {
    token: messaging.access_token,
  })
  assert.equal(expiredMessaging.response.status, 401)

  const validAccount = await request(mockFetch, '/api/v1/account/auth/context', {
    token: account.access_token,
  })
  assert.equal(validAccount.response.status, 200)
})

test('Ticket کوتاه‌عمر بدون Project Token صادر می‌شود', async () => {
  const mockFetch = createMockFetch()
  const messaging = await messagingSession(mockFetch)
  const { response, json } = await request(mockFetch, '/api/v1/chat/connection-ticket', {
    method: 'POST',
    token: messaging.access_token,
  })

  assert.equal(response.status, 200)
  assert.equal(json.data.project_id, 'prj_12')
  assert.equal(json.data.operator_id, 'op_42')
  assert.match(json.data.connection_token, /^mock_ticket_/)
  assert.equal(JSON.stringify(json).includes('project_token'), false)
})

test('Conversation و Message با Mock قابل دریافت هستند', async () => {
  const mockFetch = createMockFetch()
  const messaging = await messagingSession(mockFetch)

  const conversations = await request(mockFetch, '/api/v1/chat/conversations?limit=2', {
    token: messaging.access_token,
  })
  assert.equal(conversations.response.status, 200)
  assert.equal(conversations.json.data.items.length, 2)
  assert.equal(conversations.json.data.has_more, true)

  const messages = await request(mockFetch, '/api/v1/chat/conversations/conv_1001/messages', {
    token: messaging.access_token,
  })
  assert.equal(messages.response.status, 200)
  assert.equal(messages.json.data.items.length, 3)
  assert.equal(messages.json.data.items[0].id, 'msg_2001')
})

test('ارسال پیام با client_mutation_id تکرارپذیر است', async () => {
  const mockFetch = createMockFetch()
  const messaging = await messagingSession(mockFetch)
  const payload = {
    source: 'bale',
    robot_id: '987654',
    channel_chat_id: '501',
    sender: 'operator',
    text: 'شماره مرسوله ارسال شد.',
    client_mutation_id: 'cm_test_001',
  }

  const first = await request(mockFetch, '/api/v1/chat/messages', {
    method: 'POST',
    token: messaging.access_token,
    body: payload,
  })
  const second = await request(mockFetch, '/api/v1/chat/messages', {
    method: 'POST',
    token: messaging.access_token,
    body: payload,
  })

  assert.equal(first.response.status, 201)
  assert.equal(first.json.data.created, true)
  assert.equal(second.json.data.created, false)
  assert.equal(second.json.data.message.id, first.json.data.message.id)
})

test('Sync اولیه و cursor بعدی کار می‌کند', async () => {
  const mockFetch = createMockFetch()
  const messaging = await messagingSession(mockFetch)

  const first = await request(mockFetch, '/api/v1/chat/sync', { token: messaging.access_token })
  assert.equal(first.json.data.changes.length, 3)
  assert.equal(first.json.data.next_cursor, 'mock_cursor_1')
  assert.ok(first.json.data.changes[0].data)

  const second = await request(mockFetch, '/api/v1/chat/sync?cursor=mock_cursor_1', {
    token: messaging.access_token,
  })
  assert.deepEqual(second.json.data.changes, [])
})

test('فروشگاه و حسابداری فقط‌خواندنی هستند', async () => {
  const mockFetch = createMockFetch()
  const account = await accountSession(mockFetch)

  const orders = await request(mockFetch, '/api/v1/account/shop/orders', {
    token: account.access_token,
  })
  const documents = await request(mockFetch, '/api/v1/account/accounting/documents', {
    token: account.access_token,
  })
  assert.equal(orders.json.data.items[0].code, 'TK-1008')
  assert.equal(documents.json.data.items[0].code, 'INV-2026-1108')

  const shopWriteAttempt = await request(mockFetch, '/api/v1/account/shop/orders', {
    method: 'POST',
    token: account.access_token,
    body: {},
  })
  assert.equal(shopWriteAttempt.response.status, 405)
  assert.equal(shopWriteAttempt.json.code, 'METHOD_NOT_ALLOWED')

  const accountingWriteAttempt = await request(mockFetch, '/api/v1/account/accounting/documents', {
    method: 'POST',
    token: account.access_token,
    body: {},
  })
  assert.equal(accountingWriteAttempt.response.status, 405)
  assert.equal(accountingWriteAttempt.json.code, 'METHOD_NOT_ALLOWED')
})

test('داشبورد حسابداری با ساختار Mock اصلی برابرب است', async () => {
  const mockFetch = createMockFetch()
  const account = await accountSession(mockFetch)

  const result = await request(mockFetch, '/api/v1/account/accounting/dashboard', {
    token: account.access_token,
  })

  assert.equal(result.response.status, 200)
  assert.equal(result.json.status, true)
  assert.deepEqual(result.json.data, mockData.accountingDashboard)
})

test('اسناد حسابداری بر اساس جست‌وجو، نوع، وضعیت و بازه تاریخ فیلتر می‌شوند', async () => {
  const baseDocument = mockData.accountingDocuments[0]
  const documents = [
    {
      ...baseDocument,
      id: 'acc_6003',
      code: 'JRN-2026-1125',
      type: 'journal',
      status: 'cancelled',
      issued_at: '2026-11-25T00:00:00.000Z',
      updated_at: '2026-11-25T00:00:00.000Z',
    },
    {
      ...baseDocument,
      id: 'acc_5999',
      code: 'RCP-2026-1124',
      type: 'receipt',
      counterparty_name: 'مشتری صندوق',
      issued_at: '2026-11-24T23:59:59.999Z',
      updated_at: '2026-11-24T23:59:59.999Z',
    },
    { ...baseDocument, id: 'acc_6001' },
    {
      ...baseDocument,
      id: 'acc_6000',
      code: 'INV-2026-1124',
      status: 'draft',
      counterparty_name: 'مشتری پیش‌نویس',
    },
    {
      ...baseDocument,
      id: 'acc_deleted',
      code: 'INV-DELETED',
      issued_at: '2026-11-24T12:00:00.000Z',
      deleted_at: '2026-11-24T12:30:00.000Z',
    },
    { ...mockData.accountingDocuments[1], id: 'acc_6002' },
  ]
  const mockFetch = createMockFetch({
    data: { ...mockData, accountingDocuments: documents },
  })
  const account = await accountSession(mockFetch)
  const path = '/api/v1/account/accounting/documents'

  const day = await request(mockFetch, `${path}?issued_from=2026-11-24&issued_to=2026-11-24`, {
    token: account.access_token,
  })
  assert.deepEqual(
    day.json.data.items.map((item) => item.id),
    ['acc_5999', 'acc_6001', 'acc_6000'],
  )

  const filtered = await request(
    mockFetch,
    `${path}?search=${encodeURIComponent('INV-2026')}&type=invoice&status=confirmed&issued_from=2026-11-24&issued_to=2026-11-24`,
    { token: account.access_token },
  )
  assert.deepEqual(
    filtered.json.data.items.map((item) => item.id),
    ['acc_6001'],
  )
  assert.equal(filtered.json.data.total, 1)

  const exactTimestamp = await request(
    mockFetch,
    `${path}?issued_from=2026-11-24T08:25:00.000Z&issued_to=2026-11-24T08:25:00.000Z`,
    { token: account.access_token },
  )
  assert.deepEqual(
    exactTimestamp.json.data.items.map((item) => item.id),
    ['acc_6001', 'acc_6000'],
  )

  const beforeTimestamp = await request(
    mockFetch,
    `${path}?issued_from=2026-11-24&issued_to=2026-11-24T08:24:59.999Z`,
    { token: account.access_token },
  )
  assert.deepEqual(beforeTimestamp.json.data.items, [])

  const deleted = await request(mockFetch, `${path}/acc_deleted`, {
    token: account.access_token,
  })
  assert.equal(deleted.response.status, 404)
})

test('بازه زمانی نامعتبر حسابداری با خطای 422 رد می‌شود', async () => {
  const mockFetch = createMockFetch()
  const account = await accountSession(mockFetch)
  const path = '/api/v1/account/accounting/documents'

  for (const query of [
    'issued_from=not-a-date',
    'issued_to=2026-02-31',
    'issued_from=2026-11-25&issued_to=2026-11-24',
  ]) {
    const { response, json } = await request(mockFetch, `${path}?${query}`, {
      token: account.access_token,
    })
    assert.equal(response.status, 422)
    assert.equal(json.code, 'VALIDATION_ERROR')
  }
})

test('صفحه‌بندی اسناد حسابداری با ترتیب پایدار issued_at و شناسه کار می‌کند', async () => {
  const baseDocument = mockData.accountingDocuments[0]
  const documents = [
    { ...baseDocument, id: 'acc_6000', status: 'draft' },
    { ...baseDocument, id: 'acc_6001' },
    { ...mockData.accountingDocuments[1], id: 'acc_6002' },
    { ...baseDocument, id: 'acc_5999', type: 'receipt', issued_at: '2026-11-24T23:59:59.999Z' },
    {
      ...baseDocument,
      id: 'acc_6003',
      type: 'journal',
      status: 'cancelled',
      issued_at: '2026-11-25T00:00:00.000Z',
    },
  ]
  const mockFetch = createMockFetch({
    data: { ...mockData, accountingDocuments: documents },
  })
  const account = await accountSession(mockFetch)
  const path = '/api/v1/account/accounting/documents'

  const first = await request(mockFetch, `${path}?limit=2`, { token: account.access_token })
  assert.deepEqual(
    first.json.data.items.map((item) => item.id),
    ['acc_6003', 'acc_5999'],
  )
  assert.equal(first.json.data.next_cursor, 'offset_2')
  assert.equal(first.json.data.has_more, true)
  assert.equal(first.json.data.total, 5)

  const second = await request(mockFetch, `${path}?limit=2&cursor=offset_2`, {
    token: account.access_token,
  })
  assert.deepEqual(
    second.json.data.items.map((item) => item.id),
    ['acc_6001', 'acc_6000'],
  )
  assert.equal(second.json.data.next_cursor, 'offset_4')
  assert.equal(second.json.data.has_more, true)

  const third = await request(mockFetch, `${path}?limit=2&cursor=offset_4`, {
    token: account.access_token,
  })
  assert.deepEqual(
    third.json.data.items.map((item) => item.id),
    ['acc_6002'],
  )
  assert.equal(third.json.data.next_cursor, null)
  assert.equal(third.json.data.has_more, false)
})

test('سناریوهای 401، 403، 409، 422 و Network Error قابل آزمایش هستند', async () => {
  const mockFetch = createMockFetch()
  const cases = [
    ['unauthorized', 401, 'UNAUTHENTICATED'],
    ['forbidden', 403, 'FORBIDDEN'],
    ['conflict', 409, 'CONFLICT'],
    ['validation', 422, 'VALIDATION_ERROR'],
    ['rate', 429, 'RATE_LIMITED'],
    ['upstream', 503, 'UPSTREAM_UNAVAILABLE'],
  ]

  for (const [scenario, status, code] of cases) {
    const result = await request(mockFetch, '/api/v1/chat/conversations', { scenario })
    assert.equal(result.response.status, status)
    assert.equal(result.json.code, code)
  }

  await assert.rejects(
    () => request(mockFetch, '/api/v1/chat/conversations', { scenario: 'network' }),
    /Mock network error/,
  )
})

test('MockApiError ساختار استاندارد خطا را دارد', () => {
  const error = new MockApiError(403, 'FORBIDDEN', 'دسترسی مجاز نیست.')
  assert.deepEqual(error.toJSON(), {
    status: false,
    code: 'FORBIDDEN',
    message: 'دسترسی مجاز نیست.',
    retryable: false,
  })
})

test('API مستقیم نیز قابل استفاده است', async () => {
  const api = createMockApi()
  const session = await api.request('POST', '/api/v1/messaging/auth/session', {
    body: { operator_id: 'op_42', project_id: 'prj_12', access_code: 'demo' },
  })
  const result = await api.request('GET', '/api/v1/chat/bootstrap', {
    headers: { Authorization: `Bearer ${session.data.access_token}` },
  })
  assert.equal(result.status, true)
  assert.equal(result.data.project.id, 'prj_12')
})
