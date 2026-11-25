import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Attachment } from '@superapp/chat-contracts'
import type { ConversationApi } from '@superapp/api-client'
import { AttachmentPicker, FileBubble, UploadProgress } from '@superapp/ui/web'
import { AppThemeProvider } from '../theme/AppThemeProvider'

const attachment: Attachment = {
  id: 'att_1',
  provider: 'planet',
  type: 'photo',
  file_name: 'photo.png',
  mime_type: 'image/png',
  file_size: 1024,
  duration: null,
  url: null,
  created_at: '2026-11-25T10:00:00.000Z',
}

describe('media UI', () => {
  it('maps a picked file to validated media metadata', () => {
    const onSelect = vi.fn()
    render(
      <AppThemeProvider>
        <AttachmentPicker onSelect={onSelect} />
      </AppThemeProvider>,
    )

    fireEvent.change(screen.getByLabelText('انتخاب فایل'), {
      target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] },
    })

    expect(onSelect).toHaveBeenCalledWith({
      uri: '',
      name: 'photo.png',
      mimeType: 'image/png',
      size: 5,
      type: 'photo',
      blob: expect.any(File),
    })
  })

  it('does not request attachment content while offline', () => {
    const getAttachmentContent = vi.fn()
    const api = {
      media: { getAttachmentContent },
    } as unknown as ConversationApi
    render(
      <AppThemeProvider>
        <FileBubble attachment={attachment} api={api} conversationId="conv_1" isOnline={false} />
      </AppThemeProvider>,
    )

    expect(screen.getByText('نیاز به اینترنت')).toBeInTheDocument()
    expect(getAttachmentContent).not.toHaveBeenCalled()
  })

  it('exposes cancel and retry actions for upload states', () => {
    const onCancel = vi.fn()
    const onRetry = vi.fn()
    const { rerender } = render(
      <AppThemeProvider>
        <UploadProgress status="uploading" progress={45} onCancel={onCancel} />
      </AppThemeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'لغو ارسال' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    rerender(
      <AppThemeProvider>
        <UploadProgress status="error" progress={0} error="خطای آپلود" onRetry={onRetry} />
      </AppThemeProvider>,
    )
    expect(screen.getByText('خطای آپلود')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
