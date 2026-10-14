import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCSV, objectsToCSV, mergeExportRows, fetchAllMatchRows, downloadAllData } from './csvHandler.js'

test('CSV round trips quoted headers and multiline notes', () => {
  const rows = [{ 'Scouting ID': 'GACMP_1_1', Notes: 'a,"b"\nnext line', 'No Show': true }]
  assert.deepEqual(parseCSV(objectsToCSV(rows, Object.keys(rows[0]))), rows)
  assert.deepEqual(parseCSV(''), [])
})

test('export preserves legacy fields and newer records take precedence', () => {
  assert.deepEqual(mergeExportRows(
    [{ 'Scouting ID': 'x', 'Shot Coordinates': '3,3;', Notes: 'old' }],
    [{ 'Scouting ID': 'x', Notes: 'new' }],
  ), [{ 'Scouting ID': 'x', 'Shot Coordinates': '3,3;', Notes: 'new' }])
})

test('approved data is paginated beyond 1000 records', async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => ({ 'Scouting ID': String(i) }))
  const client = { from: () => ({ select: () => ({ order: () => ({
    range: async (start, end) => ({ data: rows.slice(start, end + 1) }),
  }) }) }) }
  assert.equal((await fetchAllMatchRows(client)).length, 1001)
})

test('download works with approved data and zero pending scans', async (t) => {
  const clicked = []
  const link = { setAttribute: (key, value) => { link[key] = value }, style: {}, click: () => clicked.push(link.download) }
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, text: async () => '' }))
  const originalDocument = globalThis.document
  globalThis.document = { createElement: () => link, body: { appendChild() {}, removeChild() {} } }
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  })
  const client = { from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: [{ 'Scouting ID': 'x' }] }) }) }) }) }
  assert.equal(await downloadAllData([], client), 1)
  assert.equal(clicked.length, 1)
})

test('database failures are surfaced', async () => {
  const client = { from: () => ({ select: () => ({ order: () => ({ range: async () => ({ error: new Error('unavailable') }) }) }) }) }
  await assert.rejects(fetchAllMatchRows(client), /unavailable/)
})

test('missing attendance stays unknown through CSV export', () => {
  assert.equal(parseCSV('Scouting ID,No Show\nx,')[0]['No Show'], null)
})
