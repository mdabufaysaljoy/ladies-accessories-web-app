import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { adminApi, api, setToken } from '@/lib/api'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await adminApi.get('/auth/me')
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await adminApi.post('/auth/logout')
    } catch {
      /* clearing locally is what matters */
    }
    setToken(null)
    setUser(null)
  }, [])

  const can = useCallback(
    (ability) => {
      if (!user) return false
      return user.abilities?.includes('*') || user.abilities?.includes(ability)
    },
    [user],
  )

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, can }),
    [user, loading, login, logout, refresh, can],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>')
  return ctx
}
