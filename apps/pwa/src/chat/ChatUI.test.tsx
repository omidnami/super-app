import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MessageComposer } from '@superapp/ui/web'
import { AppThemeProvider } from '../theme/AppThemeProvider'

describe('MessageComposer', () => {
  it('disables empty, offline and oversized sends', () => {
    const { rerender } = render(
      <AppThemeProvider>
        <MessageComposer
          value=""
          onChangeText={vi.fn()}
          onSend={vi.fn()}
          disabled={false}
          sending={false}
        />
      </AppThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeDisabled()

    rerender(
      <AppThemeProvider>
        <MessageComposer
          value="سلام"
          onChangeText={vi.fn()}
          onSend={vi.fn()}
          disabled
          sending={false}
        />
      </AppThemeProvider>,
    )
    expect(screen.getByLabelText('متن پیام')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeDisabled()

    rerender(
      <AppThemeProvider>
        <MessageComposer
          value={'a'.repeat(4001)}
          onChangeText={vi.fn()}
          onSend={vi.fn()}
          disabled={false}
          sending={false}
        />
      </AppThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeDisabled()
    expect(screen.getByText('حداکثر ۴۰۰۰ کاراکتر مجاز است.')).toBeInTheDocument()
  })

  it('appends an emoji through the accessible emoji picker', () => {
    const onChangeText = vi.fn()
    render(
      <AppThemeProvider>
        <MessageComposer
          value="سلام"
          onChangeText={onChangeText}
          onSend={vi.fn()}
          disabled={false}
          sending={false}
        />
      </AppThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'افزودن ایموجی' }))
    fireEvent.click(screen.getByRole('button', { name: 'ایموجی 👍' }))

    expect(onChangeText).toHaveBeenCalledWith('سلام👍')
  })
})
