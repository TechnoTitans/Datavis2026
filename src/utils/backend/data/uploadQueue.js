import { refreshTable } from './dataAccessor.js'

import { notifyData } from './dataEvents.js'
import { createScanStorage } from '../indexedDB/scanStorage.js'
export { createScanStorage } from '../indexedDB/scanStorage.js'

/**
 * Persist prepared scan records and administrative edits before sending them.
 * Scans enter unconfirmed_data; explicit approval moves them to match_data.
 * No season field list, QR format, or scoring schema is imported here.
 * No uploads or timers until explicitly started; no UI events or legacy migration.
 * Use a distinct scope for each project/user if supplying a custom client.
 * listScans() returns queue entries containing row, attempts, and lastError.
 */
export function createUploader({
  client, storage = createScanStorage(),
  scope = `${import.meta.env?.VITE_SUPABASE_URL || 'default'}:anonymous`,
  isOnline = () => globalThis.navigator?.onLine !== false,
} = {}) {
  if (typeof scope !== 'string' || !scope) throw new Error('A nonempty queue scope is required')
  let flight, currentRun
  let savedOptions = {}
  const listPending = () => storage.list(scope)
  const listScans = async () => (await listPending()).filter(entry => !entry.type || entry.type === 'scan')
  const saveScan = async input => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Provide a prepared record object')
    }
    const row = Object.fromEntries(Object.entries(input).filter(([key]) => !key.startsWith('_')))
    const scoutingId = row['Scouting ID']
    if (typeof scoutingId !== 'string' || !scoutingId.trim()) throw new Error('Scouting ID is required')
    const now = new Date().toISOString()
    const entry = await storage.save({ scope, scoutingId, row, revision: globalThis.crypto.randomUUID(),
      createdAt: now, updatedAt: now, attempts: 0, lastError: null })
    notifyData('pending')
    return entry
  }
  const saveMutation = async (type, payload) => {
    if (!['updateMatchUseData', 'approveUnconfirmedData', 'rejectUnconfirmedData'].includes(type)) throw new Error('Unsupported mutation')
    const id = payload.scoutingId || payload.unconfirmedItem?.['Scouting ID']
    if (!id) throw new Error('Scouting ID is required')
    const now = new Date().toISOString()
    const entry = await storage.save({ scope, scoutingId: `${type}:${id}`, type, payload,
      revision: globalThis.crypto.randomUUID(), createdAt: now, updatedAt: now, attempts: 0, lastError: null })
    notifyData('pending')
    return entry
  }
  const uploadPending = () => {
    if (flight) return flight
    flight = (async () => {
      const result = { uploaded: 0, remaining: 0, errors: [], skipped: null }
      const skipReason = () => !isOnline() ? 'offline' : null
      result.skipped = skipReason()
      if (!result.skipped) {
        const entries = await listPending()
        if (entries.length) {
          const source = client ?? (await import('./supabaseClient.js')).supabase
          if (!source) result.skipped = 'supabaseNotConfigured'
          else for (const entry of entries) {
            result.skipped = skipReason()
            if (result.skipped) break
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 30000)
            let failure = null
            try {
              if (entry.type && entry.type !== 'scan') {
                const { scoutingId, value, unconfirmedItem } = entry.payload
                let response
                if (entry.type === 'updateMatchUseData') {
                  response = await source.from('match_data').update({ 'Use Data': value }).eq('Scouting ID', scoutingId).abortSignal(controller.signal)
                } else if (entry.type === 'approveUnconfirmedData') {
                  response = await source.from('match_data').upsert(unconfirmedItem, { onConflict: 'Scouting ID' }).abortSignal(controller.signal)
                  if (response.error) throw response.error
                  response = await source.from('unconfirmed_data').delete().eq('Scouting ID', unconfirmedItem['Scouting ID']).abortSignal(controller.signal)
                } else {
                  response = await source.from('unconfirmed_data').delete().eq('Scouting ID', scoutingId).abortSignal(controller.signal)
                }
                if (response.error) throw response.error
              } else {
                const response = await source.from('unconfirmed_data').insert([entry.row]).abortSignal(controller.signal)
                if (response.error?.code === '23505') {
                  // A previous request may have committed before losing its response.
                  // Only acknowledge a duplicate if the stored payload actually matches.
                  const existing = await source.from('unconfirmed_data').select('*')
                    .eq('Scouting ID', entry.scoutingId).single().abortSignal(controller.signal)
                  if (existing.error) throw existing.error
                  if (!existing.data || !Object.entries(entry.row).every(([key, value]) =>
                    JSON.stringify(existing.data[key]) === JSON.stringify(value))) {
                    throw new Error('A different scan with this Scouting ID already exists in unconfirmed_data')
                  }
                } else if (response.error) throw response.error
              }
            } catch (error) {
              failure = error?.message || String(error)
            } finally { clearTimeout(timeout) }
            const settled = await storage.settle(entry, failure)
            notifyData('pending')
            if (failure) result.errors.push({ scoutingId: entry.scoutingId, message: failure })
            else if (settled) result.uploaded++
          }
        }
      }
      result.remaining = (await listPending()).length
      if (result.uploaded) await Promise.allSettled([refreshTable('match_data'), refreshTable('unconfirmed_data')])
      return result
    })().finally(() => { flight = undefined })
    return flight
  }
  /**
   * Upload immediately, then retry pending scans every 30 seconds.
   * Returns { ready, stop }, like periodicUpdate. Await ready for initial results.
   * Repeated calls reset the timer; an ongoing upload is shared, never overlapped.
   * stop() prevents future ticks but lets any current upload finish safely.
   * Per-row failures remain in IndexedDB; onError handles whole-run failures.
   */
  const periodicUpload = (options = savedOptions) => {
    currentRun?.stop()
    savedOptions = options
    const { onError = error => console.error('Pending upload failed:', error) } = options
    const ready = uploadPending()
    const timer = setInterval(() => {
      return uploadPending().catch(onError)
    }, 30000)
    const run = { ready, stop: () => clearInterval(timer) }
    currentRun = run
    return run
  }
  return { saveScan, saveMutation, listScans, listPending, uploadPending, periodicUpload, stopPeriodicUpload: () => currentRun?.stop() }
}

export const uploader = createUploader()
export const saveScan = input => uploader.saveScan(input)
export const listScans = () => uploader.listScans()
export const uploadPending = () => uploader.uploadPending()
export const periodicUpload = options => uploader.periodicUpload(options)
export const stopPeriodicUpload = () => uploader.stopPeriodicUpload()

export const listPending = () => uploader.listPending()
export const saveMutation = (type, payload) => uploader.saveMutation(type, payload)

async function submit(entry) {
  await uploadPending()
  const pending = (await listPending()).find(item => item.scoutingId === entry.scoutingId)
  return { queued: Boolean(pending), lastError: pending?.lastError }
}
export const insertUnconfirmedData = async row => submit(await saveScan(row))
export const updateMatchUseData = async payload => submit(await saveMutation('updateMatchUseData', payload))
export const approveUnconfirmedData = async unconfirmedItem => submit(await saveMutation('approveUnconfirmedData', { unconfirmedItem }))
export const rejectUnconfirmedData = async scoutingId => submit(await saveMutation('rejectUnconfirmedData', { scoutingId }))
