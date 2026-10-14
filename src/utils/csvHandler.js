import { getCsvHeaders, coerceCsvValue } from './matchRecord.js'

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

export const fetchCSVData = async () => {
  try {
    const response = await fetch('/match_data_rows.csv')
    if (!response.ok) {
      console.error('Failed to fetch CSV:', response.statusText)
      return []
    }
    const csvText = await response.text()
    return parseCSV(csvText)
  } catch (error) {
    console.error('Error fetching CSV data:', error)
    return []
  }
}

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

export const downloadCSV = (rows, headers, filename = 'match_data_rows.csv') => {
  const csv = objectsToCSV(rows, headers)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const getCSVHeaders = () => getCsvHeaders()

export const scannedDataToCSV = (scannedData) => {
  const headers = getCSVHeaders()
  return objectsToCSV(scannedData, headers)
}

// Explicit ordering and pagination avoid Supabase's default row limit.
export const fetchAllMatchRows = async (client, table = 'match_data') => {
  const rows = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from(table).select('*')
      .order('Scouting ID').range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

export const mergeExportRows = (...sources) => {
  const keyed = new Map()
  const unkeyed = []
  for (const row of sources.flat()) {
    const id = row['Scouting ID']
    if (id) keyed.set(id, { ...keyed.get(id), ...row })
    else unkeyed.push(row)
  }
  return [...keyed.values(), ...unkeyed]
}

export const downloadAllData = async (scannedData = [], client = null, localCSV = '') => {
  const historicalData = await fetchCSVData()
  // Do not silently label an export complete if the configured database fails.
  const approvedData = client ? await fetchAllMatchRows(client) : []
  const pendingData = client ? await fetchAllMatchRows(client, 'unconfirmed_data') : []
  const allData = mergeExportRows(historicalData, parseCSV(localCSV), approvedData, scannedData, pendingData)
  if (!allData.length) throw new Error('No data available to export.')
  const headers = [...new Set([...getCSVHeaders(), ...allData.flatMap(Object.keys)])]
  downloadCSV(allData, headers, `all_match_data_${new Date().toISOString().split('T')[0]}.csv`)
  return allData.length
}
