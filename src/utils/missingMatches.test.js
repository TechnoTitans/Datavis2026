import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_POSITIONS, findMissingMatches, fetchMissingMatches } from './missingMatches.js'

const row = (match, position) => ({ 'Scouting ID': `GACMP_123_${match}`, Position: position })

test('checks missing whole matches and positions through the maximum, inclusive', () => {
  const rows = MATCH_POSITIONS.map(position => row(1, position))
  rows.push(row(3, ' r1 '), row(3, 'R1'))
  const result = findMissingMatches(rows)
  assert.equal(result.maxMatch, 3)
  assert.deepEqual(result.missing, [
    ...MATCH_POSITIONS.map(position => ({ match: 2, position })),
    ...MATCH_POSITIONS.slice(1).map(position => ({ match: 3, position })),
  ])
})

test('handles complete, empty, and invalid records', () => {
  assert.deepEqual(findMissingMatches([]), { maxMatch: 0, missing: [] })
  assert.deepEqual(findMissingMatches([row(0, 'R1'), row('bad', 'R1'), row(1.5, 'R1')]), { maxMatch: 0, missing: [] })
  assert.deepEqual(findMissingMatches(MATCH_POSITIONS.map(position => ({ ...row(1, position), 'Use Data': false }))), { maxMatch: 1, missing: [] })
  assert.equal(findMissingMatches([row(1, null)]).missing.length, 6)
})

test('loads all pages even when the server returns fewer than 1000 rows', async () => {
  const offsets = []
  const pages = [[row(1, 'R1')], [row(2, 'B3')], []]
  const query = {
    select() { return this },
    order() { return this },
    range(start) { offsets.push(start); return Promise.resolve({ data: pages.shift() }) },
  }
  const result = await fetchMissingMatches({ from: () => query })
  assert.deepEqual(offsets, [0, 1, 2])
  assert.equal(result.maxMatch, 2)
  assert.equal(result.missing.length, 10)
})

test('propagates query failures instead of reporting incomplete data', async () => {
  const query = {
    select() { return this },
    order() { return this },
    range() { return Promise.resolve({ error: new Error('Unavailable') }) },
  }
  await assert.rejects(fetchMissingMatches({ from: () => query }), /Unavailable/)
})
