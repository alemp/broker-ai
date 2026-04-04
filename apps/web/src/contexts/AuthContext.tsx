import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import {
  apiFetch,
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from '@/lib/api'

export type OrganizationBrief = {
  id: string
  name: string
  slug: string
}

export type AuthUser = {
  id: string
  email: string
  full_name: string | null
  organization: OrganizationBrief
}

type AuthState = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; password: string; full_name?: string }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

type MeResponse = {
  user: AuthUser
}

type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getStoredAccessToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await apiFetch<MeResponse>('/v1/me')
      setUser(me.user)
    } catch {
      clearStoredAccessToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const body = await apiFetch<TokenResponse>('/v1/auth/login', {
      method: 'POST',
      json: { email, password },
      skipAuth: true,
    })
    setStoredAccessToken(body.access_token)
    await refreshUser()
  }, [refreshUser])

  const register = useCallback(
    async (input: { email: string; password: string; full_name?: string }) => {
      const body = await apiFetch<TokenResponse>('/v1/auth/register', {
        method: 'POST',
        json: input,
        skipAuth: true,
      })
      setStoredAccessToken(body.access_token)
      await refreshUser()
    },
    [refreshUser],
  )

  const logout = useCallback(() => {
    clearStoredAccessToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
