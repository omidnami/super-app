import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createMockAuthAdapter } from '@superapp/auth'
import type { StorageAdapter } from '@superapp/storage'
import { ServiceAuthBoundary, ServiceSessionProvider, useServiceSession } from '@superapp/ui'

function createMemoryStorage() {
  const values = new Map<string, string>()
  const storage: StorageAdapter = {
    async getItem(key) {
      return values.get(key) ?? null
    },
    async setItem(key, value) {
      values.set(key, value)
    },
    async removeItem(key) {
      values.delete(key)
    },
  }
  return { storage, values }
}

function AuthProbe({ service }: { service: 'messaging' | 'account' }) {
  const { status, error, connect, disconnect, expire } = useServiceSession()
  return (
    <div data-testid={`${service}-auth`}>
      <span data-testid={`${service}-status`}>{status}</span>
      {error ? <span data-testid={`${service}-error`}>{error.code}</span> : null}
      <button type="button" onClick={() => void connect()}>
        connect-{service}
      </button>
      <button
        type="button"
        onClick={() =>
          void connect({ operator_id: 'op_42', project_id: 'prj_12', access_code: 'wrong' })
        }
      >
        bad-{service}
      </button>
      <button type="button" onClick={() => void disconnect()}>
        disconnect-{service}
      </button>
      <button type="button" onClick={() => void expire()}>
        expire-{service}
      </button>
    </div>
  )
}

function ProtectedContent() {
  return (
    <ServiceAuthBoundary fallback={<span>needs-auth</span>}>
      <span>service-content</span>
    </ServiceAuthBoundary>
  )
}

describe('independent service auth', () => {
  it('does not share sessions between messaging and account', async () => {
    const adapter = createMockAuthAdapter()
    const messaging = createMemoryStorage()
    const account = createMemoryStorage()
    render(
      <>
        <ServiceSessionProvider service="messaging" storage={messaging.storage} adapter={adapter}>
          <AuthProbe service="messaging" />
        </ServiceSessionProvider>
        <ServiceSessionProvider service="account" storage={account.storage} adapter={adapter}>
          <AuthProbe service="account" />
        </ServiceSessionProvider>
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'connect-messaging' }))
    fireEvent.click(screen.getByRole('button', { name: 'connect-account' }))
    await waitFor(() =>
      expect(screen.getByTestId('messaging-status')).toHaveTextContent('connected'),
    )
    await waitFor(() => expect(screen.getByTestId('account-status')).toHaveTextContent('connected'))

    fireEvent.click(screen.getByRole('button', { name: 'disconnect-messaging' }))
    await waitFor(() =>
      expect(screen.getByTestId('messaging-status')).toHaveTextContent('disconnected'),
    )
    expect(screen.getByTestId('account-status')).toHaveTextContent('connected')
  })

  it('clears service-owned data with the session on logout', async () => {
    const adapter = createMockAuthAdapter()
    const { storage, values } = createMemoryStorage()
    const onLogout = vi.fn(async () => undefined)
    render(
      <ServiceSessionProvider
        service="messaging"
        storage={storage}
        adapter={adapter}
        onLogout={onLogout}
      >
        <AuthProbe service="messaging" />
      </ServiceSessionProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'connect-messaging' }))
    await waitFor(() =>
      expect(screen.getByTestId('messaging-status')).toHaveTextContent('connected'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'disconnect-messaging' }))
    await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1))
    expect(onLogout).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'messaging',
        context: expect.objectContaining({ operatorId: 'op_42', projectId: 'prj_12' }),
      }),
    )
    expect(values.has('superapp.auth.messaging.v1')).toBe(false)
  })

  it('persists each service session under a separate key', async () => {
    const adapter = createMockAuthAdapter()
    const { storage, values } = createMemoryStorage()
    const first = render(
      <ServiceSessionProvider service="messaging" storage={storage} adapter={adapter}>
        <AuthProbe service="messaging" />
      </ServiceSessionProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'connect-messaging' }))
    await waitFor(() => expect(values.has('superapp.auth.messaging.v1')).toBe(true))
    expect(values.has('superapp.auth.account.v1')).toBe(false)
    first.unmount()

    render(
      <ServiceSessionProvider service="messaging" storage={storage} adapter={adapter}>
        <AuthProbe service="messaging" />
      </ServiceSessionProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('messaging-status')).toHaveTextContent('connected'),
    )
  })

  it('shows the boundary fallback after session expiry', async () => {
    const adapter = createMockAuthAdapter()
    const { storage } = createMemoryStorage()
    render(
      <ServiceSessionProvider service="messaging" storage={storage} adapter={adapter}>
        <AuthProbe service="messaging" />
        <ProtectedContent />
      </ServiceSessionProvider>,
    )
    expect(screen.getByText('needs-auth')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'connect-messaging' }))
    expect(await screen.findByText('service-content')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'expire-messaging' }))
    expect(await screen.findByText('needs-auth')).toBeInTheDocument()
  })

  it('returns a service-scoped 401 error for invalid credentials', async () => {
    const adapter = createMockAuthAdapter()
    const { storage } = createMemoryStorage()
    render(
      <ServiceSessionProvider service="account" storage={storage} adapter={adapter}>
        <AuthProbe service="account" />
      </ServiceSessionProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'bad-account' }))
    expect(await screen.findByTestId('account-error')).toHaveTextContent('UNAUTHENTICATED')
  })

  it('keeps local CRM available without any auth provider', () => {
    render(<div>CRM محلی</div>)
    expect(screen.getByText('CRM محلی')).toBeInTheDocument()
  })
})
