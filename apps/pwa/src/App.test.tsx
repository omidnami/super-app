import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('renders the inbox, filters conversations and opens the conversation route', async () => {
    render(<App />)

    fireEvent.click(screen.getAllByLabelText('پیام‌رسان')[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'اتصال به پیام‌رسان' }))

    expect(
      await screen.findByRole('button', { name: 'باز کردن گفتگو علی محمدی' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'فیلتر خوانده‌نشده' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'باز کردن گفتگو مریم احمدی' }),
      ).not.toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'فیلتر همه' }))
    fireEvent.change(screen.getByLabelText('جستجو'), { target: { value: 'موردی وجود ندارد' } })
    expect(await screen.findByText('گفتگویی پیدا نشد')).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('اپراتور')).getByRole('option', { name: 'سارا رضایی' }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('جستجو'), { target: { value: '' } })
    fireEvent.click(await screen.findByRole('button', { name: 'باز کردن گفتگو علی محمدی' }))
    expect(await screen.findByRole('region', { name: 'صفحه گفتگو' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'بازگشت به گفتگوها' }))
    expect(
      await screen.findByRole('button', { name: 'باز کردن گفتگو علی محمدی' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'اتصال Real-Time' }))
    expect(await screen.findByRole('heading', { name: 'اتصال Real-Time' })).toBeInTheDocument()
  }, 15000)

  it('renders UI Kit and switches between independent mini apps', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'UI Kit' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'UI Kit' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByLabelText('پیام‌رسان')[0]!)
    expect(await screen.findByText('محیط مستقل پیام‌رسان')).toBeInTheDocument()

    fireEvent.click(screen.getAllByLabelText('مدیریت حساب')[0]!)
    expect(await screen.findByText('محیط مستقل مدیریت حساب')).toBeInTheDocument()

    fireEvent.click(screen.getAllByLabelText('سوپرآپ')[0]!)
    expect(await screen.findByRole('heading', { name: 'UI Kit' })).toBeInTheDocument()
  })
})
