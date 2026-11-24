import type { AuthAdapter, AuthError, ServiceId, ServiceSession } from './types'

export class AuthAdapterError extends Error {
  readonly code: AuthError['code']
  readonly status?: number

  constructor(code: AuthError['code'], message: string, status?: number) {
    super(message)
    this.name = 'AuthAdapterError'
    this.code = code
    this.status = status
  }
}

const permissions: Record<ServiceId, string[]> = {
  messaging: ['chat.read', 'chat.write', 'chat.assign', 'chat.escalate'],
  account: ['shop.read', 'accounting.read', 'account.settings.read'],
}

function createSession(service: ServiceId, operatorId: string, projectId: string): ServiceSession {
  const timestamp = Date.now()
  return {
    accessToken: `mock_${service}_access_${operatorId}_${timestamp}`,
    refreshToken: `mock_${service}_refresh_${operatorId}_${timestamp}`,
    expiresAt: timestamp + 15 * 60 * 1000,
    service,
    context: { operatorId, projectId, permissions: permissions[service] },
  }
}

export function createMockAuthAdapter(): AuthAdapter {
  return {
    async connect(service, credentials) {
      if (!credentials.operator_id || !credentials.project_id || !credentials.access_code) {
        throw new AuthAdapterError('UNAUTHENTICATED', 'اطلاعات اتصال ناقص است.', 401)
      }
      if (credentials.access_code !== 'demo') {
        throw new AuthAdapterError('UNAUTHENTICATED', 'رمز دسترسی Mock معتبر نیست.', 401)
      }
      return createSession(service, credentials.operator_id, credentials.project_id)
    },

    async refresh(service, session) {
      if (
        session.service !== service ||
        !session.refreshToken.startsWith(`mock_${service}_refresh_`)
      ) {
        throw new AuthAdapterError('UNAUTHENTICATED', 'Refresh Token معتبر نیست.', 401)
      }
      return createSession(service, session.context.operatorId, session.context.projectId)
    },

    validate(service, session) {
      return (
        session.service === service &&
        session.accessToken.startsWith(`mock_${service}_access_`) &&
        session.expiresAt > Date.now()
      )
    },

    async logout() {
      // Mock logout has no server-side side effect.
    },

    async expire(service, session) {
      return { ...session, service, expiresAt: Date.now() - 1000 }
    },
  }
}
