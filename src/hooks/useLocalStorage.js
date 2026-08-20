import { useCallback, useEffect, useState } from 'react'

/**
 * State mirrored into localStorage, with a same-origin `storage` listener so
 * two open tabs stay in sync (a real thing shoppers do while comparing).
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* quota or private mode — the app still works, it just will not persist */
    }
  }, [key, value])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== key || e.newValue == null) return
      try {
        setValue(JSON.parse(e.newValue))
      } catch {
        /* ignore malformed payloads from other tabs */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  const reset = useCallback(() => setValue(initialValue), [initialValue])

  return [value, setValue, reset]
}
