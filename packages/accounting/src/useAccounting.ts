import { useCallback, useEffect, useRef, useState } from 'react'
import { PlanetApiError } from '@superapp/api-client'
import type {
  AccountingDashboard,
  AccountingDocument,
  AccountingDocumentListQuery,
  AccountingDocumentPage,
} from '@superapp/chat-contracts'
import { buildAccountingReport } from './presentation'
import type {
  AccountingReport,
  AccountingResource,
  UseAccountingOptions,
  UseAccountingResult,
} from './types'

const DEFAULT_ERROR = 'دریافت داده حسابداری ناموفق بود.'
const AUTH_ERROR = 'دسترسی به داده مالی مجاز نیست.'
const OFFLINE_ERROR = 'داده آفلاین حسابداری در دسترس نیست.'
const REPORT_INCOMPLETE_ERROR = 'گزارش کامل نیست؛ بازه یا فیلتر را محدودتر کنید.'
const DATE_FILTER_ERROR = 'بازه زمانی معتبر نیست؛ تاریخ‌ها را با قالب YYYY-MM-DD وارد کنید.'
const REPORT_PAGE_SIZE = 100
const MAX_REPORT_PAGES = 10

function initialResource<T>(): AccountingResource<T> {
  return { data: null, status: 'idle', error: null, dataSource: null, lastSyncedAt: null }
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

function isAuthError(error: unknown) {
  return error instanceof PlanetApiError && (error.status === 401 || error.status === 403)
}

function canUseCache(error: unknown) {
  if (
    error instanceof Error &&
    [DATE_FILTER_ERROR, REPORT_INCOMPLETE_ERROR].includes(error.message)
  ) {
    return false
  }
  if (!(error instanceof PlanetApiError)) return true
  return error.status === 408 || error.status === 429 || error.status >= 500
}

function errorMessage(error: unknown) {
  if (isAuthError(error)) return AUTH_ERROR
  if (error instanceof PlanetApiError) return error.message
  if (
    error instanceof Error &&
    [OFFLINE_ERROR, REPORT_INCOMPLETE_ERROR, DATE_FILTER_ERROR].includes(error.message)
  ) {
    return error.message
  }
  return DEFAULT_ERROR
}

function mergeById(current: AccountingDocument[], incoming: AccountingDocument[]) {
  const seen = new Set(current.map((item) => item.id))
  const additions = incoming.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
  return [...current, ...additions]
}

function normalizedDate(value?: string) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const timestamp = Date.parse(`${trimmed}T00:00:00.000Z`)
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== trimmed) {
      return undefined
    }
    return trimmed
  }
  const timestamp = Date.parse(trimmed)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}

function normalizedFilters(filters: AccountingDocumentListQuery, limit: number) {
  const issuedFrom = normalizedDate(filters.issued_from)
  const issuedTo = normalizedDate(filters.issued_to)
  if ((filters.issued_from?.trim() && !issuedFrom) || (filters.issued_to?.trim() && !issuedTo)) {
    throw new Error(DATE_FILTER_ERROR)
  }
  if (issuedFrom && issuedTo && Date.parse(issuedFrom) > Date.parse(issuedTo)) {
    throw new Error(DATE_FILTER_ERROR)
  }
  return {
    ...filters,
    search: filters.search?.trim() || undefined,
    issued_from: issuedFrom,
    issued_to: issuedTo,
    limit,
  }
}

export function useAccounting({
  api,
  ownerId,
  accessToken,
  cache,
  isOnline = true,
  enabled = true,
  pageSize = 30,
}: UseAccountingOptions): UseAccountingResult {
  const [dashboard, setDashboard] =
    useState<AccountingResource<AccountingDashboard>>(initialResource)
  const [documents, setDocuments] =
    useState<AccountingResource<AccountingDocumentPage>>(initialResource)
  const [report, setReport] = useState<AccountingResource<AccountingReport>>(initialResource)
  const [detail, setDetail] = useState<UseAccountingResult['detail']>({
    ...initialResource<AccountingDocument>(),
    id: null,
  })
  const [filters, setFiltersState] = useState<AccountingDocumentListQuery>({})
  const dashboardController = useRef<AbortController | null>(null)
  const documentsController = useRef<AbortController | null>(null)
  const reportController = useRef<AbortController | null>(null)
  const detailController = useRef<AbortController | null>(null)
  const documentsLoadingMore = useRef(false)
  const scopeRef = useRef({ ownerId, enabled })

  useEffect(() => {
    const previous = scopeRef.current
    scopeRef.current = { ownerId, enabled }
    if (previous.ownerId !== ownerId || previous.enabled !== enabled) {
      dashboardController.current?.abort()
      documentsController.current?.abort()
      reportController.current?.abort()
      detailController.current?.abort()
      documentsLoadingMore.current = false
      setDashboard(initialResource())
      setDocuments(initialResource())
      setReport(initialResource())
      setDetail({ ...initialResource<AccountingDocument>(), id: null })
    }
    return () => {
      dashboardController.current?.abort()
      documentsController.current?.abort()
      reportController.current?.abort()
      detailController.current?.abort()
      documentsLoadingMore.current = false
    }
  }, [enabled, ownerId])

  const lastSync = useCallback(
    async (dataset: string) => {
      if (!cache) return null
      try {
        return (await cache.getSyncState(ownerId, dataset))?.last_synced_at || null
      } catch {
        return null
      }
    },
    [cache, ownerId],
  )

  const loadDashboard = useCallback(async () => {
    if (!enabled) return
    dashboardController.current?.abort()
    const controller = new AbortController()
    dashboardController.current = controller
    setDashboard((current) => ({ ...current, status: 'loading', error: null }))
    try {
      if (!isOnline) throw new Error(OFFLINE_ERROR)
      const data = await api.dashboard({ accessToken, signal: controller.signal })
      if (controller.signal.aborted) return
      if (cache) {
        try {
          await cache.saveDashboard(ownerId, data)
        } catch {
          // Fresh server data remains available when cache writing fails.
        }
      }
      if (controller.signal.aborted) return
      setDashboard({
        data,
        status: 'ready',
        error: null,
        dataSource: 'remote',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (caught) {
      if (controller.signal.aborted || isAbortError(caught)) return
      if (cache && canUseCache(caught)) {
        try {
          const data = await cache.getDashboard(ownerId)
          if (controller.signal.aborted) return
          if (!data) throw new Error(OFFLINE_ERROR)
          const lastSyncedAt = await lastSync('accounting:dashboard')
          if (controller.signal.aborted) return
          setDashboard({
            data,
            status: 'ready',
            error: null,
            dataSource: 'cache',
            lastSyncedAt,
          })
          return
        } catch {
          // Fall through to the error state.
        }
      }
      setDashboard({
        data: null,
        status: 'error',
        error: errorMessage(caught),
        dataSource: null,
        lastSyncedAt: null,
      })
    }
  }, [accessToken, api, cache, enabled, isOnline, lastSync, ownerId])

  const loadDocuments = useCallback(async () => {
    if (!enabled) return
    documentsController.current?.abort()
    const controller = new AbortController()
    documentsController.current = controller
    documentsLoadingMore.current = false
    setDocuments((current) => ({ ...current, status: 'loading', error: null, data: null }))
    try {
      const query = normalizedFilters(filters, pageSize)
      if (!isOnline) throw new Error(OFFLINE_ERROR)
      const data = await api.listDocuments(query, { accessToken, signal: controller.signal })
      if (controller.signal.aborted) return
      if (cache) {
        try {
          await cache.saveDocuments(ownerId, data.items)
        } catch {
          // Keep the remote page available even when caching fails.
        }
      }
      if (controller.signal.aborted) return
      setDocuments({
        data,
        status: 'ready',
        error: null,
        dataSource: 'remote',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (caught) {
      if (controller.signal.aborted || isAbortError(caught)) return
      if (cache && canUseCache(caught)) {
        try {
          const data = await cache.listDocuments(ownerId, normalizedFilters(filters, pageSize))
          if (controller.signal.aborted) return
          const lastSyncedAt = await lastSync('accounting:documents')
          if (controller.signal.aborted) return
          if (!data.items.length && !lastSyncedAt) throw new Error(OFFLINE_ERROR)
          setDocuments({
            data,
            status: 'ready',
            error: null,
            dataSource: 'cache',
            lastSyncedAt,
          })
          return
        } catch {
          // Fall through to the error state.
        }
      }
      setDocuments({
        data: null,
        status: 'error',
        error: errorMessage(caught),
        dataSource: null,
        lastSyncedAt: null,
      })
    }
  }, [accessToken, api, cache, enabled, filters, isOnline, lastSync, ownerId, pageSize])

  const loadReport = useCallback(async () => {
    if (!enabled) return
    reportController.current?.abort()
    const controller = new AbortController()
    reportController.current = controller
    setReport((current) => ({ ...current, status: 'loading', error: null }))
    const context = { accessToken, signal: controller.signal }
    let remotePageReceived = false
    let query: ReturnType<typeof normalizedFilters> | undefined

    try {
      query = normalizedFilters(filters, REPORT_PAGE_SIZE)
      if (!isOnline) throw new Error(OFFLINE_ERROR)
      let items: AccountingDocument[] = []
      let cursor: string | undefined
      for (let pageNumber = 0; pageNumber < MAX_REPORT_PAGES; pageNumber += 1) {
        const page = await api.listDocuments({ ...query, cursor }, context)
        if (controller.signal.aborted) return
        remotePageReceived = true
        items = mergeById(items, page.items)
        if (!page.has_more) {
          if (cache) {
            try {
              await cache.saveDocuments(ownerId, items)
            } catch {
              // Report generation does not depend on a cache write.
            }
          }
          if (controller.signal.aborted) return
          setReport({
            data: buildAccountingReport(items),
            status: 'ready',
            error: null,
            dataSource: 'remote',
            lastSyncedAt: new Date().toISOString(),
          })
          return
        }
        if (!page.next_cursor) throw new Error(REPORT_INCOMPLETE_ERROR)
        cursor = page.next_cursor
      }
      throw new Error(REPORT_INCOMPLETE_ERROR)
    } catch (caught) {
      if (controller.signal.aborted || isAbortError(caught)) return
      let reportError: unknown = caught
      if (cache && !remotePageReceived && canUseCache(caught)) {
        try {
          let items: AccountingDocument[] = []
          let cursor: string | undefined
          for (let pageNumber = 0; pageNumber < MAX_REPORT_PAGES; pageNumber += 1) {
            const page = await cache.listDocuments(ownerId, {
              ...(query || normalizedFilters(filters, REPORT_PAGE_SIZE)),
              cursor,
            })
            if (controller.signal.aborted) return
            items = mergeById(items, page.items)
            if (!page.has_more) {
              const lastSyncedAt = await lastSync('accounting:documents')
              if (controller.signal.aborted) return
              if (!items.length && !lastSyncedAt) throw new Error(OFFLINE_ERROR)
              setReport({
                data: buildAccountingReport(items),
                status: 'ready',
                error: null,
                dataSource: 'cache',
                lastSyncedAt,
              })
              return
            }
            if (!page.next_cursor) throw new Error(REPORT_INCOMPLETE_ERROR)
            cursor = page.next_cursor
          }
          throw new Error(REPORT_INCOMPLETE_ERROR)
        } catch (cacheError) {
          reportError = cacheError
        }
      }
      setReport({
        data: null,
        status: 'error',
        error: errorMessage(reportError),
        dataSource: null,
        lastSyncedAt: null,
      })
    }
  }, [accessToken, api, cache, enabled, filters, isOnline, lastSync, ownerId])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const loadMoreDocuments = useCallback(async () => {
    const current = documents.data
    if (!enabled || !current?.next_cursor || !current.has_more || documentsLoadingMore.current) {
      return
    }
    if (!isOnline && documents.dataSource !== 'cache') {
      await loadDocuments()
      return
    }
    documentsLoadingMore.current = true
    const controller = documentsController.current
    if (!controller || controller.signal.aborted) {
      documentsLoadingMore.current = false
      return
    }
    try {
      const query = {
        ...normalizedFilters(filters, pageSize),
        cursor: current.next_cursor,
      }
      if (documents.dataSource === 'cache') {
        if (!cache) throw new Error(OFFLINE_ERROR)
        const page = await cache.listDocuments(ownerId, query)
        if (controller.signal.aborted) return
        const lastSyncedAt = documents.lastSyncedAt || (await lastSync('accounting:documents'))
        if (controller.signal.aborted) return
        setDocuments({
          data: { ...page, items: mergeById(current.items, page.items) },
          status: 'ready',
          error: null,
          dataSource: 'cache',
          lastSyncedAt,
        })
        return
      }
      const page = await api.listDocuments(query, {
        accessToken,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (cache) {
        try {
          await cache.saveDocuments(ownerId, page.items)
        } catch {
          // Pagination remains usable without a cache write.
        }
      }
      if (controller.signal.aborted) return
      setDocuments({
        data: { ...page, items: mergeById(current.items, page.items) },
        status: 'ready',
        error: null,
        dataSource: 'remote',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (caught) {
      if (!controller.signal.aborted && !isAbortError(caught)) {
        if (isAuthError(caught)) {
          setDocuments({
            data: null,
            status: 'error',
            error: errorMessage(caught),
            dataSource: null,
            lastSyncedAt: null,
          })
        } else {
          setDocuments((previous) => ({ ...previous, error: errorMessage(caught) }))
        }
      }
    } finally {
      documentsLoadingMore.current = false
    }
  }, [
    accessToken,
    api,
    cache,
    documents.data,
    documents.dataSource,
    documents.lastSyncedAt,
    enabled,
    filters,
    isOnline,
    lastSync,
    loadDocuments,
    ownerId,
    pageSize,
  ])

  const openDocument = useCallback(
    async (id: string) => {
      if (!enabled) return
      detailController.current?.abort()
      const controller = new AbortController()
      detailController.current = controller
      setDetail({ ...initialResource<AccountingDocument>(), id, status: 'loading' })
      try {
        if (!isOnline) throw new Error(OFFLINE_ERROR)
        const data = await api.getDocument(id, { accessToken, signal: controller.signal })
        if (controller.signal.aborted) return
        setDetail({
          data,
          id,
          status: 'ready',
          error: null,
          dataSource: 'remote',
          lastSyncedAt: new Date().toISOString(),
        })
      } catch (caught) {
        if (controller.signal.aborted || isAbortError(caught)) return
        if (cache && canUseCache(caught)) {
          try {
            const data = await cache.getDocument(ownerId, id)
            if (controller.signal.aborted) return
            if (!data) throw new Error(OFFLINE_ERROR)
            const lastSyncedAt = await lastSync('accounting:documents')
            if (controller.signal.aborted) return
            setDetail({
              data,
              id,
              status: 'ready',
              error: null,
              dataSource: 'cache',
              lastSyncedAt,
            })
            return
          } catch {
            // Fall through to the error state.
          }
        }
        setDetail({
          data: null,
          id,
          status: 'error',
          error: errorMessage(caught),
          dataSource: null,
          lastSyncedAt: null,
        })
      }
    },
    [accessToken, api, cache, enabled, isOnline, lastSync, ownerId],
  )

  const setFilters = useCallback((patch: Partial<AccountingDocumentListQuery>) => {
    setFiltersState((current) => ({ ...current, ...patch, cursor: undefined }))
  }, [])

  const closeDetail = useCallback(() => {
    detailController.current?.abort()
    setDetail({ ...initialResource<AccountingDocument>(), id: null })
  }, [])

  return {
    dashboard,
    documents,
    report,
    detail,
    filters,
    setFilters,
    refreshDashboard: loadDashboard,
    refreshDocuments: loadDocuments,
    refreshReport: loadReport,
    refreshAll: async () => {
      await Promise.all([loadDashboard(), loadDocuments(), loadReport()])
    },
    loadMoreDocuments,
    openDocument,
    closeDetail,
  }
}
