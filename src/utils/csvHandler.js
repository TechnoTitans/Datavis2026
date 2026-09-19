import { getCsvHeaders, coerceCsvValue } from './matchRecord'

export const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n')
  if (lines.length === 0) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const values = parseCSVLine(line)
    const row = {}

    headers.forEach((header, index) => {
      const raw = values[index] ? values[index].trim() : ''
      row[header] = coerceCsvValue(header, raw)
    })

    rows.push(row)
  }

  return rows
}

const parseCSVLine = (line) => {
  const values = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }

  values.push(current)
  return values
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
}

export const getCSVHeaders = () => getCsvHeaders()

export const scannedDataToCSV = (scannedData) => {
  const headers = getCSVHeaders()
  return objectsToCSV(scannedData, headers)
}

export const downloadAllData = async (scannedData) => {
  try {
    const historicalData = await fetchCSVData()
    const allData = [...historicalData, ...scannedData]
    const headers = getCSVHeaders()
    downloadCSV(allData, headers, `all_match_data_${new Date().toISOString().split('T')[0]}.csv`)
  } catch (error) {
    console.error('Error downloading all data:', error)
    throw error
  }
}
