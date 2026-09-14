import { useCallback, useEffect, useRef, useState } from 'react'
import { flushOfflineQueue } from '../utils/offlineProcessor'
import { getPendingOpsCount } from '../utils/offlineQueue'
import { supabaseConfigured } from '../supabaseClient'

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState(null)
  const syncingRef = useRef(false)

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingOpsCount()
      setPendingCount(count)
    } catch {
      setPendingCount(0)
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return
    if (!supabaseConfigured) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLastSyncResult({ synced: 0, stoppedOnNetwork: true })
      return
    }
    syncingRef.current = true
    setSyncing(true)
    try {
      const result = await flushOfflineQueue()
      setLastSyncResult(result)
    } finally {
      syncingRef.current = false
      setSyncing(false)
      refreshPendingCount()
    }
  }, [refreshPendingCount])

  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount])

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncNow()
    }
  }, [syncNow])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncNow()
    }
    const handleOffline = () => setIsOnline(false)
    const handleQueueChanged = () => refreshPendingCount()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('offline-queue-changed', handleQueueChanged)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('offline-queue-changed', handleQueueChanged)
    }
  }, [refreshPendingCount, syncNow])

  return { isOnline, pendingCount, syncing, lastSyncResult, syncNow, refreshPendingCount }
}
