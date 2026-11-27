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
      await screen.findByRole('button', { name: 'باز کردن گفتگو علی محمدی' }, { timeout: 5000 }),
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
    fireEvent.change(screen.getByLabelText('متن پیام'), {
      target: { value: 'پاسخ آزمایشی اپراتور' },
    })
    await waitFor(() =>
      expect(screen.getByLabelText('متن پیام')).toHaveValue('پاسخ آزمایشی اپراتور'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'ارسال' }))
    await waitFor(() =>
      expect(screen.getByLabelText('شما: پاسخ آزمایشی اپراتور')).toHaveTextContent('ارسال‌شده'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'بازگشت' }))
    expect(
      await screen.findByRole('button', { name: 'باز کردن گفتگو علی محمدی' }, { timeout: 5000 }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'اتصال Real-Time' }))
    expect(await screen.findByRole('heading', { name: 'اتصال Real-Time' })).toBeInTheDocument()
  }, 20000)

  it('assigns, escalates, closes and reopens a conversation through the action sheets', async () => {
    render(<App />)
    fireEvent.click(screen.getAllByLabelText('پیام‌رسان')[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'اتصال به پیام‌رسان' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'باز کردن گفتگو علی محمدی' }, { timeout: 5000 }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'تغییر وضعیت' }))
    let dialog = await screen.findByRole('dialog', { name: 'تغییر وضعیت گفتگو' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'بسته' }))
    expect(await screen.findByRole('button', { name: 'باز کردن گفتگو' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'باز کردن گفتگو' }))
    dialog = await screen.findByRole('dialog', { name: 'تغییر وضعیت گفتگو' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'باز کردن مجدد گفتگو' }))
    expect(await screen.findByRole('button', { name: 'تغییر وضعیت' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'تغییر اپراتور' }))
    dialog = await screen.findByRole('dialog', { name: 'تخصیص اپراتور' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'انتخاب اپراتور امیر کریمی' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'واگذاری گفتگو' }))
    expect(await screen.findByText('سطح یک · امیر کریمی')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ارجاع' }))
    dialog = await screen.findByRole('dialog', { name: 'ارجاع گفتگو' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'ارجاع' }))
    expect(await screen.findByText('سطح دو · امیر کریمی')).toBeInTheDocument()
  }, 20000)

  it('shows read-only shop dashboard, orders and product details', async () => {
    render(<App />)
    fireEvent.click(screen.getAllByLabelText('مدیریت حساب')[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'اتصال به مدیریت حساب' }))
    expect(await screen.findByText('فروش امروز')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'سفارش‌ها' }))
    fireEvent.change(screen.getByLabelText('جستجو'), { target: { value: 'TK-1007' } })
    await waitFor(() => {
      expect(screen.getByLabelText('جستجو')).toHaveValue('TK-1007')
      expect(screen.queryByRole('button', { name: 'جزئیات سفارش TK-1008' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'جزئیات سفارش TK-1007' })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('جستجو'), { target: { value: '' } })
    expect(await screen.findByRole('button', { name: 'جزئیات سفارش TK-1008' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('وضعیت سفارش'), { target: { value: 'processing' } })
    await waitFor(() => {
      expect(screen.getByLabelText('وضعیت سفارش')).toHaveValue('processing')
      expect(screen.queryByRole('button', { name: 'جزئیات سفارش TK-1007' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'جزئیات سفارش TK-1008' })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('وضعیت سفارش'), { target: { value: '' } })
    expect(await screen.findByRole('button', { name: 'جزئیات سفارش TK-1007' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'جزئیات سفارش TK-1008' }))
    expect(await screen.findByRole('button', { name: 'بازگشت به فروشگاه' })).toBeInTheDocument()
    expect(screen.getByText(/هدفون بی‌سیم سونی/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'بازگشت به فروشگاه' }))

    fireEvent.click(screen.getByRole('tab', { name: 'محصولات' }))
    fireEvent.click(await screen.findByRole('button', { name: /جزئیات محصول هدفون بی‌سیم/ }))
    expect(await screen.findByText(/XM5-BLK/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ویرایش محصول' })).not.toBeInTheDocument()
  }, 20000)

  it('shows read-only accounting dashboard, document details and financial report', async () => {
    render(<App />)
    fireEvent.click(screen.getAllByLabelText('مدیریت حساب')[0]!)
    fireEvent.click(await screen.findByRole('button', { name: 'اتصال به مدیریت حساب' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'حسابداری' }))
    expect(await screen.findByText('مبلغ قابل دریافت')).toBeInTheDocument()
    expect(screen.getByText('مانده فعلی')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'اسناد' }))
    fireEvent.change(screen.getByLabelText('از تاریخ'), { target: { value: '2026-11-24' } })
    fireEvent.change(screen.getByLabelText('تا تاریخ'), { target: { value: '2026-11-24' } })
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'جزئیات سند PAY-2026-0311' }),
      ).not.toBeInTheDocument(),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'جزئیات سند INV-2026-1108' }))
    expect(await screen.findByRole('button', { name: 'بازگشت به حسابداری' })).toBeInTheDocument()
    expect(screen.getByText('فاکتور فروش سفارش TK-1008')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ویرایش سند' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'بازگشت به حسابداری' }))

    fireEvent.click(screen.getByRole('tab', { name: 'گزارش' }))
    expect(
      await screen.findByRole('table', { name: 'گزارش تجمیعی اسناد مالی' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'فاکتور فروش' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تراکنش INV-2026-1108' })).toBeInTheDocument()
  }, 20000)

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
