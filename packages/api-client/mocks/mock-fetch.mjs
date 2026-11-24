import { createMockApi, MockApiError } from './mock-api.mjs'

function toQueryObject(url) {
  return Object.fromEntries(url.searchParams.entries())
}

async function parseBody(init) {
  if (!init.body) return {}
  if (typeof init.body === 'string') {
    try {
      return JSON.parse(init.body)
    } catch {
      return {}
    }
  }
  if (init.body instanceof URLSearchParams) return Object.fromEntries(init.body.entries())
  if (init.body instanceof FormData) return Object.fromEntries(init.body.entries())
  if (typeof init.body === 'object') return init.body
  return {}
}

export function createMockFetch(options = {}) {
  const api = options.api || createMockApi(options.data)

  return async function mockFetch(input, init = {}) {
    const url = new URL(
      typeof input === 'string' ? input : input.url,
      'https://mock.superapp.local',
    )
    const method = String(
      init.method || (typeof input === 'object' && input.method) || 'GET',
    ).toUpperCase()
    const headers = new Headers(
      init.headers || (typeof input === 'object' ? input.headers : undefined),
    )
    const body = await parseBody(init)

    try {
      const result = await api.request(method, url.pathname, {
        body,
        query: toQueryObject(url),
        headers,
      })
      return new Response(JSON.stringify(result), {
        status: result.httpStatus || 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Mock network error') {
        throw error
      }
      if (error instanceof MockApiError) {
        return new Response(JSON.stringify(error.toJSON()), {
          status: error.status,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...(error.status === 429 ? { 'Retry-After': '5' } : {}),
          },
        })
      }
      throw error
    }
  }
}
