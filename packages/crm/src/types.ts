export type CrmOwnerId = string

export interface CrmContact {
  local_id: string
  owner_id: CrmOwnerId
  display_name: string
  phone: string | null
  email: string | null
  tag_ids: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CrmTag {
  local_id: string
  owner_id: CrmOwnerId
  title: string
  color: string
  created_at: string
  updated_at: string
}

export interface CrmNote {
  local_id: string
  owner_id: CrmOwnerId
  contact_id: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CrmTask {
  local_id: string
  owner_id: CrmOwnerId
  contact_id: string | null
  title: string
  due_at: string | null
  completed: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type CrmInteractionKind = 'call' | 'message' | 'meeting' | 'email' | 'other'

export interface CrmInteraction {
  local_id: string
  owner_id: CrmOwnerId
  contact_id: string
  kind: CrmInteractionKind
  summary: string
  occurred_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CrmContactInput {
  display_name: string
  phone?: string | null
  email?: string | null
  tag_ids?: string[]
}

export interface CrmTagInput {
  title: string
  color?: string
}

export interface CrmNoteInput {
  contact_id: string
  body: string
}

export interface CrmTaskInput {
  contact_id?: string | null
  title: string
  due_at?: string | null
  completed?: boolean
}

export interface CrmInteractionInput {
  contact_id: string
  kind: CrmInteractionKind
  summary: string
  occurred_at?: string
}

export interface CrmContactQuery {
  search?: string
  tagId?: string
  cursor?: string
  limit?: number
}

export interface CrmTaskQuery {
  contactId?: string
  completed?: boolean
}

export interface CrmDataset {
  format: 'superapp.crm.backup'
  version: 1
  exported_at: string
  owner_id: CrmOwnerId
  contacts: CrmContact[]
  tags: CrmTag[]
  notes: CrmNote[]
  tasks: CrmTask[]
  interactions: CrmInteraction[]
}

export interface CrmBackupEnvelope {
  format: 'superapp.crm.backup.encrypted'
  version: 1
  owner_id: CrmOwnerId
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export interface CrmLockRecord {
  version: 1
  salt: string
  hash: string
  iterations: number
}

export interface CrmKeyValueStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}
