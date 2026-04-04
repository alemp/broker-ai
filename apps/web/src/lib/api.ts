const TOKEN_KEY = 'ai_copilot_access_token'

export function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL
  return typeof base === 'string' && base.length > 0 ? base.replace(/\/$/, '') : 'http://localhost:8000'
}

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredAccessToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function parseJsonSafe(text: string): unknown {
  if (text.length === 0) {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { detail: text }
  }
}

function formatErrorDetail(data: unknown): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }
    return JSON.stringify(detail)
  }
  return 'Request failed'
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown; skipAuth?: boolean } = {},
): Promise<T> {
  const { json, skipAuth, headers, ...rest } = init
  const requestHeaders = new Headers(headers)
  if (json !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
  }
  if (!skipAuth) {
    const token = getStoredAccessToken()
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`)
    }
  }
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: requestHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const text = await response.text()
  const data = parseJsonSafe(text)
  if (!response.ok) {
    throw new Error(formatErrorDetail(data) || `Request failed (${response.status})`)
  }
  return data as T
}
