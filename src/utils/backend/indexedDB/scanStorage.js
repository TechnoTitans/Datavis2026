const STORE = 'scanned_unuploaded'

/** Separate from match snapshots and the existing offline_ops queue. */
export function createScanStorage(databaseName = 'datavis_scanned_uploads') {
  const run = (mode, action) => new Promise((resolve, reject) => {
    let db, tx, result, finished = false
    const finish = error => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      db?.close()
      if (error) reject(error)
      else resolve(result)
    }
    const timer = setTimeout(() => {
      try { tx?.abort() } catch { /* Already completed. */ }
      finish(new Error('Scan storage timed out'))
    }, 10000)
    try {
      if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable')
      const request = globalThis.indexedDB.open(databaseName, 1)
      request.onupgradeneeded = () => {
        if (finished) { request.transaction.abort(); return }
        const store = request.result.createObjectStore(STORE, { keyPath: ['scope', 'scoutingId'] })
        store.createIndex('scope', 'scope')
      }
      request.onerror = () => finish(request.error)
      request.onblocked = () => finish(new Error('Scan storage is blocked by another tab'))
      request.onsuccess = () => {
        db = request.result
        if (finished) { db.close(); return }
        db.onversionchange = () => db.close()
        try {
          tx = db.transaction(STORE, mode)
          tx.oncomplete = () => finish()
          tx.onabort = tx.onerror = () => finish(tx.error || new Error('Scan transaction failed'))
          action(tx.objectStore(STORE), value => { result = value })
        } catch (error) {
          try { tx?.abort() } catch { /* No active transaction. */ }
          finish(error)
        }
      }
    } catch (error) { finish(error) }
  })
  return {
    list: scope => run('readonly', (store, done) => {
      const request = store.index('scope').getAll(scope)
      request.onsuccess = () => done(request.result.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    }),
    save: entry => run('readwrite', (store, done) => {
      const request = store.get([entry.scope, entry.scoutingId])
      request.onsuccess = () => {
        const next = { ...entry, createdAt: request.result?.createdAt || entry.createdAt }
        store.put(next)
        done(next)
      }
    }),
    // Compare revisions atomically: never erase a newer scan during an upload.
    settle: (entry, error) => run('readwrite', (store, done) => {
      const key = [entry.scope, entry.scoutingId]
      const request = store.get(key)
      request.onsuccess = () => {
        const current = request.result
        if (!current || current.revision !== entry.revision) { done(false); return }
        if (error === null) store.delete(key)
        else store.put({ ...current, attempts: current.attempts + 1, lastError: error, updatedAt: new Date().toISOString() })
        done(true)
      }
    }),
  }
}

