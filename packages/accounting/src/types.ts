import type {
  AccountingDashboard,
  AccountingDocument,
  AccountingDocumentListQuery,
  AccountingDocumentPage,
  AccountingDocumentType,
} from '@superapp/chat-contracts'
import type { Money } from '@superapp/chat-contracts'
import type { AccountingApi } from '@superapp/api-client'

export type AccountingResourceStatus = 'idle' | 'loading' | 'ready' | 'error'
export type AccountingDataSource = 'remote' | 'cache'

export interface AccountingResource<T> {
  data: T | null
  status: AccountingResourceStatus
  error: string | null
  dataSource: AccountingDataSource | null
  lastSyncedAt: string | null
}

export interface AccountingReportRow {
  type: AccountingDocumentType
  count: number
  total: Money
}

export interface AccountingReport {
  items: AccountingDocument[]
  rows: AccountingReportRow[]
  generatedAt: string
}

export interface AccountingCache {
  getDashboard(ownerId: string): Promise<AccountingDashboard | null>
  saveDashboard(ownerId: string, dashboard: AccountingDashboard, syncedAt?: string): Promise<void>
  listDocuments(
    ownerId: string,
    query: AccountingDocumentListQuery,
  ): Promise<AccountingDocumentPage>
  saveDocuments(ownerId: string, documents: AccountingDocument[], syncedAt?: string): Promise<void>
  getDocument(ownerId: string, id: string): Promise<AccountingDocument | null>
  getSyncState(ownerId: string, dataset: string): Promise<{ last_synced_at: string | null } | null>
  clear(ownerId: string): Promise<void>
}

export interface UseAccountingOptions {
  api: AccountingApi
  ownerId: string
  accessToken?: string
  cache?: AccountingCache
  isOnline?: boolean
  enabled?: boolean
  pageSize?: number
}

export interface UseAccountingResult {
  dashboard: AccountingResource<AccountingDashboard>
  documents: AccountingResource<AccountingDocumentPage>
  report: AccountingResource<AccountingReport>
  detail: AccountingResource<AccountingDocument> & { id: string | null }
  filters: AccountingDocumentListQuery
  setFilters: (filters: Partial<AccountingDocumentListQuery>) => void
  refreshDashboard: () => Promise<void>
  refreshDocuments: () => Promise<void>
  refreshReport: () => Promise<void>
  refreshAll: () => Promise<void>
  loadMoreDocuments: () => Promise<void>
  openDocument: (id: string) => Promise<void>
  closeDetail: () => void
}
