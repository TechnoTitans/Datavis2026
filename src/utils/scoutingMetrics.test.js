import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatNumber,
  isEmptyDefenseText,
  isRealNote,
  looksLikeLocationMap,
  parseCoordinates,
  parseCycleAndFuel,
  qualRowHasTeam,
  splitKeywordMatches,
  summarizeDefense,
  summarizeShooter,
  textMatchesKeyword,
} from './scoutingMetrics.js'

test('parseCoordinates reads shot pairs and ignores junk', () => {
  assert.deepEqual(parseCoordinates(null), [])
  assert.deepEqual(parseCoordinates('null'), [])
  assert.equal(parseCoordinates('3,3;3,2;2,4;').length, 3)
  assert.equal(parseCoordinates('5').length, 0)
})

test('location maps are not treated as cycle counts', () => {
  const painted = '1,1;1,2;1,3;1,6;1,7;1,8;2,1;2,2;2,3;2,6;2,7;2,8;3,1;3,2;3,3;3,6;3,7;3,8;4,1;4,2;4,3;4,6;4,7;4,8;'
  const coords = parseCoordinates(painted)
  assert.equal(looksLikeLocationMap(coords), true)

  const parsed = parseCycleAndFuel({ 'Cycle Count': painted })
  assert.equal(parsed.shoots, true)
  assert.equal(parsed.cycleCount, null)
  assert.equal(parsed.paintedLocationMap, true)
})

test('numeric cycle count and coordinate shots both work', () => {
  assert.equal(parseCycleAndFuel({ 'Cycle Count': '5' }).cycleCount, 5)
  assert.equal(parseCycleAndFuel({ 'Shot Coordinates': '3,3;4,4;' }).cycleCount, 2)
  assert.equal(parseCycleAndFuel({ 'Cycle Count': '3,3;4,4;' }).fuelCount, 2)
})

test('fuel from notes is independent and multiplies with cycles', () => {
  const parsed = parseCycleAndFuel({
    'Cycle Count': '4,2;4,3;5,2;',
    Notes: 'scored 8 fuel after trench',
  })
  assert.equal(parsed.cycleCount, 3)
  assert.equal(parsed.fuelCount, 8)
  assert.equal(parsed.independentFuel, true)
  assert.equal(parsed.optimistic, 24)
  assert.equal(parsed.optimisticMode, 'cycles_times_fuel')
})

test('same-source cycle/fuel does not square the shot count', () => {
  const parsed = parseCycleAndFuel({ 'Shot Coordinates': '3,3;3,2;2,4;' })
  assert.equal(parsed.cycleCount, 3)
  assert.equal(parsed.fuelCount, 3)
  assert.equal(parsed.independentFuel, false)
  assert.equal(parsed.optimistic, 3)
  assert.equal(parsed.optimisticMode, 'fuel_points')
})

test('defense summary flags pin/ram and averages general rating', () => {
  const summary = summarizeDefense([
    { 'Pin Rating': 5, 'Ram Rating': 0, 'Block Rating': 2, 'Steal Rating': 1 },
    { 'Pin Rating': 0, 'Ram Rating': 0, 'Block Rating': 0, 'Steal Rating': 0 },
  ])
  const pin = summary.actions.find(action => action.key === 'pin')
  const ram = summary.actions.find(action => action.key === 'ram')
  assert.equal(pin.does, true)
  assert.equal(ram.does, false)
  assert.equal(pin.didCount, 1)
  assert.equal(formatNumber(summary.generalAverage), '1')
})

test('reads Pins/Steals/Blocks/Rams as 0/1 flags and Defense Rating separately', () => {
  const summary = summarizeDefense([
    { Pins: 1, Steals: 0, Blocks: 1, Rams: 1, 'Defense Rating': 3 },
  ])
  const pin = summary.actions.find(action => action.key === 'pin')
  const steal = summary.actions.find(action => action.key === 'steal')
  const ram = summary.actions.find(action => action.key === 'ram')
  const block = summary.actions.find(action => action.key === 'block')
  assert.equal(summary.binary, true)
  assert.equal(summary.scale, 5)
  assert.equal(pin.does, true)
  assert.equal(steal.does, false)
  assert.equal(block.does, true)
  assert.equal(ram.does, true)
  assert.equal(summary.generalAverage, 3)
})

test('steals stored as boolean still counts as did/did not', () => {
  const summary = summarizeDefense([
    { Pins: 0, Steals: true, Blocks: 0, Rams: 0, 'Defense Rating': 1 },
  ])
  const steal = summary.actions.find(action => action.key === 'steal')
  assert.equal(steal.does, true)
  assert.equal(steal.didCount, 1)
})

test('ferry keyword matches ferry/ferries/ferrying only as words', () => {
  assert.equal(textMatchesKeyword('1833 and 4189 ferry while hub is off', 'ferry'), true)
  assert.equal(textMatchesKeyword('6705 also ferries by pushing fuel', 'ferry'), true)
  assert.equal(textMatchesKeyword('Ferrying when off', 'ferry'), true)
  assert.equal(textMatchesKeyword('interference', 'ferry'), false)
  assert.equal(splitKeywordMatches('they ferries fuel', 'ferry').some(part => part.match), true)
})

test('qual team tokens and empty defense text', () => {
  assert.equal(qualRowHasTeam({ teams: '6705 5651 3815' }, '5651'), true)
  assert.equal(qualRowHasTeam({ teams: '6705 5651 3815' }, '56'), false)
  assert.equal(isEmptyDefenseText('N/A'), true)
  assert.equal(isEmptyDefenseText('No defense'), true)
  assert.equal(isEmptyDefenseText('5651 kind of doing well at defense'), false)
  assert.equal(isRealNote('true'), false)
  assert.equal(isRealNote('pushes fuel to outpost'), true)
})

test('shooter summary combines scouting shots with qual ferry notes', () => {
  const summary = summarizeShooter(
    [{ 'Scouting ID': 'GACMP_6705_1', 'Cycle Count': '4,2;5,2;', Notes: 'false' }],
    [{ teams: '6705 5651 3815', strategies: '6705 also ferries by pushing fuel under trench', defense: 'N/A', misc: '' }],
    'ferry',
    '6705',
  )
  assert.equal(summary.shoots, true)
  assert.equal(summary.ferries, true)
  assert.equal(summary.role, 'both')
  assert.equal(summary.ferryQual.length, 1)
})

test('qual ferry lines are attributed to named teams only', () => {
  const row = {
    teams: '6705 5651 3815',
    strategies: '6705 also ferries by pushing fuel under trench',
    defense: 'N/A',
    misc: '',
  }
  const named = summarizeShooter([], [row], 'ferry', '6705')
  const partner = summarizeShooter([], [row], 'ferry', '5651')
  assert.equal(named.ferries, true)
  assert.equal(partner.ferries, false)

  const allianceWide = summarizeShooter(
    [],
    [{ teams: '8080 4509 1833', strategies: 'Ferrying when off', defense: '', misc: '' }],
    'ferry',
    '4509',
  )
  assert.equal(allianceWide.ferries, true)
})
