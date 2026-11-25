import { getCsvHeaders } from './matchRecord.js'

export const objectsToCSV = (rows, headers) => {
  const csvLines = []

  csvLines.push(headers.map(h => escapeCSVField(h)).join(','))

  rows.forEach(row => {
    const values = headers.map(header => {
      const value = row[header]
      return escapeCSVField(value)
    })
    csvLines.push(values.join(','))
  })

  return csvLines.join('\n')
}

const escapeCSVField = (field) => {
  if (field === null || field === undefined) return ''
  const str = String(field)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const scannedDataToCSV = (scannedData) => {
  const headers = getCsvHeaders()
  return objectsToCSV(scannedData, headers)
}

export const mergeScanRows = (...sources) => {
  const keyed = new Map()
  const unkeyed = []
  for (const row of sources.flat()) {
    const id = row['Scouting ID']
    if (id) keyed.set(id, { ...keyed.get(id), ...row })
    else unkeyed.push(row)
  }
  return [...keyed.values(), ...unkeyed]
}
