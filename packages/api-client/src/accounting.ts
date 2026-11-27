import type {
  AccountingDashboard,
  AccountingDocument,
  AccountingDocumentListQuery,
  AccountingDocumentPage,
} from '@superapp/chat-contracts'
import documentFixtures from '../mocks/fixtures/accounting-documents.json'
import dashboardFixture from '../mocks/fixtures/accounting-dashboard.json'
import { PlanetApiError } from './media'

export interface AccountingRequestContext {
  accessToken?: string
  signal?: AbortSignal
}

export interface AccountingApi {
  dashboard(context?: AccountingRequestContext): Promise<AccountingDashboard>
  listDocuments(
    query?: AccountingDocumentListQuery,
    context?: AccountingRequestContext,
  ): Promise<AccountingDocumentPage>
  getDocument(id: string, context?: AccountingRequestContext): Promise<AccountingDocument | null>
}

export interface PlanetAccountingApiOptions {
  baseUrl: string
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  fetch?: typeof fetch
}

const documents = documentFixtures as unknown as AccountingDocument[]
const dashboard = dashboardFixture as AccountingDashboard
const DOCUMENT_TYPES: AccountingDocument['type'][] = ['invoice', 'receipt', 'payment', 'journal']
const DOCUMENT_STATUSES: AccountingDocument['status'][] = ['draft', 'confirmed', 'cancelled']

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  if (signal.reason !== undefined) throw signal.reason
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  throw error
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function offsetFromCursor(cursor?: string) {
  const match = /^offset_(\d+)$/.exec(cursor || '')
  if (!match) return 0
  const offset = Number(match[1])
  return Number.isFinite(offset) ? offset : 0
}

function includesSearch(value: string, search: string) {
  return value.toLocaleLowerCase('fa').includes(search.toLocaleLowerCase('fa'))
}

function issuedAtBoundary(value: string, endOfDay: boolean) {
  const trimmed = value.trim()
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
  const normalized = dateOnly
    ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : trimmed
  const timestamp = Date.parse(normalized)
  if (
    !Number.isFinite(timestamp) ||
    (dateOnly && new Date(timestamp).toISOString().slice(0, 10) !== trimmed)
  ) {
    throw new PlanetApiError('بازه زمانی حسابداری معتبر نیست.', 422)
  }
  return timestamp
}

function normalizeListQuery(query: AccountingDocumentListQuery) {
  const issuedFrom = query.issued_from?.trim() ? issuedAtBoundary(query.issued_from, false) : null
  const issuedTo = query.issued_to?.trim() ? issuedAtBoundary(query.issued_to, true) : null
  if (issuedFrom !== null && issuedTo !== null && issuedFrom > issuedTo) {
    throw new PlanetApiError('بازه زمانی حسابداری معتبر نیست.', 422)
  }
  return {
    query: {
      ...query,
      search: query.search?.trim() || undefined,
      issued_from: query.issued_from?.trim() || undefined,
      issued_to: query.issued_to?.trim() || undefined,
    },
    issuedFrom,
    issuedTo,
  }
}

function paginate(items: AccountingDocument[], query: AccountingDocumentListQuery) {
  const requestedLimit = Number(query.limit)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
    : 30
  const offset = offsetFromCursor(query.cursor)
  const pageItems = items.slice(offset, offset + limit)
  const nextOffset = offset + pageItems.length
  return {
    items: pageItems.map(clone),
    next_cursor: nextOffset < items.length ? `offset_${nextOffset}` : null,
    has_more: nextOffset < items.length,
    total: items.length,
  }
}

export function createMockAccountingApi(): AccountingApi {
  return {
    async dashboard(context) {
      throwIfAborted(context?.signal)
      return clone(dashboard)
    },
    async listDocuments(query = {}, context) {
      throwIfAborted(context?.signal)
      const { query: normalizedQuery, issuedFrom, issuedTo } = normalizeListQuery(query)
      const search = normalizedQuery.search || ''
      const filtered = documents
        .filter((document) => !document.deleted_at)
        .filter((document) => !query.type || document.type === query.type)
        .filter((document) => !query.status || document.status === query.status)
        .filter(
          (document) =>
            !search ||
            includesSearch(document.code, search) ||
            includesSearch(document.counterparty_name, search) ||
            includesSearch(document.description, search),
        )
        .filter((document) => issuedFrom === null || Date.parse(document.issued_at) >= issuedFrom)
        .filter((document) => issuedTo === null || Date.parse(document.issued_at) <= issuedTo)
        .sort(
          (first, second) =>
            Date.parse(second.issued_at) - Date.parse(first.issued_at) ||
            second.id.localeCompare(first.id),
        )
      return paginate(filtered, normalizedQuery)
    },
    async getDocument(id, context) {
      throwIfAborted(context?.signal)
      const document = documents.find((item) => item.id === id && !item.deleted_at)
      return document ? clone(document) : null
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isMoney(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.currency === 'IRR'
  )
}

function isCount(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
  )
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isNullableDateTime(value: unknown): value is string | null {
  return value === null || isDateTime(value)
}

function isDocument(value: unknown): value is AccountingDocument {
  if (!isRecord(value) || !isMoney(value.total)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    DOCUMENT_TYPES.includes(value.type as AccountingDocument['type']) &&
    DOCUMENT_STATUSES.includes(value.status as AccountingDocument['status']) &&
    typeof value.counterparty_name === 'string' &&
    isDateTime(value.issued_at) &&
    isDateTime(value.updated_at) &&
    isNullableDateTime(value.deleted_at) &&
    typeof value.description === 'string'
  )
}

function isAccountBalance(value: unknown): value is AccountingDashboard['balances'][number] {
  return (
    isRecord(value) &&
    typeof value.account_id === 'string' &&
    typeof value.title === 'string' &&
    isMoney(value.balance) &&
    isDateTime(value.updated_at)
  )
}

function isDashboard(value: unknown): value is AccountingDashboard {
  return (
    isRecord(value) &&
    isMoney(value.total_receivable) &&
    isMoney(value.total_payable) &&
    isMoney(value.current_balance) &&
    isCount(value.documents_count) &&
    Array.isArray(value.balances) &&
    value.balances.every(isAccountBalance) &&
    isDateTime(value.updated_at)
  )
}

function isPage<T>(
  value: unknown,
  validate: (item: unknown) => item is T,
): value is {
  items: T[]
  next_cursor: string | null
  has_more: boolean
  total?: number
} {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(validate) ||
    !isNullableString(value.next_cursor) ||
    typeof value.has_more !== 'boolean' ||
    (value.total !== undefined && !isCount(value.total))
  ) {
    return false
  }
  return value.has_more
    ? typeof value.next_cursor === 'string' && value.next_cursor.length > 0
    : value.next_cursor === null
}

function isDocumentPage(value: unknown): value is AccountingDocumentPage {
  return isPage(value, isDocument)
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

function invalidPayload(status: number): PlanetApiError {
  return new PlanetApiError('پاسخ Planet معتبر نیست.', status)
}

function invalidData(status: number): PlanetApiError {
  return new PlanetApiError('داده حسابداری معتبر نیست.', status)
}

export function createPlanetAccountingApi({
  baseUrl,
  getAccessToken,
  fetch: fetchImpl = globalThis.fetch,
}: PlanetAccountingApiOptions): AccountingApi {
  const root = baseUrl.replace(/\/$/, '')

  async function request<T>(
    path: string,
    query: object = {},
    context: AccountingRequestContext = {},
    validate: (value: unknown) => value is T,
  ): Promise<T> {
    throwIfAborted(context.signal)
    const url = new URL(`${root}${path}`)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
    const accessToken = context.accessToken || (await getAccessToken?.())
    throwIfAborted(context.signal)
    const headers = new Headers({ Accept: 'application/json' })
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    const response = await fetchImpl(url, { method: 'GET', headers, signal: context.signal })
    throwIfAborted(context.signal)
    if (!response.ok) {
      throw new PlanetApiError('دریافت داده حسابداری ناموفق بود.', response.status)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      throwIfAborted(context.signal)
      if (isAbortError(error)) throw error
      throw invalidPayload(response.status)
    }
    throwIfAborted(context.signal)
    if (!isRecord(payload) || payload.status !== true || !('data' in payload)) {
      throw invalidPayload(response.status)
    }
    if (!validate(payload.data)) throw invalidData(response.status)
    return payload.data
  }

  return {
    dashboard(context) {
      return request('/api/v1/account/accounting/dashboard', {}, context, isDashboard)
    },
    async listDocuments(query = {}, context) {
      const { query: requestQuery } = normalizeListQuery(query)
      return request('/api/v1/account/accounting/documents', requestQuery, context, isDocumentPage)
    },
    getDocument(id, context) {
      return request<AccountingDocument | null>(
        `/api/v1/account/accounting/documents/${encodeURIComponent(id)}`,
        {},
        context,
        (value) => value === null || isDocument(value),
      )
    },
  }
}

export function createConfiguredAccountingApi(baseUrl?: string): AccountingApi {
  const normalizedBaseUrl = baseUrl?.trim()
  return normalizedBaseUrl
    ? createPlanetAccountingApi({ baseUrl: normalizedBaseUrl })
    : createMockAccountingApi()
}
