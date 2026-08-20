import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'

const AccountContext = createContext(null)

const TOKEN_KEY = 'gbs.account.token'

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

const writeToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode — session lasts until reload */
  }
}

/**
 * Optional customer accounts. Signing in is never required to order; it only
 * pre-fills the checkout and unlocks order history.
 */
export function AccountProvider({ children }) {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!readToken()) {
      setLoading(false)
      return
    }
    try {
      const { customer: me } = await request('/account/me')
      setCustomer(me)
    } catch {
      writeToken(null)
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (phone, password) => {
    const data = await api.post('/account/login', { phone, password })
    writeToken(data.token)
    setCustomer(data.customer)
    return data.customer
  }, [])

  const register = useCallback(async (payload) => {
    const data = await api.post('/account/register', payload)
    writeToken(data.token)
    setCustomer(data.customer)
    return data.customer
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/account/logout')
    } catch {
      /* clearing locally is what matters */
    }
    writeToken(null)
    setCustomer(null)
  }, [])

  const updateProfile = useCallback(async (patch) => {
    const { customer: updated } = await request('/account/me', { method: 'PATCH', body: patch })
    setCustomer(updated)
    return updated
  }, [])

  const addAddress = useCallback(async (address) => {
    const { customer: updated } = await request('/account/addresses', { method: 'POST', body: address })
    setCustomer(updated)
    return updated
  }, [])

  const updateAddress = useCallback(async (id, patch) => {
    const { customer: updated } = await request(`/account/addresses/${id}`, { method: 'PATCH', body: patch })
    setCustomer(updated)
    return updated
  }, [])

  const removeAddress = useCallback(async (id) => {
    const { customer: updated } = await request(`/account/addresses/${id}`, { method: 'DELETE' })
    setCustomer(updated)
    return updated
  }, [])

  const defaultAddress = useMemo(
    () => customer?.addresses?.find((a) => a.isDefault) ?? customer?.addresses?.[0] ?? null,
    [customer],
  )

  const value = useMemo(
    () => ({
      customer,
      loading,
      isSignedIn: Boolean(customer),
      defaultAddress,
      login,
      register,
      logout,
      refresh,
      updateProfile,
      addAddress,
      updateAddress,
      removeAddress,
      request,
    }),
    [customer, loading, defaultAddress, login, register, logout, refresh, updateProfile, addAddress, updateAddress, removeAddress],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

/**
 * Standalone so it can be used outside the provider (e.g. by pages that fetch
 * account-scoped data directly). Always sends the customer token, never the
 * admin one.
 */
export async function request(path, { method = 'GET', body } = {}) {
  const token = readToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>')
  return ctx
}
