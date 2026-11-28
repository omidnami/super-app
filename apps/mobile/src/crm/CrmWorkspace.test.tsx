import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, waitFor, within } from '@testing-library/react-native'
import type { CrmContact, UseCrmResult } from '@superapp/crm'
import { ThemeProvider } from '@superapp/theme'
import { CrmWorkspace } from '../../../../packages/ui/native/crm'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const contact: CrmContact = {
  local_id: 'contact_1',
  owner_id: 'local-personal',
  display_name: 'سارا احمدی',
  phone: '09120000000',
  email: null,
  tag_ids: [],
  created_at: '2026-11-28T09:00:00.000Z',
  updated_at: '2026-11-28T09:00:00.000Z',
  deleted_at: null,
}

const storage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
}

function createCrm(): UseCrmResult {
  return {
    lockState: 'unlocked',
    lockError: null,
    dataError: null,
    loading: false,
    contacts: [contact],
    tags: [],
    notes: [],
    tasks: [],
    interactions: [],
    setPin: jest.fn(async () => undefined),
    unlock: jest.fn(async () => undefined),
    lock: jest.fn(),
    refresh: jest.fn(async () => undefined),
    createContact: jest.fn(async () => undefined),
    updateContact: jest.fn(async () => undefined),
    deleteContact: jest.fn(async () => undefined),
    createTag: jest.fn(async () => undefined),
    updateTag: jest.fn(async () => undefined),
    deleteTag: jest.fn(async () => undefined),
    createNote: jest.fn(async () => undefined),
    updateNote: jest.fn(async () => undefined),
    deleteNote: jest.fn(async () => undefined),
    createTask: jest.fn(async () => undefined),
    updateTask: jest.fn(async () => undefined),
    deleteTask: jest.fn(async () => undefined),
    createInteraction: jest.fn(async () => undefined),
    updateInteraction: jest.fn(async () => undefined),
    deleteInteraction: jest.fn(async () => undefined),
    exportBackup: jest.fn(async () => 'encrypted-payload'),
    importBackup: jest.fn(async () => undefined),
  }
}

async function renderCrm(crm: UseCrmResult) {
  const onShareBackup = jest.fn(async () => undefined)
  const onPickBackup = jest.fn(async () => null)
  const view = await render(
    <ThemeProvider systemColorScheme="light" storage={storage}>
      <CrmWorkspace crm={crm} onShareBackup={onShareBackup} onPickBackup={onPickBackup} />
    </ThemeProvider>,
  )
  return { ...view, onShareBackup, onPickBackup }
}

function dialogByTitle(
  getAllByLabelText: Awaited<ReturnType<typeof render>>['getAllByLabelText'],
  title: string,
) {
  const dialog = getAllByLabelText(title).find(
    (element) => element.props.accessibilityRole === 'dialog',
  )
  if (!dialog) throw new Error(`Dialog ${title} was not rendered.`)
  return dialog
}

describe('native CRM workspace', () => {
  it('stores task dates and interaction times in backup-compatible ISO format', async () => {
    const crm = createCrm()
    const { getAllByLabelText, getByLabelText } = await renderCrm(crm)

    await fireEvent.press(getByLabelText('کارها'))
    await fireEvent.press(getByLabelText('کار جدید'))
    const taskDialog = dialogByTitle(getAllByLabelText, 'کار جدید')
    await fireEvent.changeText(within(taskDialog).getByLabelText('عنوان کار'), 'ارسال پیشنهاد')
    await fireEvent.changeText(within(taskDialog).getByLabelText('موعد کار'), '2026-11-30')
    await fireEvent.press(within(taskDialog).getByLabelText('ساخت کار'))
    expect(crm.createTask).toHaveBeenCalledWith({
      contact_id: null,
      title: 'ارسال پیشنهاد',
      due_at: '2026-11-30T00:00:00.000Z',
      completed: false,
    })

    await fireEvent.press(getByLabelText('مخاطبین'))
    await fireEvent.press(getByLabelText('جزئیات سارا احمدی'))
    await fireEvent.press(getByLabelText('تعامل‌ها'))
    await fireEvent.press(getByLabelText('تعامل جدید'))
    const interactionDialog = dialogByTitle(getAllByLabelText, 'تعامل جدید')
    const occurredAt = '2026-11-28T14:30'
    await fireEvent.changeText(
      within(interactionDialog).getByLabelText('خلاصه تعامل'),
      'جلسه پیشنهاد',
    )
    await fireEvent.changeText(within(interactionDialog).getByLabelText('زمان برخورد'), occurredAt)
    await fireEvent.press(within(interactionDialog).getByLabelText('ثبت تعامل'))
    expect(crm.createInteraction).toHaveBeenCalledWith({
      contact_id: contact.local_id,
      kind: 'call',
      summary: 'جلسه پیشنهاد',
      occurred_at: new Date(occurredAt).toISOString(),
    })
  })

  it('asks for the current PIN and hands encrypted backup text only to the share callback', async () => {
    const crm = createCrm()
    const { getAllByLabelText, getByLabelText, queryByText, onShareBackup } = await renderCrm(crm)

    await fireEvent.press(getByLabelText('پشتیبان امن CRM'))
    await fireEvent.press(getByLabelText('دریافت پشتیبان رمزنگاری‌شده'))
    const exportDialog = dialogByTitle(getAllByLabelText, 'دریافت پشتیبان امن')
    await fireEvent.changeText(
      within(exportDialog).getByLabelText('PIN فعلی برای دریافت پشتیبان'),
      '1234',
    )
    await fireEvent.press(within(exportDialog).getByLabelText('رمزنگاری و اشتراک‌گذاری'))

    await waitFor(() => expect(onShareBackup).toHaveBeenCalledWith('encrypted-payload'))
    expect(crm.exportBackup).toHaveBeenCalledWith('1234')
    expect(queryByText('encrypted-payload')).toBeNull()
  })
})
