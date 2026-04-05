import { useEffect, useState } from 'react'

export type ListViewMode = 'table' | 'cards'

function readStoredViewMode(storageKey: string): ListViewMode {
  try {
    const v = localStorage.getItem(storageKey)
    return v === 'cards' ? 'cards' : 'table'
  } catch {
    return 'table'
  }
}

/** Persists table vs cards choice for CRM list pages. */
export function usePersistedListViewMode(storageKey: string): [ListViewMode, (mode: ListViewMode) => void] {
  const [viewMode, setViewMode] = useState<ListViewMode>(() => readStoredViewMode(storageKey))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, viewMode)
    } catch {
      /* ignore quota / private mode */
    }
  }, [storageKey, viewMode])

  return [viewMode, setViewMode]
}
