import { parseCycleAndFuel } from './scoutingMetrics.js'

export const noShowStatus = (row) => {
  const value = row['No Show'] ?? row['No Show?'] ?? row.NoShow ?? row.no_show
  if (value == null || value === '') return null
  if (value === true || value === 1 || ['true', '1'].includes(String(value).toLowerCase())) return true
  if (value === false || value === 0 || ['false', '0'].includes(String(value).toLowerCase())) return false
  return null
}

const quantile = (sorted, fraction) => {
  const index = (sorted.length - 1) * fraction
  const lower = Math.floor(index)
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
}

// Per-team IQR fences; at least four observations are needed for comparison.
// Invalid numeric counts are flagged even when there is too little history.
export const checkCycleOutliers = (rows) => {
  const counts = rows.map(row => parseCycleAndFuel(row).cycleCount)
  const valid = counts.filter((count, i) => noShowStatus(rows[i]) !== true &&
    Number.isInteger(count) && count >= 0).sort((a, b) => a - b)
  const q1 = valid.length >= 4 ? quantile(valid, 0.25) : null
  const q3 = valid.length >= 4 ? quantile(valid, 0.75) : null
  // A one-cycle minimum prevents tiny variations in otherwise constant data
  // from being flagged when the IQR is zero.
  const margin = q1 == null ? null : Math.max(1, 1.5 * (q3 - q1))
  return rows.map((row, i) => {
    const raw = row['Cycle Count']
    if (raw != null && String(raw).trim() !== '') {
      const numeric = Number(raw)
      if (Number.isFinite(numeric) && (!Number.isInteger(numeric) || numeric < 0)) {
        return 'Invalid cycle count: expected a non-negative whole number.'
      }
    }
    const count = counts[i]
    if (noShowStatus(row) === true) {
      return count > 0 ? 'No Show is marked, but cycles were recorded.' : null
    }
    if (count == null) return null
    if (margin != null && (count < q1 - margin || count > q3 + margin)) {
      return `Unusual cycle count (${count}); typical range for this team is ${Math.max(0, q1 - margin).toFixed(1)}–${(q3 + margin).toFixed(1)}.`
    }
    return null
  })
}
