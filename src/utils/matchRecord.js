import {
  EVENT_CODE,
  MATCH_COLUMN_KEYS,
  MATCH_FIELDS,
  QR_LINE_COUNT,
  getFieldByColumn,
} from '../constants/matchSchema.js'

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
  const lines = String(qrText || '').split('\n').map(line => line.trim()).filter(line => line !== '')
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

  return data
}

export const pickMatchRecord = (row = {}) => {
  const record = {}
  for (const key of MATCH_COLUMN_KEYS) {
    if (row[key] !== undefined) record[key] = row[key]
  }
  if (record['Use Data'] === undefined) record['Use Data'] = true
  return record
}

export const getCsvHeaders = () => [...MATCH_COLUMN_KEYS]

export const coerceCsvValue = (header, raw) => {
  const field = getFieldByColumn(header)
  if (header === 'Use Data') return coerceValue('bool', raw)
  if (!field) return typeof raw === 'string' ? raw.trim() : raw
  return coerceValue(field.type, raw)
}

export const stripMatchMeta = (row = {}) => {
  const { _teamNumber, _matchNumber, ...rest } = row
  return pickMatchRecord(rest)
}
