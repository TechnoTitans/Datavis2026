import { useMemo } from 'react'
import { SCORING_LEVELS, CORAL_LEVELS, ALGAE_LEVELS } from '../constants/scoring'

/**
 * Custom hook for calculating team summary statistics
 * @param {Array} matchRows - Array of match data
 * @param {boolean} useMaxValues - Whether to use max values instead of averages
 * @returns {Object} - Summary statistics by team
 */
export const useTeamSummary = (matchRows, useMaxValues) => {
  return useMemo(() => {
    if (!matchRows.length) return {}

    // Group data by team first
    const dataByTeam = {}
    for (const row of matchRows) {
      const team = row.team ?? 'Unknown'
      if (!dataByTeam[team]) dataByTeam[team] = []
      dataByTeam[team].push(row)
    }

    const summaryByTeam = {}
    
    for (const [team, teamRows] of Object.entries(dataByTeam)) {
      if (!teamRows.length) continue
      
      const columns = Object.keys(teamRows[0])
      const summaryResult = {}

      // missedCols is Set of missed columns
      const missedCols = new Set(SCORING_LEVELS.map(level => level.missed))

      // Calculate coral, algae, and total cycles
      let coralMade = 0, coralMissed = 0
      let algaeMade = 0, algaeMissed = 0
      let maxCoralCycles = 0, maxAlgaeCycles = 0
      
      for (const row of teamRows) {
        let rowCoralMade = 0, rowCoralMissed = 0
        let rowAlgaeMade = 0, rowAlgaeMissed = 0
        
        // Calculate coral scores
        for (const level of CORAL_LEVELS) {
          if (typeof row[level.made] === 'number' && !isNaN(row[level.made])) {
            coralMade += row[level.made]
            rowCoralMade += row[level.made]
          }
          if (typeof row[level.missed] === 'number' && !isNaN(row[level.missed])) {
            coralMissed += row[level.missed]
            rowCoralMissed += row[level.missed]
          }
        }
        
        // Calculate algae scores
        for (const level of ALGAE_LEVELS) {
          if (typeof row[level.made] === 'number' && !isNaN(row[level.made])) {
            algaeMade += row[level.made]
            rowAlgaeMade += row[level.made]
          }
          if (typeof row[level.missed] === 'number' && !isNaN(row[level.missed])) {
            algaeMissed += row[level.missed]
            rowAlgaeMissed += row[level.missed]
          }
        }
        
        maxCoralCycles = Math.max(maxCoralCycles, rowCoralMade + rowCoralMissed)
        maxAlgaeCycles = Math.max(maxAlgaeCycles, rowAlgaeMade + rowAlgaeMissed)
      }
      
      const totalCoralCycles = coralMade + coralMissed
      const totalAlgaeCycles = algaeMade + algaeMissed
      const numRows = teamRows.length

      // Calculate cycle summaries
      summaryResult['Coral Cycles'] = calculateCycleSummary(
        teamRows, CORAL_LEVELS, totalCoralCycles, maxCoralCycles, 
        coralMade, coralMissed, numRows, useMaxValues
      )

      summaryResult['Algae Cycles'] = calculateCycleSummary(
        teamRows, ALGAE_LEVELS, totalAlgaeCycles, maxAlgaeCycles, 
        algaeMade, algaeMissed, numRows, useMaxValues
      )

      const totalCycles = totalCoralCycles + totalAlgaeCycles
      const totalMade = coralMade + algaeMade
      const totalMissed = coralMissed + algaeMissed
      const maxTotalCycles = maxCoralCycles + maxAlgaeCycles
      
      summaryResult['Total Cycles'] = calculateCycleSummary(
        teamRows, [...CORAL_LEVELS, ...ALGAE_LEVELS], totalCycles, maxTotalCycles, 
        totalMade, totalMissed, numRows, useMaxValues
      )

      // Calculate individual scoring level summaries
      for (const col of columns) {
        if (missedCols.has(col)) continue

        const scoringLevel = SCORING_LEVELS.find(level => level.made === col)
        if (scoringLevel) {
          summaryResult[col] = calculateScoringLevelSummary(
            teamRows, scoringLevel, useMaxValues
          )
          continue
        }

        // Handle special cases
        if (col === 'Use Data') {
          summaryResult[col] = calculateUseDataSummary(matchRows, team)
          continue
        }
        
        // Remove shotmap fields
        if (col === 'Shot Coordinates') continue
        
        // Handle other columns
        summaryResult[col] = calculateOtherColumnSummary(teamRows, col)
      }

      summaryByTeam[team] = summaryResult
    }
    
    return summaryByTeam
  }, [matchRows, useMaxValues])
}

// Helper functions
const calculateCycleSummary = (teamRows, levels, totalCycles, maxCycles, totalMade, totalMissed, numRows, useMaxValues) => {
  if (totalCycles > 0 || maxCycles > 0) {
    const success = useMaxValues ? 
      Math.max(...teamRows.map(row => {
        const made = levels.reduce((sum, level) => sum + (row[level.made] || 0), 0)
        const missed = levels.reduce((sum, level) => sum + (row[level.missed] || 0), 0)
        const total = made + missed
        return total > 0 ? (made / total) * 100 : 0
      })) :
      (totalCycles === 0 ? 0 : (totalMade / totalCycles) * 100)
    
    const displayCycles = useMaxValues ? maxCycles : (numRows > 0 ? totalCycles / numRows : 0)
    const displayMade = useMaxValues ? 
      Math.max(...teamRows.map(row => 
        levels.reduce((sum, level) => sum + (row[level.made] || 0), 0)
      )) : 
      (numRows > 0 ? totalMade / numRows : 0)
    
    return {
      type: 'scoring',
      avgAttempts: displayCycles,
      successRate: success.toFixed(1),
      average: useMaxValues ? displayMade : displayMade.toFixed(2),
      made: totalMade,
      missed: totalMissed,
    }
  } else {
    return {
      type: 'scoring',
      avgAttempts: 0,
      successRate: '0.0',
      average: '0.00',
      made: 0,
      missed: 0,
    }
  }
}

const calculateScoringLevelSummary = (teamRows, scoringLevel, useMaxValues) => {
  const madeVals = teamRows
    .map(r => r[scoringLevel.made])
    .filter(v => typeof v === 'number' && !isNaN(v))
  const missedVals = teamRows
    .map(r => r[scoringLevel.missed])
    .filter(v => typeof v === 'number' && !isNaN(v))

  const totalMade = madeVals.reduce((a, b) => a + b, 0)
  const totalMissed = missedVals.reduce((a, b) => a + b, 0)
  const totalAttempts = totalMade + totalMissed
  const numRows = teamRows.length
  
  const maxMade = madeVals.length > 0 ? Math.max(...madeVals) : 0
  const maxAttempts = teamRows.length > 0 ? Math.max(...teamRows.map(r => 
    (r[scoringLevel.made] || 0) + (r[scoringLevel.missed] || 0)
  )) : 0
  
  const avgMade = numRows > 0 ? totalMade / numRows : 0
  const avgAttempts = numRows > 0 ? totalAttempts / numRows : 0

  const successRate = useMaxValues ?
    (teamRows.length > 0 ? Math.max(...teamRows.map(r => {
      const made = r[scoringLevel.made] || 0
      const missed = r[scoringLevel.missed] || 0
      const attempts = made + missed
      return attempts > 0 ? (made / attempts) * 100 : 0
    })) : 0) :
    (totalAttempts > 0 ? (totalMade / totalAttempts) * 100 : 0)
    
  return {
    type: 'scoring',
    avgAttempts: useMaxValues ? maxAttempts : avgAttempts,
    successRate: successRate.toFixed(1),
    average: useMaxValues ? maxMade : avgMade.toFixed(2),
    made: totalMade,
  }
}

const calculateUseDataSummary = (matchRows, team) => {
  const teamMatchRows = matchRows.filter(row => row.team === team)
  const total = teamMatchRows.length
  const used = teamMatchRows.filter(row => row['Use Data'] === true).length
  const percent = total > 0 ? ((used / total) * 100).toFixed(1) : '0.0'
  return { type: 'number', value: percent }
}

const calculateOtherColumnSummary = (teamRows, col) => {
  const firstVal = teamRows.find(r => r[col] !== null && r[col] !== undefined)?.[col]
  if (firstVal === undefined) return null

  const isNumber = typeof firstVal === 'number' && !isNaN(firstVal)

  if (isNumber) {
    const nums = teamRows
      .map(r => r[col])
      .filter(v => typeof v === 'number' && !isNaN(v))
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length
    return { type: 'number', value: avg.toFixed(2) }
  } else {
    const freqMap = {}
    for (const row of teamRows) {
      const val = row[col]
      if (val === null || val === undefined) continue
      freqMap[val] = (freqMap[val] || 0) + 1
    }
    const entries = Object.entries(freqMap)
    if (!entries.length) return null

    entries.sort((a, b) => b[1] - a[1])
    const [modeVal, count] = entries[0]
    const percent = ((count / teamRows.length) * 100).toFixed(1)

    return { type: 'string', value: modeVal, percent }
  }
}
