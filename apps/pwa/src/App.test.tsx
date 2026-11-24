import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

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
