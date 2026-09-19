import { parseMatchNumber, parseTeamNumber } from './helpers.js'
import { CYCLE_COLUMNS, DEFENSE_ACTIONS, DEFENSE_RATING_COLUMNS } from '../constants/matchSchema.js'

export { DEFENSE_ACTIONS, DEFENSE_RATING_COLUMNS } from '../constants/matchSchema.js'

export const POINTS_PER_FUEL = 1

export const TIER_COLUMNS = ['Tier', 'Shooter Tier', 'Shooting Tier', 'Shot Tier', 'Fuel Tier']

export const TIER_RANGES = {
  1: [0, 20],
  2: [21, 40],
  3: [41, 60],
}

const EMPTY_NOTE_VALUES = new Set(['', 'null', 'true', 'false', 'n/a', 'na', 'none', '-', 'nil'])
const EMPTY_DEFENSE_VALUES = new Set([
  '',
  'n/a',
  'na',
  'none',
  '-',
  'no defense',
  'no defence',
  'n/a.',
  'none.',
])

export const toNumber = (value) => {
  if (value === true || value === 'true') return 1
  if (value === false || value === 'false') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed.toLowerCase() === 'null') return null
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export const getRowNumber = (row, columns) => {
  for (const column of columns || []) {
    if (!row || !Object.prototype.hasOwnProperty.call(row, column)) continue
    const parsed = toNumber(row[column])
    if (parsed != null) return parsed
  }
  for (const column of columns || []) {
    const parsed = toNumber(row?.[column])
    if (parsed != null) return parsed
  }
  return null
}

export const getDefenseActionValue = (row, action) => getRowNumber(row, action.columns)

export const getDefenseRatingValue = (row) => getRowNumber(row, DEFENSE_RATING_COLUMNS)

export const mean = (values) => {
  const nums = (values || []).filter(value => typeof value === 'number' && Number.isFinite(value))
  if (nums.length === 0) return null
  return nums.reduce((sum, value) => sum + value, 0) / nums.length
}

export const formatNumber = (value, digits = 2) => {
  if (value == null || !Number.isFinite(value)) return '—'
  const fixed = Number(value.toFixed(digits))
  return Number.isInteger(fixed) ? String(fixed) : fixed.toFixed(digits)
}

// { low, high } -> "77.5 – 135"
export const formatRange = (range, digits = 1) => {
  if (!range) return '—'
  return `${formatNumber(range.low, digits)} – ${formatNumber(range.high, digits)}`
}

// Reads a tier (1, 2, or 3) from a row. Accepts "2", "T2", "Tier 2".
export const parseTier = (row) => {
  for (const column of TIER_COLUMNS) {
    const value = row?.[column]
    if (value == null) continue
    const match = String(value).match(/^\s*(?:tier|t)?\s*([123])\s*$/i)
    if (match) return Number(match[1])
  }
  return null
}

// cycles 5, tier 2 -> { low: 105, high: 200 }
export const optimisticRange = (cycleCount, tier) => {
  const range = TIER_RANGES[Number(tier)]
  const cycles = Number(cycleCount)
  if (!range || cycleCount == null || !Number.isFinite(cycles)) return null
  return { low: cycles * range[0], high: cycles * range[1] }
}

// tier 2 -> { low: 21, high: 40 }
export const tierRange = (tier) => {
  const range = TIER_RANGES[Number(tier)]
  return range ? { low: range[0], high: range[1] } : null
}

// Averages lows and highs separately. Rows with no valid range are skipped.
// 50-70 and 105-200 -> 77.5 - 135
export const averageRange = (ranges) => {
  const valid = (ranges || []).filter(Boolean)
  if (valid.length === 0) return null
  return {
    low: valid.reduce((sum, r) => sum + r.low, 0) / valid.length,
    high: valid.reduce((sum, r) => sum + r.high, 0) / valid.length,
  }
}

export const formatMatchLabel = (row) => {
  const matchNumber = parseMatchNumber(row?.['Scouting ID'])
  return matchNumber > 0 ? `M${matchNumber}` : (row?.['Scouting ID'] || '—')
}

export const teamFromMatchRow = (row) => {
  if (row?.team != null && String(row.team).trim() !== '') return String(row.team)
  const parsed = parseTeamNumber(row?.['Scouting ID'])
  return parsed == null ? '' : String(parsed)
}

export const teamsFromQualRow = (row) => {
  return String(row?.teams || '')
    .trim()
    .split(/\s+/)
    .map(team => team.trim())
    .filter(Boolean)
}

export const qualRowHasTeam = (row, team) => teamsFromQualRow(row).includes(String(team))

export const isRealNote = (value) => {
  if (value == null) return false
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return false
  return !EMPTY_NOTE_VALUES.has(normalized)
}

export const noteText = (value) => (isRealNote(value) ? String(value).trim() : '')

export const isEmptyDefenseText = (value) => {
  if (value == null) return true
  const normalized = String(value).replace(/\s+/g, ' ').trim().toLowerCase()
  if (!normalized) return true
  return EMPTY_DEFENSE_VALUES.has(normalized)
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const textMatchesKeyword = (text, keyword) => {
  const raw = String(keyword || '').trim()
  if (!raw) return false
  const haystack = String(text || '')
  if (!haystack) return false

  if (raw.toLowerCase() === 'ferry') {
    return /\bferr(?:y|ies|ying)\b/i.test(haystack)
  }

  return new RegExp(escapeRegExp(raw), 'i').test(haystack)
}

export const lineMatchesKeywordForTeam = (line, keyword, team) => {
  if (!textMatchesKeyword(line, keyword)) return false
  const numbers = String(line).match(/\b\d{2,5}\b/g) || []
  if (numbers.length === 0) return true
  return numbers.includes(String(team))
}

export const extractKeywordLinesForTeam = (text, keyword, team) => {
  return String(text || '')
    .split(/\r?\n/)
    .filter(line => lineMatchesKeywordForTeam(line, keyword, team))
    .join('\n')
    .trim()
}

export const textMatchesKeywordForTeam = (text, keyword, team) => {
  return extractKeywordLinesForTeam(text, keyword, team).length > 0
}

export const qualRowMatchesKeyword = (row, keyword, team) => {
  const fields = [row?.defense, row?.strategies, row?.misc]
  if (team == null || String(team).trim() === '') {
    return fields.some(field => textMatchesKeyword(field, keyword))
  }
  return fields.some(field => textMatchesKeywordForTeam(field, keyword, team))
}

export const splitKeywordMatches = (text, keyword) => {
  const source = String(text || '')
  const raw = String(keyword || '').trim()
  if (!source || !raw) return source ? [{ text: source, match: false }] : []

  const splitter = raw.toLowerCase() === 'ferry'
    ? /(\bferr(?:y|ies|ying)\b)/gi
    : new RegExp(`(${escapeRegExp(raw)})`, 'gi')
  const isKeywordPiece = (part) => (
    raw.toLowerCase() === 'ferry'
      ? /^(?:ferr(?:y|ies|ying))$/i.test(part)
      : part.toLowerCase() === raw.toLowerCase()
  )

  const parts = source.split(splitter)
  if (parts.length === 1) return [{ text: source, match: false }]

  return parts.filter(Boolean).map(part => ({
    text: part,
    match: isKeywordPiece(part),
  }))
}

export const getShotRaw = (row) => {
  for (const column of CYCLE_COLUMNS) {
    const candidate = row?.[column]
    if (candidate == null) continue
    const text = String(candidate).trim()
    if (!text || text.toLowerCase() === 'null') continue
    return candidate
  }
  return null
}

export const parseCoordinates = (raw) => {
  if (raw == null) return []
  const text = String(raw).trim()
  if (!text || text.toLowerCase() === 'null') return []

  return text
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const match = part.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
      if (!match) return null
      return { x: Number(match[1]), y: Number(match[2]), raw: part }
    })
    .filter(Boolean)
}

export const looksLikeLocationMap = (coords) => {
  if (!Array.isArray(coords) || coords.length < 12) return false
  const unique = new Set(coords.map(coord => `${coord.x},${coord.y}`))
  if (unique.size < 12) return false
  return unique.size / coords.length >= 0.75
}

const parseFuelFromNotes = (notes) => {
  const text = noteText(notes)
  if (!text) return null

  const patterns = [
    /(\d+(?:\.\d+)?)\s*fuel(?:s| balls?)?\b/i,
    /\bfuel(?:s)?\s*(?:count|scored|scored:)?\s*[:=]?\s*(\d+(?:\.\d+)?)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const value = Number(match[1])
      if (Number.isFinite(value)) return value
    }
  }

  return null
}

const isTruthyFlag = (value) => value === true || value === 'true' || value === 1 || value === '1'

export const parseCycleAndFuel = (row) => {
  const explicitFuel = toNumber(
    row?.['Fuel Count'] ?? row?.['Average Fuel'] ?? row?.['Avg Fuel'] ?? row?.fuel,
  )
  const notesFuel = parseFuelFromNotes(row?.Notes)
  const raw = getShotRaw(row)
  const coords = parseCoordinates(raw)
  const numericOnly = raw != null && coords.length === 0 ? toNumber(raw) : null
  const paintedLocationMap = looksLikeLocationMap(coords)
  const shotCount = coords.length > 0 && !paintedLocationMap ? coords.length : null
  const cycleCount = numericOnly != null && numericOnly >= 0 ? numericOnly : shotCount
  const fuelCount = explicitFuel ?? notesFuel ?? shotCount
  const cycleSource = numericOnly != null ? 'numeric' : shotCount != null ? 'shots' : null
  const fuelSource = explicitFuel != null ? 'field' : notesFuel != null ? 'notes' : shotCount != null ? 'shots' : null
  const independentFuel = fuelSource === 'field' || fuelSource === 'notes'
  const shoots = Boolean(
    (cycleCount != null && cycleCount > 0) ||
    coords.length > 0 ||
    isTruthyFlag(row?.['Shot While Moving']),
  )

  // Tier-based values: optimistic score = cycles x tier point range
  const tier = parseTier(row)
  const range = optimisticRange(cycleCount, tier)
  const fuelRange = tierRange(tier)

  let optimistic = null
  let optimisticMode = null
  if (cycleCount != null && fuelCount != null && independentFuel) {
    optimistic = cycleCount * fuelCount
    optimisticMode = 'cycles_times_fuel'
  } else if (fuelCount != null) {
    optimistic = fuelCount * POINTS_PER_FUEL
    optimisticMode = 'fuel_points'
  } else if (cycleCount != null) {
    optimistic = cycleCount * POINTS_PER_FUEL
    optimisticMode = 'cycle_points'
  }

  return {
    coords,
    paintedLocationMap,
    shotCount: coords.length,
    cycleCount,
    fuelCount,
    cycleSource,
    fuelSource,
    independentFuel,
    shoots,
    tier,
    optimisticRange: range,
    fuelRange,
    optimistic,
    optimisticMode,
  }
}

export const matchDefenseRating = (row) => {
  const explicit = getDefenseRatingValue(row)
  if (explicit != null) return explicit
  const ratings = DEFENSE_ACTIONS
    .map(action => getDefenseActionValue(row, action))
    .filter(value => value != null)
  return mean(ratings)
}

export const summarizeDefense = (teamRows) => {
  const rows = Array.isArray(teamRows) ? teamRows : []
  const actions = DEFENSE_ACTIONS.map(action => {
    const values = rows.map(row => getDefenseActionValue(row, action)).filter(value => value != null)
    const didValues = values.filter(value => value > 0)
    return {
      ...action,
      matches: values.length,
      didCount: didValues.length,
      does: didValues.length > 0,
      average: mean(values),
      averageWhenDoing: mean(didValues),
      max: values.length ? Math.max(...values) : null,
    }
  })

  const generalValues = rows.map(matchDefenseRating).filter(value => value != null)
  const maxAction = Math.max(0, ...actions.map(action => action.max ?? 0))
  const maxGeneral = generalValues.length ? Math.max(...generalValues) : 0
  const binaryActions = maxAction <= 1
  const generalScale = maxGeneral <= 1 ? 1 : 5

  return {
    matchCount: rows.length,
    actions,
    generalAverage: mean(generalValues),
    doesAnyDefense: actions.some(action => action.does),
    binary: binaryActions,
    scale: generalScale,
  }
}

export const summarizeShooter = (teamRows, qualRows = [], keyword = 'ferry', team = '') => {
  const rows = Array.isArray(teamRows) ? teamRows : []
  const parsedRows = rows.map(row => ({
    row,
    matchLabel: formatMatchLabel(row),
    notes: noteText(row?.Notes),
    metrics: parseCycleAndFuel(row),
  }))

  const ferryNotes = parsedRows.filter(entry => textMatchesKeyword(entry.notes, keyword))
  const ferryQual = (qualRows || []).filter(row => qualRowMatchesKeyword(row, keyword, team))
  const shoots = parsedRows.some(entry => entry.metrics.shoots)
  const ferries = ferryNotes.length > 0 || ferryQual.length > 0

  const cycleAvg = mean(parsedRows.map(entry => entry.metrics.cycleCount))
  const fuelAvg = mean(parsedRows.map(entry => entry.metrics.fuelCount))
  const independentFuel = parsedRows.some(entry => entry.metrics.independentFuel && entry.metrics.fuelCount != null)

  // Average of the per-row ranges (lows and highs averaged separately)
  const avgOptimisticRange = averageRange(parsedRows.map(entry => entry.metrics.optimisticRange))
  const tierAvg = mean(parsedRows.map(entry => entry.metrics.tier))
  const fuelRange = averageRange(parsedRows.map(entry => entry.metrics.fuelRange))

  let optimistic = null
  let optimisticMode = null
  if (cycleAvg != null && fuelAvg != null && independentFuel) {
    optimistic = cycleAvg * fuelAvg
    optimisticMode = 'cycles_times_fuel'
  } else if (fuelAvg != null) {
    optimistic = fuelAvg * POINTS_PER_FUEL
    optimisticMode = 'fuel_points'
  } else if (cycleAvg != null) {
    optimistic = cycleAvg * POINTS_PER_FUEL
    optimisticMode = 'cycle_points'
  }

  let role = 'neither'
  if (shoots && ferries) role = 'both'
  else if (shoots) role = 'shoot'
  else if (ferries) role = 'ferry'

  return {
    matchCount: rows.length,
    parsedRows,
    ferryNotes,
    ferryQual,
    shoots,
    ferries,
    role,
    cycleAvg,
    fuelAvg,
    independentFuel,
    tierAvg,
    fuelRange,
    optimisticRange: avgOptimisticRange,
    optimistic,
    optimisticMode,
    locationMapOnly: parsedRows.some(entry => entry.metrics.paintedLocationMap) && cycleAvg == null,
  }
}

export const orderedTeamIds = (selectedTeams) => {
  return [...(selectedTeams || [])]
    .map(String)
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b))
}

export const mergeTeamLists = (...lists) => {
  const unique = new Set()
  for (const list of lists) {
    for (const team of list || []) {
      const numeric = toNumber(team)
      if (numeric != null) unique.add(numeric)
    }
  }
  return [...unique].sort((a, b) => a - b)
}