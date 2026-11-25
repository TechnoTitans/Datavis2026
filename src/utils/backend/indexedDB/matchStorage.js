/** Atomic snapshots: rows and their successful refresh timestamp commit together. */
export function createIndexedDBStorage(databaseName = 'datavis_match_accessor') {
  const transact = (key, snapshot, signal) => new Promise((resolve, reject) => {
    let db, transaction, result, finished = false
    const finish = error => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      db?.close()
      if (error) reject(error)
      else resolve(result)
    }
    const abort = () => {
      try { transaction?.abort() } catch { /* Already completed. */ }
      finish(new Error('IndexedDB operation cancelled or timed out'))
    }
    const timer = setTimeout(abort, 10000)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) return abort()
    try {
      if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable in this browser')
      const request = globalThis.indexedDB.open(databaseName, 1)
      request.onupgradeneeded = () => {
        if (finished) request.transaction.abort()
        else request.result.createObjectStore('snapshots')
      }
      request.onerror = () => finish(request.error)
      request.onblocked = () => finish(new Error('IndexedDB is blocked by another tab'))
      request.onsuccess = () => {
        db = request.result
        if (finished) { db.close(); return }
        db.onversionchange = () => db.close()
        try {
          transaction = db.transaction('snapshots', snapshot === undefined ? 'readonly' : 'readwrite')
          transaction.oncomplete = () => finish()
          transaction.onabort = transaction.onerror = () => finish(transaction.error || new Error('IndexedDB transaction failed'))
          const store = transaction.objectStore('snapshots')
          const operation = snapshot === undefined ? store.get(key) : store.put(snapshot, key)
          operation.onsuccess = () => { result = operation.result }
        } catch (error) { finish(error) }
      }
    } catch (error) { finish(error) }
  })
  return {
    load: (key, signal) => transact(key, undefined, signal),
    save: (key, snapshot, signal) => transact(key, snapshot, signal),
  }
}


/** Read any scan history already archived by earlier versions; never migrate or upload it. */
export async function readScanArchive() {
  const key = `${import.meta.env.VITE_SUPABASE_URL || 'default'}:legacy-migration:archive`
  return (await createIndexedDBStorage().load(key))?.rows || []
}
