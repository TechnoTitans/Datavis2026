import assert from 'node:assert/strict'
import test from 'node:test'
import { checkCycleOutliers, noShowStatus } from './cycleOutliers.js'
const rows = counts => counts.map(count => ({ 'Cycle Count': count }))

test('flags unusual counts without flagging normal or missing counts', () => {
  const flags = checkCycleOutliers(rows([4, 5, 5, 6, 50, null]))
  assert.deepEqual(flags.slice(0, 4), [null, null, null, null])
  assert.match(flags[4], /Unusual/)
  assert.equal(flags[5], null)
})
test('small samples skip statistical checks but catch invalid counts', () => {
  assert.deepEqual(checkCycleOutliers(rows([1, 50])), [null, null])
  for (const flag of checkCycleOutliers(rows([-1, 1.5]))) assert.match(flag, /Invalid/)
})
test('no shows retain unknown status and flag contradictory cycles', () => {
  assert.equal(noShowStatus({}), null)
  assert.equal(noShowStatus({ 'No Show?': 'false' }), false)
  assert.equal(noShowStatus({ 'No Show': 1 }), true)
  assert.match(checkCycleOutliers([{ 'No Show': true, 'Cycle Count': 5 }])[0], /No Show/)
})
test('constant counts tolerate one-cycle variation', () => {
  assert.deepEqual(checkCycleOutliers(rows([5, 5, 5, 5, 6])), [null, null, null, null, null])
})
