import { dataAccessor, refreshActiveData } from './dataAccessor.js'

let currentRun
let savedOptions = {}

/**
 * Browser-only cache updater; never writes CSV or Supabase.
 * Refresh immediately, then every 60 seconds. Returns { ready, stop }.
 * Calling again refreshes now and resets the timer; it never adds a second timer.
 * Await ready to handle initial errors. Later errors go to onError.
 */
export function periodicUpdate(options = savedOptions) {
  currentRun?.stop()
  savedOptions = options
  const { accessor = { refresh: refreshActiveData }, onError = error => console.error('Data update failed:', error) } = options
  const ready = accessor.refresh()
  const timer = setInterval(() => {
    accessor.refresh().catch(onError)
  }, 60000)
  const run = { ready, stop: () => clearInterval(timer) }
  currentRun = run
  return run
}

/** Read the last committed timestamp from IndexedDB, including after a reload. */
export function displayLastUpdated(accessor = dataAccessor) {
  return accessor.displayLastUpdated()
}

export const stopPeriodicUpdate = () => currentRun?.stop()
