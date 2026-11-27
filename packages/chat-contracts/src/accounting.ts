import type { CursorPageQuery, EntityId, ISODateTime, Nullable, Paginated } from './common'
import type { Money } from './commerce'

export type AccountingDocumentType = 'invoice' | 'receipt' | 'payment' | 'journal'
export type AccountingDocumentStatus = 'draft' | 'confirmed' | 'cancelled'

export interface AccountingDocument {
  id: EntityId
  code: string
  type: AccountingDocumentType
  status: AccountingDocumentStatus
  counterparty_name: string
  total: Money
  issued_at: ISODateTime
  updated_at: ISODateTime
  deleted_at: Nullable<ISODateTime>
  description: string
}

export interface AccountBalance {
  account_id: EntityId
  title: string
  balance: Money
  updated_at: ISODateTime
}

export interface AccountingDashboard {
  total_receivable: Money
  total_payable: Money
  current_balance: Money
  documents_count: number
  balances: AccountBalance[]
  updated_at: ISODateTime
}

export interface AccountingDocumentListQuery extends CursorPageQuery {
  search?: string
  type?: AccountingDocumentType
  status?: AccountingDocumentStatus
  issued_from?: ISODateTime
  issued_to?: ISODateTime
}

export type AccountingDocumentPage = Paginated<AccountingDocument>
