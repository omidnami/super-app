import { describe, expect, it, jest } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { CrmContact, CrmRepository } from '@superapp/crm'
import { useCrm } from '../../../../packages/crm/src/useCrm'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const OWNER_ID = 'local-personal'
const contact: CrmContact = {
  local_id: 'contact_1',
  owner_id: OWNER_ID,
  display_name: 'مخاطب اول',
  phone: '09000000000',
  email: null,
  tag_ids: [],
  created_at: '2026-11-28T09:00:00.000Z',
  updated_at: '2026-11-28T09:00:00.000Z',
  deleted_at: null,
}

function createHarness(hasPin: boolean) {
  const listContacts = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  listContacts.mockResolvedValue({ items: [contact], next_cursor: null, has_more: false })
  const createContact = jest.fn<(...args: unknown[]) => Promise<CrmContact>>()
  createContact.mockResolvedValue(contact)
  const repository = {
    listContacts,
    listTags: jest.fn(async () => []),
    listNotes: jest.fn(async () => []),
    listTasks: jest.fn(async () => []),
    listInteractions: jest.fn(async () => []),
    createContact,
    exportDataset: jest.fn(),
    importDataset: jest.fn(),
  } as unknown as CrmRepository
  const lock = {
    hasPin: jest.fn(async () => hasPin),
    setPin: jest.fn(async () => undefined),
    verifyPin: jest.fn(async () => true),
  }
  return { repository, lock, listContacts, createContact }
}

describe('useCrm local session', () => {
  it('sets a PIN, loads local data, and follows contact pagination', async () => {
    const { repository, lock, listContacts } = createHarness(false)
    listContacts
      .mockResolvedValueOnce({ items: [contact], next_cursor: 'offset_1', has_more: true })
      .mockResolvedValueOnce({
        items: [{ ...contact, local_id: 'contact_2', display_name: 'مخاطب دوم' }],
        next_cursor: null,
        has_more: false,
      })

    const { result } = await renderHook(() => useCrm({ repository, ownerId: OWNER_ID, lock }))
    await waitFor(() => expect(result.current?.lockState).toBe('setup'))
    expect(result.current.contacts).toEqual([])

    await act(async () => {
      await result.current.setPin('1234')
    })

    expect(lock.setPin).toHaveBeenCalledWith('1234')
    expect(result.current.lockState).toBe('unlocked')
    expect(result.current.contacts.map((item) => item.local_id)).toEqual(['contact_1', 'contact_2'])
    expect(listContacts).toHaveBeenNthCalledWith(1, OWNER_ID, { cursor: undefined, limit: 100 })
    expect(listContacts).toHaveBeenNthCalledWith(2, OWNER_ID, { cursor: 'offset_1', limit: 100 })
  })

  it('keeps data locked until the correct PIN and clears it on manual lock', async () => {
    const { repository, lock, listContacts } = createHarness(true)
    lock.verifyPin.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const { result } = await renderHook(() => useCrm({ repository, ownerId: OWNER_ID, lock }))
    await waitFor(() => expect(result.current.lockState).toBe('locked'))

    await act(async () => {
      await expect(result.current.unlock('0000')).rejects.toThrow('PIN نادرست')
    })
    expect(result.current.lockState).toBe('locked')
    expect(result.current.lockError).toBe('PIN نادرست است.')
    expect(listContacts).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.unlock('1234')
    })
    expect(result.current.lockState).toBe('unlocked')
    expect(result.current.contacts).toEqual([contact])

    await act(async () => {
      result.current.lock()
    })
    expect(result.current.lockState).toBe('locked')
    expect(result.current.contacts).toEqual([])
    await expect(result.current.createContact({ display_name: 'غیرمجاز' })).rejects.toThrow(
      'CRM را باز کنید',
    )
  })

  it('surfaces mutation failures and reloads data after a successful change', async () => {
    const { repository, lock, createContact } = createHarness(false)
    createContact.mockRejectedValueOnce(new Error('ذخیره‌سازی پر است.'))
    const { result } = await renderHook(() => useCrm({ repository, ownerId: OWNER_ID, lock }))
    await waitFor(() => expect(result.current?.lockState).toBe('setup'))
    await act(async () => {
      await result.current.setPin('1234')
    })

    await act(async () => {
      await expect(result.current.createContact({ display_name: 'مخاطب جدید' })).rejects.toThrow(
        'ذخیره‌سازی پر است.',
      )
    })
    expect(result.current.dataError).toBe('ذخیره‌سازی پر است.')

    await act(async () => {
      await result.current.createContact({ display_name: 'مخاطب جدید' })
    })
    expect(result.current.dataError).toBeNull()
    expect(createContact).toHaveBeenCalledTimes(2)
  })
})
