import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CrmContact,
  CrmContactInput,
  CrmInteraction,
  CrmInteractionInput,
  CrmNote,
  CrmNoteInput,
  CrmTag,
  CrmTagInput,
  CrmTask,
  CrmTaskInput,
} from './types'
import type { CrmRepository } from './repository'
import { decryptCrmBackup, encryptCrmBackup } from './security'

export type CrmLockState = 'loading' | 'setup' | 'locked' | 'unlocked'

export interface UseCrmOptions {
  repository: CrmRepository
  ownerId: string
  lock: {
    hasPin(): Promise<boolean>
    setPin(pin: string): Promise<void>
    verifyPin(pin: string): Promise<boolean>
  }
  randomBytes?: (size: number) => Uint8Array
}

export interface UseCrmResult {
  lockState: CrmLockState
  lockError: string | null
  dataError: string | null
  loading: boolean
  contacts: CrmContact[]
  tags: CrmTag[]
  notes: CrmNote[]
  tasks: CrmTask[]
  interactions: CrmInteraction[]
  setPin: (pin: string) => Promise<void>
  unlock: (pin: string) => Promise<void>
  lock: () => void
  refresh: () => Promise<void>
  createContact: (input: CrmContactInput) => Promise<void>
  updateContact: (id: string, input: CrmContactInput) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  createTag: (input: CrmTagInput) => Promise<void>
  updateTag: (id: string, input: CrmTagInput) => Promise<void>
  deleteTag: (id: string) => Promise<void>
  createNote: (input: CrmNoteInput) => Promise<void>
  updateNote: (id: string, input: CrmNoteInput) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  createTask: (input: CrmTaskInput) => Promise<void>
  updateTask: (id: string, input: CrmTaskInput) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  createInteraction: (input: CrmInteractionInput) => Promise<void>
  updateInteraction: (id: string, input: CrmInteractionInput) => Promise<void>
  deleteInteraction: (id: string) => Promise<void>
  exportBackup: (pin: string) => Promise<string>
  importBackup: (payload: string, pin: string) => Promise<void>
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'عملیات CRM ناموفق بود.'
}

async function loadAllContacts(repository: CrmRepository, ownerId: string) {
  const contacts: CrmContact[] = []
  let cursor: string | undefined
  do {
    const page = await repository.listContacts(ownerId, { cursor, limit: 100 })
    contacts.push(...page.items)
    cursor = page.next_cursor ?? undefined
  } while (cursor)
  return contacts
}

export function useCrm({ repository, ownerId, lock, randomBytes }: UseCrmOptions): UseCrmResult {
  const [lockState, setLockState] = useState<CrmLockState>('loading')
  const [lockError, setLockError] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [tags, setTags] = useState<CrmTag[]>([])
  const [notes, setNotes] = useState<CrmNote[]>([])
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [interactions, setInteractions] = useState<CrmInteraction[]>([])
  const lockStateRef = useRef<CrmLockState>('loading')

  useEffect(() => {
    lockStateRef.current = lockState
  }, [lockState])

  const clearData = useCallback(() => {
    setContacts([])
    setTags([])
    setNotes([])
    setTasks([])
    setInteractions([])
    setDataError(null)
  }, [])

  const loadData = useCallback(async () => {
    const [nextContacts, nextTags, nextNotes, nextTasks, nextInteractions] = await Promise.all([
      loadAllContacts(repository, ownerId),
      repository.listTags(ownerId),
      repository.listNotes(ownerId),
      repository.listTasks(ownerId),
      repository.listInteractions(ownerId),
    ])
    setContacts(nextContacts)
    setTags(nextTags)
    setNotes(nextNotes)
    setTasks(nextTasks)
    setInteractions(nextInteractions)
  }, [ownerId, repository])

  const refresh = useCallback(async () => {
    if (lockStateRef.current !== 'unlocked') return
    setLoading(true)
    setDataError(null)
    try {
      await loadData()
      if (lockStateRef.current !== 'unlocked') clearData()
    } catch (error) {
      if (lockStateRef.current === 'unlocked') setDataError(message(error))
      throw error
    } finally {
      if (lockStateRef.current === 'unlocked') setLoading(false)
    }
  }, [clearData, loadData])

  useEffect(() => {
    let active = true
    lockStateRef.current = 'loading'
    void lock
      .hasPin()
      .then((hasPin) => {
        if (!active) return
        clearData()
        setLockError(null)
        const nextState: CrmLockState = hasPin ? 'locked' : 'setup'
        lockStateRef.current = nextState
        setLockState(nextState)
      })
      .catch((error) => {
        if (!active) return
        clearData()
        lockStateRef.current = 'locked'
        setLockState('locked')
        setLockError(message(error))
      })
    return () => {
      active = false
    }
  }, [clearData, lock, ownerId])

  const setPin = useCallback(
    async (pin: string) => {
      setLockError(null)
      try {
        await lock.setPin(pin)
        lockStateRef.current = 'unlocked'
        setLockState('unlocked')
        await refresh()
      } catch (error) {
        setLockError(message(error))
        throw error
      }
    },
    [lock, refresh],
  )

  const unlock = useCallback(
    async (pin: string) => {
      setLockError(null)
      try {
        const valid = await lock.verifyPin(pin)
        if (!valid) throw new Error('PIN نادرست است.')
        lockStateRef.current = 'unlocked'
        setLockState('unlocked')
        await refresh()
      } catch (error) {
        setLockError(message(error))
        throw error
      }
    },
    [lock, refresh],
  )

  const lockNow = useCallback(() => {
    lockStateRef.current = 'locked'
    clearData()
    setLoading(false)
    setLockError(null)
    setLockState('locked')
  }, [clearData])

  const runMutation = useCallback(
    async (operation: () => Promise<unknown>) => {
      if (lockStateRef.current !== 'unlocked')
        throw new Error('برای تغییر داده‌ها CRM را باز کنید.')
      setLoading(true)
      setDataError(null)
      try {
        await operation()
        if (lockStateRef.current === 'unlocked') await loadData()
      } catch (error) {
        if (lockStateRef.current === 'unlocked') setDataError(message(error))
        throw error
      } finally {
        if (lockStateRef.current === 'unlocked') setLoading(false)
      }
    },
    [loadData],
  )

  const createContact = useCallback(
    (input: CrmContactInput) => runMutation(() => repository.createContact(ownerId, input)),
    [ownerId, repository, runMutation],
  )
  const updateContact = useCallback(
    (id: string, input: CrmContactInput) =>
      runMutation(() => repository.updateContact(ownerId, id, input)),
    [ownerId, repository, runMutation],
  )
  const deleteContact = useCallback(
    (id: string) => runMutation(() => repository.deleteContact(ownerId, id)),
    [ownerId, repository, runMutation],
  )
  const createTag = useCallback(
    (input: CrmTagInput) => runMutation(() => repository.createTag(ownerId, input)),
    [ownerId, repository, runMutation],
  )
  const updateTag = useCallback(
    (id: string, input: CrmTagInput) => runMutation(() => repository.updateTag(ownerId, id, input)),
    [ownerId, repository, runMutation],
  )
  const deleteTag = useCallback(
    (id: string) => runMutation(() => repository.deleteTag(ownerId, id)),
    [ownerId, repository, runMutation],
  )
  const createNote = useCallback(
    (input: CrmNoteInput) => runMutation(() => repository.createNote(ownerId, input)),
    [ownerId, repository, runMutation],
  )
  const updateNote = useCallback(
    (id: string, input: CrmNoteInput) =>
      runMutation(() => repository.updateNote(ownerId, id, input)),
    [ownerId, repository, runMutation],
  )
  const deleteNote = useCallback(
    (id: string) => runMutation(() => repository.deleteNote(ownerId, id)),
    [ownerId, repository, runMutation],
  )
  const createTask = useCallback(
    (input: CrmTaskInput) => runMutation(() => repository.createTask(ownerId, input)),
    [ownerId, repository, runMutation],
  )
  const updateTask = useCallback(
    (id: string, input: CrmTaskInput) =>
      runMutation(() => repository.updateTask(ownerId, id, input)),
    [ownerId, repository, runMutation],
  )
  const deleteTask = useCallback(
    (id: string) => runMutation(() => repository.deleteTask(ownerId, id)),
    [ownerId, repository, runMutation],
  )
  const createInteraction = useCallback(
    (input: CrmInteractionInput) => runMutation(() => repository.createInteraction(ownerId, input)),
    [ownerId, repository, runMutation],
  )
  const updateInteraction = useCallback(
    (id: string, input: CrmInteractionInput) =>
      runMutation(() => repository.updateInteraction(ownerId, id, input)),
    [ownerId, repository, runMutation],
  )
  const deleteInteraction = useCallback(
    (id: string) => runMutation(() => repository.deleteInteraction(ownerId, id)),
    [ownerId, repository, runMutation],
  )

  const exportBackup = useCallback(
    async (pin: string) => {
      if (!(await lock.verifyPin(pin))) throw new Error('PIN نادرست است.')
      return encryptCrmBackup(await repository.exportDataset(ownerId), pin, { randomBytes })
    },
    [lock, ownerId, randomBytes, repository],
  )

  const importBackup = useCallback(
    async (payload: string, pin: string) => {
      if (!(await lock.verifyPin(pin))) throw new Error('PIN نادرست است.')
      const dataset = decryptCrmBackup(payload, pin)
      if (dataset.owner_id !== ownerId) throw new Error('این Backup به فضای CRM دیگری تعلق دارد.')
      setLoading(true)
      setDataError(null)
      try {
        await repository.importDataset(ownerId, dataset)
        await loadData()
      } catch (error) {
        setDataError(message(error))
        throw error
      } finally {
        setLoading(false)
      }
    },
    [loadData, lock, ownerId, repository],
  )

  return {
    lockState,
    lockError,
    dataError,
    loading,
    contacts,
    tags,
    notes,
    tasks,
    interactions,
    setPin,
    unlock,
    lock: lockNow,
    refresh,
    createContact,
    updateContact,
    deleteContact,
    createTag,
    updateTag,
    deleteTag,
    createNote,
    updateNote,
    deleteNote,
    createTask,
    updateTask,
    deleteTask,
    createInteraction,
    updateInteraction,
    deleteInteraction,
    exportBackup,
    importBackup,
  }
}
