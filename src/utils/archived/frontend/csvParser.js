import { coerceValue } from '../../frontend/matchRecord.js'
import { getFieldByColumn, MATCH_METADATA_FIELDS } from '../../../constants/matchSchema.js'

export const coerceCsvValue = (header, raw) => {
  const field = getFieldByColumn(header)
  if (MATCH_METADATA_FIELDS.includes(field) && (raw == null || String(raw).trim() === '')) return null
  if (header === 'Use Data') return coerceValue('bool', raw)
  if (!field) return typeof raw === 'string' ? raw.trim() : raw
  return coerceValue(field.type, raw)
}

export const parseCSV = (csvText) => {
  const records = []
  let record = []
  let value = ''
  let quoted = false
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    if (char === '"') {
      if (quoted && csvText[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) {
      record.push(value); value = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csvText[i + 1] === '\n') i++
      record.push(value)
      if (record.some(cell => cell.trim())) records.push(record)
      record = []; value = ''
    } else value += char
  }
  record.push(value)
  if (record.some(cell => cell.trim())) records.push(record)
  const headers = (records.shift() || []).map(header => header.trim().replace(/^\uFEFF/, ''))
  return records.map(values => Object.fromEntries(headers.map((header, index) =>
    [header, coerceCsvValue(header, values[index] ?? '')],
  )))
}

