import {
  EVENT_CODE,
  MATCH_COLUMN_KEYS,
  MATCH_FIELDS,
  MATCH_METADATA_FIELDS,
  QR_LINE_COUNT,
} from '../../constants/matchSchema.js'

export const coerceValue = (type, raw) => {
  if (raw === true) return type === 'bool' ? true : 1
  if (raw === false) return type === 'bool' ? false : 0
  if (raw == null) return type === 'bool' ? false : null

  const text = String(raw).trim()
  if (type === 'nullable') {
    if (!text || text.toLowerCase() === 'null') return null
    return text
  }
  if (type === 'int') {
    if (!text || text.toLowerCase() === 'null') return null
    const parsed = Number.parseInt(text, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (type === 'bool') {
    return text.toLowerCase() === 'true' || text === '1'
  }
  if (!text || text.toLowerCase() === 'null') return null
  return raw
}

export const parseMatchQr = (qrText) => {
  const lines = String(qrText || '').split('\n').map(line => line.trim())
  if (lines.length < QR_LINE_COUNT) {
    throw new Error(`QR data has ${lines.length} lines, expected ${QR_LINE_COUNT}`)
  }

  const teamNumber = Number.parseInt(lines[0], 10)
  const matchNumber = Number.parseInt(lines[1], 10)
  if (!Number.isFinite(teamNumber) || !Number.isFinite(matchNumber)) {
    throw new Error('QR data is missing a valid team or match number')
  }

  const data = {
    'Scouting ID': `${EVENT_CODE}_${teamNumber}_${matchNumber}`,
    'Use Data': true,
    _teamNumber: teamNumber,
    _matchNumber: matchNumber,
  }

  MATCH_FIELDS.forEach((field, index) => {
    data[field.key] = coerceValue(field.type, lines[2 + index])
  })

  // New producers may append No Show after Notes; old payloads remain valid.
  if (lines[QR_LINE_COUNT]) {
    const flag = lines[QR_LINE_COUNT].toLowerCase()
    if (!['true', 'false', '1', '0'].includes(flag)) throw new Error('Invalid No Show flag')
    data['No Show'] = coerceValue('bool', flag)
  }
  return data
}

export const pickMatchRecord = (row = {}) => {
  const record = {}
  for (const key of MATCH_COLUMN_KEYS) {
    if (row[key] !== undefined) record[key] = row[key]
  }
  for (const field of MATCH_METADATA_FIELDS) {
    const source = [field.key, ...(field.aliases || [])].find(key => row[key] != null)
    if (source) record[field.key] = coerceValue(field.type, row[source])
  }
  if (record['Use Data'] === undefined) record['Use Data'] = true
  return record
}

export const getCsvHeaders = () => [...MATCH_COLUMN_KEYS]

export const stripMatchMeta = (row = {}) => {
  const { _teamNumber, _matchNumber, ...rest } = row
  return pickMatchRecord(rest)
}

/**
 * Parses team number from scouting ID
 * @param {string} scoutingId - The scouting ID string
 * @returns {number|null} - The team number or null if invalid
 */
export const parseTeamNumber = (scoutingId) => {
  if (typeof scoutingId !== "string") return null
  const parts = scoutingId.split('_')
  if (parts.length > 1 && !isNaN(Number(parts[1]))) {
    return Number(parts[1])
  }
  return null
}

/**
 * Parses match number from scouting ID
 * @param {string} scoutingId - The scouting ID string
 * @returns {number} - The match number or 0 if invalid
 */
export const parseMatchNumber = (scoutingId) => {
  if (typeof scoutingId !== "string") return 0
  const parts = scoutingId.split('_')
  if (parts.length > 2 && !isNaN(Number(parts[2]))) {
    return Number(parts[2])
  }
  return 0
}

export const MATCH_POSITIONS = ['R1', 'R2', 'R3', 'B1', 'B2', 'B3']

export function findMissingMatches(rows) {
  let maxMatch = 0
  const present = new Set()
  for (const row of rows) {
    const match = parseMatchNumber(row['Scouting ID'])
    if (!Number.isSafeInteger(match) || match < 1) continue
    maxMatch = Math.max(maxMatch, match)
    const position = String(row.Position ?? '').trim().toUpperCase()
    present.add(`${match}-${position}`)
  }

  const missing = []
  for (let match = 1; match <= maxMatch; match++) {
    for (const position of MATCH_POSITIONS) {
      if (!present.has(`${match}-${position}`)) missing.push({ match, position })
    }
  }
  return { maxMatch, missing }
}

