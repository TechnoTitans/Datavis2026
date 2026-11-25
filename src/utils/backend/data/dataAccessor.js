import { createIndexedDBStorage } from '../indexedDB/matchStorage.js'
import { notifyData } from './dataEvents.js'
export { createIndexedDBStorage } from '../indexedDB/matchStorage.js'
export { subscribeData } from './dataEvents.js'

const project = import.meta.env?.VITE_SUPABASE_URL || 'default'
const tables = new Map()
const resources = new Map()
const resourceStorage = createIndexedDBStorage()
/** Atomic, persistent, cache-first table access. Failed refreshes retain the last snapshot. */
export function createDataAccessor({
  client, table = 'match_data',
  cacheKey = `${project}:${table}:anonymous`, storage = createIndexedDBStorage(),
} = {}) {
  let flight
  const refresh = () => {
    if (flight) return flight
    const active = new AbortController()
    const timeout = setTimeout(() => active.abort(), 30000)
    flight = (async () => {
      const source = client ?? (await import('./supabaseClient.js')).supabase
      if (!source) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY.')
      // Discover an ordering supported by the actual table, including optional official tables.
      const sample = await source.from(table).select('*').limit(1).abortSignal(active.signal)
      if (sample.error) throw sample.error
      const first = sample.data?.[0]
      const columns = first ? Object.keys(first) : []
      const unique = ['Scouting ID', 'id', 'key', 'match_key'].find(key => columns.includes(key))
      const order = unique ? [unique] : columns.filter(key => first[key] == null || typeof first[key] !== 'object')
      const rows = []
      let total
      do {
        if (active.signal.aborted) throw new Error('Refresh cancelled')
        let query = source.from(table).select('*', { count: 'exact' })
        for (const column of order) query = query.order(column)
        const { data, error, count } = await query.range(rows.length, rows.length + 999).abortSignal(active.signal)
        if (error) throw error
        if (!Array.isArray(data) || !Number.isInteger(count) || count < 0 ||
            (total !== undefined && total !== count)) throw new Error('Invalid or changing dataset count')
        total = count
        rows.push(...data)
        if (rows.length > total || (!data.length && rows.length < total)) throw new Error('Incomplete Supabase response')
      } while (rows.length < total)
      if (active.signal.aborted) throw new Error('Refresh cancelled')
      await storage.save(cacheKey, { rows, updatedAt: new Date().toISOString() }, active.signal)
      notifyData(table)
      return rows
    })().finally(() => {
      clearTimeout(timeout)
      flight = undefined
    })
    return flight
  }
  return {
    async pullAllRows() {
      const snapshot = await storage.load(cacheKey)
      if (snapshot !== undefined) {
        if (!Array.isArray(snapshot.rows)) throw new Error('Invalid cached dataset')
        return snapshot.rows
      }
      return refresh()
    },
    refresh,
    async displayLastUpdated() {
      const snapshot = await storage.load(cacheKey)
      return snapshot ? `Last updated: ${snapshot.updatedAt}` : 'Not updated yet'
    },
  }
}
export function getTableAccessor(table = 'match_data') {
  if (!/^[a-z_]+$/.test(table)) throw new Error('Invalid dataset name')
  if (!tables.has(table)) tables.set(table, createDataAccessor({ table }))
  return tables.get(table)
}
export const dataAccessor = getTableAccessor()
export const pullAllRows = () => dataAccessor.pullAllRows()
export const readTable = table => getTableAccessor(table).pullAllRows()
export const refreshTable = table => getTableAccessor(table).refresh()
/** Non-table resources (picklist boards and TBA lookups) share the same cache lifecycle. */
export async function readResource(key, loader, { refresh = false } = {}) {
  const cacheKey = `${project}:resource:${key}`
  let resource = resources.get(key)
  if (!resource) { resource = { loader, flight: null }; resources.set(key, resource) }
  resource.loader = loader
  if (!refresh) {
    const snapshot = await resourceStorage.load(cacheKey)
    if (snapshot !== undefined) return snapshot.value
  }
  if (resource.flight) return resource.flight
  resource.flight = (async () => {
    const value = await loader()
    await resourceStorage.save(cacheKey, { value, updatedAt: new Date().toISOString() })
    notifyData(`resource:${key}`)
    return value
  })().finally(() => { resource.flight = null })
  return resource.flight
}
export async function refreshActiveData() {
  const results = await Promise.allSettled([
    ...[...tables.values()].map(accessor => accessor.refresh()),
    ...[...resources.entries()].map(([key, resource]) => readResource(key, resource.loader, { refresh: true })),
  ])
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
  if (errors.length) throw new Error(errors.map(error => error.message).join('; '))
}
