import PropTypes from 'prop-types'
import BaseLineChart from './BaseLineChart'
import { parseMatchNumber } from '../../../utils/frontend/matchRecord.js'

// Helper functions for chart data validation and domain calculation
const hasDataForKey = (chartDataByTeam, selectedTeams, dataKey) => {
  return selectedTeams.some(team => 
    (chartDataByTeam[team] || []).some(row => row[dataKey] !== null)
  )
}

const getMinMaxDomain = (chartDataByTeam, selectedTeams, dataKey) => {
  let max = 1, min = 0
  for (const team of selectedTeams) {
    const arr = chartDataByTeam[team] || []
    arr.forEach(row => {
      if (row[dataKey] != null) {
        if (row[dataKey] > max) max = row[dataKey]
        if (row[dataKey] < min) min = row[dataKey]
      }
    })
  }
  return [Math.min(0, min), Math.max(1, max)]
}

/**
 * Attempts chart component
 */
export const AttemptsChart = ({ chartDataByTeam, selectedTeams }) => (
  <BaseLineChart
    chartDataByTeam={chartDataByTeam}
    selectedTeams={selectedTeams}
    dataKey="attempts"
    title="Attempts"
    hasDataCheck={hasDataForKey}
    getYDomain={getMinMaxDomain}
  />
)

/**
 * Success rate chart component
 */
export const SuccessRateChart = ({ chartDataByTeam, selectedTeams }) => (
  <BaseLineChart
    chartDataByTeam={chartDataByTeam}
    selectedTeams={selectedTeams}
    dataKey="successRate"
    title="Success %"
    hasDataCheck={hasDataForKey}
    getYDomain={() => [0, 100]}
    noDataMessage="No Success % data for this field."
  />
)

/**
 * Made chart component
 */
export const MadeChart = ({ chartDataByTeam, selectedTeams }) => (
  <BaseLineChart
    chartDataByTeam={chartDataByTeam}
    selectedTeams={selectedTeams}
    dataKey="made"
    title="Made"
    hasDataCheck={hasDataForKey}
    getYDomain={getMinMaxDomain}
    noDataMessage="No Made data for this field."
  />
)

/**
 * Main StatCharts component that handles data processing and renders all chart types
 */
const StatCharts = ({ matchRows, selectedTeams, selectedStat }) => {
  const getRowMatchNumber = (row) => {
    if (row && typeof row.matchNumber === 'number' && Number.isFinite(row.matchNumber)) {
      return row.matchNumber
    }
    return parseMatchNumber(row?.['Scouting ID'])
  }

  // Build chart data for the selected stat
  const buildStatChartData = (data, field) => {
    const scoringLevels = [
      { made: 'L4 Count', missed: 'L4 Missed Count' },
      { made: 'L3 Count', missed: 'L3 Missed Count' },
      { made: 'L2 Count', missed: 'L2 Missed Count' },
      { made: 'L1 Count', missed: 'L1 Missed Count' },
      { made: 'Processor Count', missed: 'Processor Missed Count' },
      { made: 'Net Count', missed: 'Net Missed Count' },
    ]
    
    const ratingFields = ['Pin', 'Ram', 'Block', 'Steal', 'Anti Pin', 'Anti Ram', 'Anti Block', 'Anti Steal']
    const isRatingField = ratingFields.includes(field)
    
    let madeCol = null, missedCol = null, multiCols = null
    
    if (field === 'Total Cycles') {
      multiCols = scoringLevels
    } else if (field === 'Coral Cycles') {
      multiCols = scoringLevels.slice(0, 4) // L4, L3, L2, L1
    } else if (field === 'Algae Cycles') {
      multiCols = scoringLevels.slice(4) // Processor, Net
    } else if (!isRatingField) {
      const found = scoringLevels.find(level => level.made === field)
      if (found) {
        madeCol = found.made
        missedCol = found.missed
      }
    }

    const grouped = {}
    for (const row of data) {
      const team = row.team ?? ''
      if (!grouped[team]) grouped[team] = []
      grouped[team].push(row)
    }

    const result = {}
    for (const team in grouped) {
      result[team] = grouped[team].map((row) => {
        let made = 0, missed = 0, hasData = false
        let directValue = null

        if (multiCols) {
          for (const level of multiCols) {
            const vMade = row[level.made]
            const vMissed = row[level.missed]
            if (typeof vMade === 'number' && !isNaN(vMade)) {
              made += vMade
              hasData = true
            }
            if (typeof vMissed === 'number' && !isNaN(vMissed)) {
              missed += vMissed
              hasData = true
            }
          }
        } else if (madeCol && missedCol) {
          const vMade = row[madeCol]
          const vMissed = row[missedCol]
          if (typeof vMade === 'number' && !isNaN(vMade)) {
            made = vMade
            hasData = true
          }
          if (typeof vMissed === 'number' && !isNaN(vMissed)) {
            missed = vMissed
            hasData = true
          }
        } else if (isRatingField) {
          const normalizedFieldName = field.replace(/\s+/g, '')
          const dbColumnName = `${normalizedFieldName} Rating`
          const numericValue = row?.[dbColumnName]
          if (typeof numericValue === 'number' && !isNaN(numericValue)) {
            directValue = numericValue
            made = numericValue
            hasData = true
          }
        }
        
        if (!hasData) {
          const numericValue = row?.[field]
          if (typeof numericValue === 'number' && !isNaN(numericValue)) {
            directValue = numericValue
            made = numericValue
            hasData = true
          } else if (typeof numericValue === 'boolean') {
            directValue = numericValue ? 1 : 0
            made = directValue
            hasData = true
          }
        }

        const attempts = made + missed

        return {
          match: getRowMatchNumber(row),
          attempts: hasData ? (directValue ?? attempts) : null,
          successRate: hasData && directValue === null && attempts > 0 ? (made / attempts) * 100 : null,
          made: hasData ? made : null,
          team,
        }
      })
    }
    return result
  }

  const chartDataByTeam = buildStatChartData(matchRows, selectedStat)
  
  const hasAny = selectedTeams.some(team =>
    (chartDataByTeam[team] || []).some(row => 
      row.attempts !== null || row.successRate !== null || row.made !== null
    )
  )
  
  if (!hasAny) {
    return <p>No numeric data for field "{selectedStat}".</p>
  }

  return (
    <>
      <AttemptsChart chartDataByTeam={chartDataByTeam} selectedTeams={selectedTeams} />
      <SuccessRateChart chartDataByTeam={chartDataByTeam} selectedTeams={selectedTeams} />
      <MadeChart chartDataByTeam={chartDataByTeam} selectedTeams={selectedTeams} />
    </>
  )
}

StatCharts.propTypes = {
  matchRows: PropTypes.array.isRequired,
  selectedTeams: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedStat: PropTypes.string.isRequired
}

export default StatCharts
