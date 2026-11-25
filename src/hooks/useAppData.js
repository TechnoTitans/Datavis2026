// React subscriptions and app-wide sync lifecycle. Storage and transport stay in backend utilities.
import { useCallback, useEffect, useState } from 'react'
import { readTable, refreshTable, subscribeData } from '../utils/backend/data/dataAccessor.js'
import { uploader } from '../utils/backend/data/uploadQueue.js'
import { periodicUpdate, stopPeriodicUpdate } from '../utils/backend/data/dataSync.js'

export function useDataTable(table, enabled = true) {
  const [state, setState] = useState({ rows: [], loading: true, error: null })
  useEffect(() => {
    if (!enabled) { setState({ rows: [], loading: false, error: null }); return }
    let active = true, request = 0
    const load = async () => {
      const id = ++request
      try {
        const rows = await readTable(table)
        if (active && id === request) setState({ rows, loading: false, error: null })
      } catch (error) {
        if (active && id === request) setState({ rows: [], loading: false, error: error.message })
      }
    }
    setState({ rows: [], loading: true, error: null })
    const unsubscribe = subscribeData(key => { if (key === '*' || key === table) void load() })
    void load()
    return () => { active = false; unsubscribe() }
  }, [table, enabled])
  const reload = useCallback(() => refreshTable(table), [table])
  return { ...state, reload }
}

// Mounted once in the layout: one refresh timer and one retry timer for all pages.
export function useDataSync() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {

      const run = uploader.periodicUpload({ onError: error => setError(error.message) })
      const result = await run.ready
      setError(result.errors.length ? `${result.errors.length} upload(s) remain pending: ${result.errors[0].message}` : null)
    } catch (error) { setError(error.message) }
    finally { setSyncing(false) }
  }, [])
  useEffect(() => {
    let active = true
    setError(null)
    const report = error => { if (active) setError(error.message) }
    const count = () => uploader.listPending().then(entries => {
      if (active) setPendingCount(entries.length)
    }).catch(report)
    const start = async () => {
      try {

        if (!active) return
        const updateRun = periodicUpdate({ onError: report })
        const uploadRun = uploader.periodicUpload({ onError: report })
        updateRun.ready.catch(report)
        uploadRun.ready.catch(report)
        await count()
      } catch (error) { report(error) }
    }
    const unsubscribe = subscribeData(key => { if (key === 'pending') void count() })
    const online = () => { setIsOnline(true); void start() }
    const offline = () => setIsOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    void start()
    return () => {
      active = false; stopPeriodicUpdate(); uploader.stopPeriodicUpload(); unsubscribe()
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])
  return { isOnline, pendingCount, syncing, syncNow, error }
}
