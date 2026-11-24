import { mockData } from './data.mjs'

const clone = (value) => structuredClone(value)
const now = () => new Date().toISOString()

export class MockApiError extends Error {
  constructor(status, code, message, { retryable = false, errors } = {}) {
    super(message)
    this.name = 'MockApiError'
    this.status = status
    this.code = code
    this.retryable = retryable
    this.errors = errors
  }

  toJSON() {
    return {
      status: false,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.errors ? { errors: this.errors } : {}),
    }
  }
}

const success = (data, status = 200) => {
  const payload = { status: true, data }
  Object.defineProperty(payload, 'httpStatus', { value: status, enumerable: false })
  return payload
}
const fail = (status, code, message, options) => {
  throw new MockApiError(status, code, message, options)
}

function parseLimit(value, fallback = 30, max = 100) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.floor(parsed), max)
}

function parseCursor(value) {
  if (!value) return 0
  const match = /^offset_(\d+)$/.exec(String(value))
  return match ? Number(match[1]) : 0
}

function paginate(rows, query = {}, fallbackLimit = 30) {
  const limit = parseLimit(query.limit, fallbackLimit)
  const offset = parseCursor(query.cursor)
  const items = rows.slice(offset, offset + limit)
  const nextOffset = offset + items.length
  return {
    items: clone(items),
    next_cursor: nextOffset < rows.length ? `offset_${nextOffset}` : null,
    has_more: nextOffset < rows.length,
    total: rows.length,
  }
}

function includesSearch(value, search) {
  if (!search) return true
  return String(value).toLocaleLowerCase('fa').includes(String(search).toLocaleLowerCase('fa'))
}

export class MockApi {
  constructor(initialData = mockData) {
    this.data = clone(initialData)
    this.sessions = {
      messaging: new Map(),
      account: new Map(),
    }
    this.counters = {
      message: 2100,
      attachment: 3100,
      ticket: 1,
    }
  }

  async request(method, path, options = {}) {
    const normalizedMethod = String(method || 'GET').toUpperCase()
    const normalizedPath =
      String(path || '')
        .split('?')[0]
        .replace(/\/$/, '') || '/'
    const headers = new Headers(options.headers || {})
    const body = options.body && typeof options.body === 'object' ? options.body : {}
    const query = options.query && typeof options.query === 'object' ? options.query : {}

    const scenario = headers.get('x-mock-scenario')
    if (scenario === 'network') {
      throw new TypeError('Mock network error')
    }
    if (scenario) {
      const scenarioErrors = {
        unauthorized: [401, 'UNAUTHENTICATED', 'نشست معتبر نیست.'],
        forbidden: [403, 'FORBIDDEN', 'دسترسی به این منبع مجاز نیست.'],
        conflict: [409, 'CONFLICT', 'درخواست با وضعیت فعلی داده تعارض دارد.'],
        validation: [422, 'VALIDATION_ERROR', 'داده ورودی معتبر نیست.'],
        rate: [429, 'RATE_LIMITED', 'تعداد درخواست‌ها بیش از حد مجاز است.'],
        upstream: [503, 'UPSTREAM_UNAVAILABLE', 'سرویس بالادستی در دسترس نیست.'],
      }
      const selected = scenarioErrors[scenario]
      if (selected) {
        fail(selected[0], selected[1], selected[2], { retryable: [429, 503].includes(selected[0]) })
      }
    }

    if (normalizedPath.startsWith('/api/v1/auth/')) {
      fail(404, 'NOT_FOUND', 'Auth سراسری وجود ندارد.')
    }

    if (normalizedPath === '/api/v1/messaging/auth/session') {
      this.assertMethod(normalizedMethod, 'POST', normalizedPath)
      return success(this.createSession('messaging', body))
    }

    if (normalizedPath === '/api/v1/account/auth/session') {
      this.assertMethod(normalizedMethod, 'POST', normalizedPath)
      return success(this.createSession('account', body))
    }

    if (normalizedPath === '/api/v1/messaging/auth/refresh') {
      this.assertMethod(normalizedMethod, 'POST', normalizedPath)
      return success(this.refreshSession('messaging', body))
    }

    if (normalizedPath === '/api/v1/account/auth/refresh') {
      this.assertMethod(normalizedMethod, 'POST', normalizedPath)
      return success(this.refreshSession('account', body))
    }

    if (normalizedPath === '/api/v1/messaging/auth/logout') {
      this.assertMethod(normalizedMethod, 'POST', normalizedPath)
      this.requireServiceToken(headers, 'messaging')
      return success(this.logout('messaging', headers, body))
    }

    if (normalizedPath === '/api/v1/account/auth/logout') {
      this.assertMethod(normalizedMethod, 'POST', normalizedPath)
      this.requireServiceToken(headers, 'account')
      return success(this.logout('account', headers, body))
    }

    if (normalizedPath === '/api/v1/messaging/auth/context') {
      this.assertMethod(normalizedMethod, 'GET', normalizedPath)
      this.requireServiceToken(headers, 'messaging')
      return success(clone(this.data.operator))
    }

    if (normalizedPath === '/api/v1/account/auth/context') {
      this.assertMethod(normalizedMethod, 'GET', normalizedPath)
      this.requireServiceToken(headers, 'account')
      return success(clone(this.data.accountContext))
    }

    if (normalizedPath.startsWith('/api/v1/chat/')) {
      this.requireServiceToken(headers, 'messaging')
      return this.handleChat(normalizedMethod, normalizedPath, body, query)
    }

    if (normalizedPath.startsWith('/api/v1/account/shop/')) {
      this.requireServiceToken(headers, 'account')
      return this.handleShop(normalizedMethod, normalizedPath, query)
    }

    if (normalizedPath.startsWith('/api/v1/account/accounting/')) {
      this.requireServiceToken(headers, 'account')
      return this.handleAccounting(normalizedMethod, normalizedPath, query)
    }

    fail(404, 'NOT_FOUND', 'مسیر Mock پیدا نشد.')
  }

  handleChat(method, path, body, query) {
    if (
      path === '/api/v1/chat/connection-ticket' ||
      path === '/api/v1/chat/connection-ticket/refresh'
    ) {
      this.assertMethod(method, 'POST', path)
      return success(this.createTicket())
    }

    if (path === '/api/v1/chat/bootstrap') {
      this.assertMethod(method, 'GET', path)
      return success({
        project: { id: this.data.operator.project_id, name: this.data.operator.project_name },
        operator: clone(this.data.operator),
        support_levels: clone(this.data.supportLevels),
      })
    }

    if (path === '/api/v1/chat/conversations') {
      this.assertMethod(method, 'GET', path)
      let rows = this.data.conversations.filter((item) => !item.deleted_at)
      if (query.search) {
        rows = rows.filter(
          (item) =>
            includesSearch(item.customer.display_name, query.search) ||
            includesSearch(item.last_message, query.search) ||
            includesSearch(item.chat_id, query.search),
        )
      }
      if (query.source) rows = rows.filter((item) => item.source === query.source)
      if (query.support_level)
        rows = rows.filter((item) => item.support_level === query.support_level)
      if (query.status) rows = rows.filter((item) => item.status === query.status)
      if (query.assignee_operator_id)
        rows = rows.filter((item) => item.assignee?.id === query.assignee_operator_id)
      if (query.unread_only === 'true' || query.unread_only === true)
        rows = rows.filter((item) => item.unread_count > 0)
      rows.sort(
        (a, b) =>
          Date.parse(b.last_message_at || b.updated_at) -
          Date.parse(a.last_message_at || a.updated_at),
      )
      return success(paginate(rows, query))
    }

    const conversationMatch = /^\/api\/v1\/chat\/conversations\/([^/]+)$/.exec(path)
    if (conversationMatch) {
      this.assertMethod(method, 'GET', path)
      return success(this.getConversation(conversationMatch[1]))
    }

    const messagesMatch = /^\/api\/v1\/chat\/conversations\/([^/]+)\/messages$/.exec(path)
    if (messagesMatch) {
      this.assertMethod(method, 'GET', path)
      const conversation = this.getConversation(messagesMatch[1])
      let rows = this.data.messages.filter(
        (message) => message.conversation_id === conversation.id && !message.deleted_at,
      )
      if (query.before) {
        const beforeIndex = rows.findIndex((message) => message.id === query.before)
        if (beforeIndex >= 0) rows = rows.slice(0, beforeIndex)
      }
      const page = paginate(rows, query, 50)
      return success({ ...page, conversation })
    }

    if (path === '/api/v1/chat/messages') {
      this.assertMethod(method, 'POST', path)
      return success(this.sendMessage(body), 201)
    }

    const statusMatch = /^\/api\/v1\/chat\/messages\/([^/]+)\/status$/.exec(path)
    if (statusMatch) {
      this.assertMethod(method, 'POST', path)
      return success(this.updateMessageStatus(statusMatch[1], body))
    }

    const readMatch = /^\/api\/v1\/chat\/conversations\/([^/]+)\/read$/.exec(path)
    if (readMatch) {
      this.assertMethod(method, 'POST', path)
      const conversation = this.getConversation(readMatch[1])
      conversation.unread_count = 0
      conversation.updated_at = now()
      return success(conversation)
    }

    const assignMatch = /^\/api\/v1\/chat\/conversations\/([^/]+)\/assign$/.exec(path)
    if (assignMatch) {
      this.assertMethod(method, 'POST', path)
      return success(this.assignConversation(assignMatch[1], body))
    }

    const escalateMatch = /^\/api\/v1\/chat\/conversations\/([^/]+)\/escalate$/.exec(path)
    if (escalateMatch) {
      this.assertMethod(method, 'POST', path)
      return success(this.escalateConversation(escalateMatch[1], body))
    }

    const conversationStatusMatch = /^\/api\/v1\/chat\/conversations\/([^/]+)\/status$/.exec(path)
    if (conversationStatusMatch) {
      this.assertMethod(method, 'POST', path)
      return success(this.updateConversationStatus(conversationStatusMatch[1], body))
    }

    if (path === '/api/v1/chat/sync') {
      this.assertMethod(method, 'GET', path)
      return success(this.sync(query))
    }

    if (path === '/api/v1/chat/attachments') {
      this.assertMethod(method, 'POST', path)
      return success(this.uploadAttachment(body), 201)
    }

    const attachmentMatch = /^\/api\/v1\/chat\/attachments\/([^/]+)$/.exec(path)
    if (attachmentMatch) {
      this.assertMethod(method, 'GET', path)
      return success(this.getAttachment(attachmentMatch[1]))
    }

    const attachmentContentMatch = /^\/api\/v1\/chat\/attachments\/([^/]+)\/content$/.exec(path)
    if (attachmentContentMatch) {
      this.assertMethod(method, 'GET', path)
      const attachment = this.getAttachment(attachmentContentMatch[1])
      return success({ mock_file: true, attachment })
    }

    fail(404, 'NOT_FOUND', 'مسیر چت پیدا نشد.')
  }

  handleShop(method, path, query) {
    if (path === '/api/v1/account/shop/dashboard') {
      this.assertMethod(method, 'GET', path)
      return success(clone(this.data.shopDashboard))
    }
    if (path === '/api/v1/account/shop/orders') {
      this.assertMethod(method, 'GET', path)
      let rows = this.data.orders.filter((order) => !order.deleted_at)
      if (query.search)
        rows = rows.filter(
          (order) =>
            includesSearch(order.code, query.search) ||
            includesSearch(order.customer_name, query.search),
        )
      if (query.status) rows = rows.filter((order) => order.status === query.status)
      return success(paginate(rows, query))
    }
    const orderMatch = /^\/api\/v1\/account\/shop\/orders\/([^/]+)$/.exec(path)
    if (orderMatch) {
      this.assertMethod(method, 'GET', path)
      const order = this.data.orders.find((item) => item.id === orderMatch[1] && !item.deleted_at)
      if (!order) fail(404, 'NOT_FOUND', 'سفارش پیدا نشد.')
      return success(clone(order))
    }
    if (path === '/api/v1/account/shop/products') {
      this.assertMethod(method, 'GET', path)
      let rows = this.data.products.filter((product) => !product.deleted_at)
      if (query.search)
        rows = rows.filter(
          (product) =>
            includesSearch(product.title, query.search) ||
            includesSearch(product.slug, query.search),
        )
      if (query.status) rows = rows.filter((product) => product.status === query.status)
      return success(paginate(rows, query))
    }
    const productMatch = /^\/api\/v1\/account\/shop\/products\/([^/]+)$/.exec(path)
    if (productMatch) {
      this.assertMethod(method, 'GET', path)
      const product = this.data.products.find(
        (item) => item.id === productMatch[1] && !item.deleted_at,
      )
      if (!product) fail(404, 'NOT_FOUND', 'محصول پیدا نشد.')
      return success(clone(product))
    }
    if (method !== 'GET') {
      fail(405, 'METHOD_NOT_ALLOWED', 'فروشگاه در MVP فقط‌خواندنی است.')
    }
    fail(404, 'NOT_FOUND', 'مسیر فروشگاه پیدا نشد.')
  }

  handleAccounting(method, path, query) {
    if (path === '/api/v1/account/accounting/dashboard') {
      this.assertMethod(method, 'GET', path)
      return success(clone(this.data.accountingDashboard))
    }
    if (path === '/api/v1/account/accounting/documents') {
      this.assertMethod(method, 'GET', path)
      let rows = this.data.accountingDocuments.filter((document) => !document.deleted_at)
      if (query.search)
        rows = rows.filter(
          (document) =>
            includesSearch(document.code, query.search) ||
            includesSearch(document.counterparty_name, query.search),
        )
      if (query.type) rows = rows.filter((document) => document.type === query.type)
      if (query.status) rows = rows.filter((document) => document.status === query.status)
      return success(paginate(rows, query))
    }
    const documentMatch = /^\/api\/v1\/account\/accounting\/documents\/([^/]+)$/.exec(path)
    if (documentMatch) {
      this.assertMethod(method, 'GET', path)
      const document = this.data.accountingDocuments.find(
        (item) => item.id === documentMatch[1] && !item.deleted_at,
      )
      if (!document) fail(404, 'NOT_FOUND', 'سند حسابداری پیدا نشد.')
      return success(clone(document))
    }
    if (method !== 'GET') {
      fail(405, 'METHOD_NOT_ALLOWED', 'حسابداری در MVP فقط‌خواندنی است.')
    }
    fail(404, 'NOT_FOUND', 'مسیر حسابداری پیدا نشد.')
  }

  createSession(service, body) {
    if (!body.operator_id || !body.project_id || !body.access_code) {
      fail(422, 'VALIDATION_ERROR', 'operator_id، project_id و access_code الزامی هستند.', {
        errors: {
          ...(!body.operator_id ? { operator_id: ['الزامی است.'] } : {}),
          ...(!body.project_id ? { project_id: ['الزامی است.'] } : {}),
          ...(!body.access_code ? { access_code: ['الزامی است.'] } : {}),
        },
      })
    }
    if (body.access_code !== 'demo') {
      fail(401, 'UNAUTHENTICATED', 'رمز دسترسی Mock معتبر نیست.')
    }
    const accessToken = `mock_${service}_access_${body.operator_id}`
    const refreshToken = `mock_${service}_refresh_${body.operator_id}`
    this.sessions[service].set(accessToken, refreshToken)
    const context =
      service === 'messaging' ? clone(this.data.operator) : clone(this.data.accountContext)
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900,
      service,
      context,
    }
  }

  refreshSession(service, body) {
    const refreshToken = body.refresh_token
    const entry = [...this.sessions[service].entries()].find(([, value]) => value === refreshToken)
    if (!entry) fail(401, 'UNAUTHENTICATED', 'Refresh Token معتبر نیست.')
    this.sessions[service].delete(entry[0])
    const accessToken = `mock_${service}_access_refreshed_${Date.now()}`
    const nextRefreshToken = `mock_${service}_refresh_refreshed_${Date.now()}`
    this.sessions[service].set(accessToken, nextRefreshToken)
    const context =
      service === 'messaging' ? clone(this.data.operator) : clone(this.data.accountContext)
    return {
      access_token: accessToken,
      refresh_token: nextRefreshToken,
      token_type: 'Bearer',
      expires_in: 900,
      service,
      context,
    }
  }

  logout(service, headers, body) {
    const token = this.getBearerToken(headers)
    this.sessions[service].delete(token)
    if (body.refresh_token) {
      for (const [access, refresh] of this.sessions[service].entries()) {
        if (refresh === body.refresh_token) this.sessions[service].delete(access)
      }
    }
    return { revoked: true, revoked_at: now() }
  }

  createTicket() {
    const id = `mock_ticket_${String(this.counters.ticket++).padStart(4, '0')}`
    return {
      hub_url: 'wss://mock-hub.superapp.local',
      connection_token: id,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      project_id: this.data.operator.project_id,
      operator_id: this.data.operator.id,
      support_level: this.data.operator.support_level,
      allowed_sources: ['bale', 'chat'],
    }
  }

  getConversation(id) {
    const conversation = this.data.conversations.find((item) => item.id === id && !item.deleted_at)
    if (!conversation) fail(404, 'NOT_FOUND', 'گفتگو پیدا نشد.')
    return clone(conversation)
  }

  sendMessage(body) {
    if (!body.client_mutation_id) {
      fail(422, 'VALIDATION_ERROR', 'client_mutation_id الزامی است.', {
        errors: { client_mutation_id: ['الزامی است.'] },
      })
    }
    if (!body.source || !body.robot_id || !body.channel_chat_id || !body.sender) {
      fail(422, 'VALIDATION_ERROR', 'source، robot_id، channel_chat_id و sender الزامی هستند.')
    }
    if (!String(body.text || '').trim() && !body.attachment) {
      fail(422, 'VALIDATION_ERROR', 'متن یا پیوست الزامی است.')
    }
    const existing = this.data.messages.find(
      (message) => message.client_mutation_id === body.client_mutation_id,
    )
    if (existing) {
      return {
        created: false,
        conversation: this.getConversation(existing.conversation_id),
        message: clone(existing),
      }
    }
    const conversation = this.data.conversations.find(
      (item) =>
        item.source === body.source &&
        item.robot_id === body.robot_id &&
        item.chat_id === body.channel_chat_id &&
        !item.deleted_at,
    )
    if (!conversation) fail(404, 'NOT_FOUND', 'گفتگو مرتبط پیدا نشد.')
    const timestamp = body.sent_at || now()
    const message = {
      id: `msg_${this.counters.message++}`,
      conversation_id: conversation.id,
      client_mutation_id: body.client_mutation_id,
      sender: body.sender,
      sender_id:
        body.sender === 'operator'
          ? this.data.operator.id
          : conversation.customer.id || `guest_${conversation.chat_id}`,
      text: String(body.text || '').trim(),
      attachment: body.attachment || null,
      sent_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      delivery_status: body.sender === 'operator' ? 'pending' : 'sent',
    }
    this.data.messages.push(message)
    conversation.last_message = message.text || 'پیوست'
    conversation.last_message_at = timestamp
    conversation.updated_at = timestamp
    return { created: true, conversation: clone(conversation), message: clone(message) }
  }

  updateMessageStatus(id, body) {
    if (!['sent', 'failed'].includes(body.status)) {
      fail(422, 'VALIDATION_ERROR', 'وضعیت پیام باید sent یا failed باشد.')
    }
    const message = this.data.messages.find((item) => item.id === id)
    if (!message) fail(404, 'NOT_FOUND', 'پیام پیدا نشد.')
    if (message.sender !== 'operator')
      fail(422, 'VALIDATION_ERROR', 'فقط پیام اپراتور وضعیت تحویل دارد.')
    message.delivery_status = body.status
    message.updated_at = now()
    return clone(message)
  }

  assignConversation(id, body) {
    if (!body.operator_id) fail(422, 'VALIDATION_ERROR', 'operator_id الزامی است.')
    const target = this.data.conversations.find((item) => item.id === id)
    const operator =
      body.operator_id === this.data.operator.id
        ? { id: this.data.operator.id, name: this.data.operator.name }
        : { id: body.operator_id, name: 'اپراتور دیگر' }
    target.assignee = operator
    target.status = 'assigned'
    target.updated_at = now()
    return clone(target)
  }

  escalateConversation(id, body) {
    if (!['level_1', 'level_2', 'level_3'].includes(body.support_level)) {
      fail(422, 'VALIDATION_ERROR', 'سطح پشتیبانی معتبر نیست.')
    }
    const conversation = this.data.conversations.find((item) => item.id === id && !item.deleted_at)
    if (!conversation) fail(404, 'NOT_FOUND', 'گفتگو پیدا نشد.')
    conversation.support_level = body.support_level
    conversation.status = 'escalated'
    conversation.updated_at = now()
    return clone(conversation)
  }

  updateConversationStatus(id, body) {
    const allowed = ['open', 'assigned', 'pending_customer', 'escalated', 'closed']
    if (!allowed.includes(body.status)) fail(422, 'VALIDATION_ERROR', 'وضعیت گفتگو معتبر نیست.')
    const conversation = this.data.conversations.find((item) => item.id === id && !item.deleted_at)
    if (!conversation) fail(404, 'NOT_FOUND', 'گفتگو پیدا نشد.')
    conversation.status = body.status
    conversation.updated_at = now()
    return clone(conversation)
  }

  sync(query) {
    if (query.cursor === 'mock_cursor_1') {
      return { changes: [], next_cursor: 'mock_cursor_1', server_time: now(), has_more: false }
    }
    const changes = this.data.syncChanges.map((change) => {
      const data =
        change.entity === 'conversation'
          ? this.data.conversations.find((item) => item.id === change.id)
          : this.data.messages.find((item) => item.id === change.id)
      return { ...clone(change), data: change.op === 'delete' ? null : clone(data || null) }
    })
    return { changes, next_cursor: 'mock_cursor_1', server_time: now(), has_more: false }
  }

  uploadAttachment(body) {
    if (!body.file_name || !body.mime_type || !Number.isFinite(Number(body.file_size))) {
      fail(422, 'VALIDATION_ERROR', 'file_name، mime_type و file_size الزامی هستند.')
    }
    const attachment = {
      id: `att_${this.counters.attachment++}`,
      provider: 'planet',
      type: body.kind || 'document',
      file_name: body.file_name,
      mime_type: body.mime_type,
      file_size: Number(body.file_size),
      duration: body.duration ?? null,
      url: null,
      created_at: now(),
    }
    this.data.attachments.push(attachment)
    return clone(attachment)
  }

  getAttachment(id) {
    const attachment = this.data.attachments.find((item) => item.id === id)
    if (!attachment) fail(404, 'NOT_FOUND', 'پیوست پیدا نشد.')
    return clone(attachment)
  }

  requireServiceToken(headers, service) {
    const token = this.getBearerToken(headers)
    const expectedService = token.startsWith(`mock_${service}_access_`) ? service : null
    if (!token || !expectedService) {
      fail(401, 'UNAUTHENTICATED', `نشست سرویس ${service} معتبر نیست.`)
    }
    if (!this.sessions[service].has(token)) {
      fail(401, 'UNAUTHENTICATED', 'نشست منقضی یا باطل شده است.')
    }
  }

  getBearerToken(headers) {
    const authorization = headers.get('authorization') || ''
    return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  }

  assertMethod(method, expected, path) {
    if (method !== expected) {
      fail(405, 'METHOD_NOT_ALLOWED', `مسیر ${path} فقط متد ${expected} را می‌پذیرد.`)
    }
  }
}

export function createMockApi(initialData) {
  return new MockApi(initialData)
}
