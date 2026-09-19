import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_FIELDS, QR_LINE_COUNT } from '../constants/matchSchema.js'
import { parseMatchQr, pickMatchRecord, stripMatchMeta } from './matchRecord.js'

const sampleQr = [
  '9561',
  '3',
  'Evan',
  'R1',
  'null',
  '2',
  '1',
  '1',
  '0',
  '1',
  '1',
  '3',
  '0L',
  'false',
  'true',
  'false',
  'false',
  'got stuck on bump',
].join('\n')

test('QR line count matches the season schema', () => {
  assert.equal(QR_LINE_COUNT, 2 + MATCH_FIELDS.length)
})

test('parseMatchQr fills match columns from the season schema', () => {
  const parsed = parseMatchQr(sampleQr)
  assert.equal(parsed['Scouting ID'], 'GACMP_9561_3')
  assert.equal(parsed._teamNumber, 9561)
  assert.equal(parsed._matchNumber, 3)
  assert.equal(parsed['Cycle Count'], 2)
  assert.equal(parsed.Pins, 1)
  assert.equal(parsed.Steals, 0)
  assert.equal(parsed.Blocks, 1)
  assert.equal(parsed.Rams, 1)
  assert.equal(parsed['Defense Rating'], 3)
  assert.equal(parsed['Auto Path'], null)
  assert.equal(parsed['Bump?'], false)
  assert.equal(parsed['Trench?'], true)
  assert.equal(parsed['Use Data'], true)
  assert.equal(parsed.Notes, 'got stuck on bump')
})

test('parseMatchQr rejects short payloads', () => {
  assert.throws(() => parseMatchQr('9561\n3\nEvan'), /expected/)
})

test('pickMatchRecord keeps only database columns', () => {
  const parsed = parseMatchQr(sampleQr)
  const record = stripMatchMeta(parsed)
  assert.equal(record._teamNumber, undefined)
  assert.equal(record['Scouting ID'], 'GACMP_9561_3')
  assert.equal(record.Pins, 1)
  assert.equal(pickMatchRecord(parsed).Pins, 1)
})
