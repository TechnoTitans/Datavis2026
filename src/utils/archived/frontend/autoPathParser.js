/**
 * Auto Path Parser Utility
 * 
 * Parses auto path notation strings into structured scoring data.
 * 
 * Notation System:
 * - A1-L4: Coral scoring positions (A1=L1, B4=L4, etc.)
 * - P: Processor
 * - N: Net
 * - M: Missed suffix (e.g., A1M = missed L1, PM = missed Processor)
 * - LEAVE: Opponent left prefix
 * - CS1/CS2: Coral stations
 * 
 * Example: "A1B4MP2NM" = L1 scored, L4 scored, Processor missed, P2 scored, Net missed
 */

// Position mapping: letter+number to coral level
const POSITION_TO_CORAL = {
  'A1': 'L1', 'A2': 'L2', 'A3': 'L3', 'A4': 'L4',
  'B1': 'L1', 'B2': 'L2', 'B3': 'L3', 'B4': 'L4',
  'C1': 'L1', 'C2': 'L2', 'C3': 'L3', 'C4': 'L4',
  'D1': 'L1', 'D2': 'L2', 'D3': 'L3', 'D4': 'L4',
  'E1': 'L1', 'E2': 'L2', 'E3': 'L3', 'E4': 'L4',
  'F1': 'L1', 'F2': 'L2', 'F3': 'L3', 'F4': 'L4',
  'G1': 'L1', 'G2': 'L2', 'G3': 'L3', 'G4': 'L4',
  'H1': 'L1', 'H2': 'L2', 'H3': 'L3', 'H4': 'L4',
  'I1': 'L1', 'I2': 'L2', 'I3': 'L3', 'I4': 'L4',
  'J1': 'L1', 'J2': 'L2', 'J3': 'L3', 'J4': 'L4',
  'K1': 'L1', 'K2': 'L2', 'K3': 'L3', 'K4': 'L4',
  'L1': 'L1', 'L2': 'L2', 'L3': 'L3', 'L4': 'L4'
}

/**
 * Parse a single auto path string into structured scoring data
 * @param {string} autoPath - The auto path notation string
 * @returns {Object} Parsed scoring data with counts and missed counts
 */
export function parseAutoPath(autoPath) {
  if (!autoPath || typeof autoPath !== 'string') {
    return {
      L1: 0, L2: 0, L3: 0, L4: 0,
      Processor: 0, Net: 0,
      L1_missed: 0, L2_missed: 0, L3_missed: 0, L4_missed: 0,
      Processor_missed: 0, Net_missed: 0,
      opponentLeft: false,
      coralStations: []
    }
  }

  const result = {
    L1: 0, L2: 0, L3: 0, L4: 0,
    Processor: 0, Net: 0,
    L1_missed: 0, L2_missed: 0, L3_missed: 0, L4_missed: 0,
    Processor_missed: 0, Net_missed: 0,
    opponentLeft: false,
    coralStations: []
  }

  // Check for LEAVE prefix
  let path = autoPath.trim()
  if (path.startsWith('LEAVE')) {
    result.opponentLeft = true
    path = path.substring(5)
  }

  // Check for coral stations (CS1, CS2)
  const csMatches = path.match(/CS[12]/g)
  if (csMatches) {
    result.coralStations = csMatches
    // Remove CS patterns from path for further processing
    path = path.replace(/CS[12]/g, '')
  }

  // Process remaining tokens sequentially - check misses first, then successes
  let i = 0
  while (i < path.length) {
    let matched = false

    // Try to match Processor miss patterns first (PM only - P doesn't have numbered levels)
    if (path.substring(i, i + 2) === 'PM') {
      result.Processor_missed++
      i += 2
      matched = true
    }

    // Try to match Net miss pattern (NM)
    if (!matched && path.substring(i, i + 2) === 'NM') {
      result.Net_missed++
      i += 2
      matched = true
    }

    // Try to match position with miss (A1M, B4M, etc.)
    if (!matched) {
      const positionMissMatch = path.substring(i).match(/^([A-L])([1-4])M/)
      if (positionMissMatch) {
        const [fullMatch, letter, number] = positionMissMatch
        const position = letter + number
        const coralLevel = POSITION_TO_CORAL[position]
        
        if (coralLevel) {
          result[coralLevel + '_missed']++
          i += fullMatch.length
          matched = true
        }
      }
    }

    // Try to match Processor patterns (P only - no numbered levels)
    if (!matched && path.charAt(i) === 'P' && path.charAt(i + 1) !== 'M') {
      result.Processor++
      i += 1
      matched = true
    }

    // Try to match Net pattern (N but not NM)
    if (!matched && path.charAt(i) === 'N' && path.charAt(i + 1) !== 'M') {
      result.Net++
      i += 1
      matched = true
    }

    // Try to match position patterns (A1, B4, etc.)
    if (!matched) {
      const positionMatch = path.substring(i).match(/^([A-L])([1-4])(?!M)/)
      if (positionMatch) {
        const [fullMatch, letter, number] = positionMatch
        const position = letter + number
        const coralLevel = POSITION_TO_CORAL[position]
        
        if (coralLevel) {
          result[coralLevel]++
          i += fullMatch.length
          matched = true
        }
      }
    }

    // If nothing matched, skip the character
    if (!matched) {
      i++
    }
  }

  return result
}

/**
 * Parse multiple auto path strings and aggregate the results
 * @param {Array<string>} autoPaths - Array of auto path notation strings
 * @returns {Object} Aggregated scoring data
 */
export function parseMultipleAutoPaths(autoPaths) {
  if (!Array.isArray(autoPaths)) {
    return parseAutoPath('')
  }

  const aggregated = {
    L1: 0, L2: 0, L3: 0, L4: 0,
    Processor: 0, Net: 0,
    L1_missed: 0, L2_missed: 0, L3_missed: 0, L4_missed: 0,
    Processor_missed: 0, Net_missed: 0,
    opponentLeft: 0, // Count of matches where opponent left
    coralStations: []
  }

  autoPaths.forEach(path => {
    const parsed = parseAutoPath(path)
    
    // Add scored counts
    aggregated.L1 += parsed.L1
    aggregated.L2 += parsed.L2
    aggregated.L3 += parsed.L3
    aggregated.L4 += parsed.L4
    aggregated.Processor += parsed.Processor
    aggregated.Net += parsed.Net
    
    // Add missed counts
    aggregated.L1_missed += parsed.L1_missed
    aggregated.L2_missed += parsed.L2_missed
    aggregated.L3_missed += parsed.L3_missed
    aggregated.L4_missed += parsed.L4_missed
    aggregated.Processor_missed += parsed.Processor_missed
    aggregated.Net_missed += parsed.Net_missed
    
    // Count opponent leaves
    if (parsed.opponentLeft) {
      aggregated.opponentLeft++
    }
    
    // Collect all coral stations
    aggregated.coralStations.push(...parsed.coralStations)
  })

  return aggregated
}

/**
 * Get auto scoring statistics with success rates
 * @param {Object} parsedData - Result from parseAutoPath or parseMultipleAutoPaths
 * @returns {Object} Statistics including attempts, successes, and success rates
 */
export function getAutoStatistics(parsedData) {
  const stats = {}
  
  const levels = ['L1', 'L2', 'L3', 'L4', 'Processor', 'Net']
  
  levels.forEach(level => {
    const scored = parsedData[level] || 0
    const missed = parsedData[level + '_missed'] || 0
    const attempts = scored + missed
    const successRate = attempts > 0 ? (scored / attempts) * 100 : 0
    
    stats[level] = {
      scored,
      missed,
      attempts,
      successRate: Math.round(successRate * 100) / 100 // Round to 2 decimal places
    }
  })
  
  return stats
}

/**
 * Convert auto path data to match the format expected by existing analysis functions
 * @param {Object} parsedData - Result from parseAutoPath or parseMultipleAutoPaths
 * @returns {Object} Data formatted for integration with teleop calculations
 */
export function convertToAnalysisFormat(parsedData) {
  return {
    'Auto L1': parsedData.L1 || 0,
    'Auto L2': parsedData.L2 || 0,
    'Auto L3': parsedData.L3 || 0,
    'Auto L4': parsedData.L4 || 0,
    'Auto Processor': parsedData.Processor || 0,
    'Auto Net': parsedData.Net || 0,
    'Auto L1 Missed': parsedData.L1_missed || 0,
    'Auto L2 Missed': parsedData.L2_missed || 0,
    'Auto L3 Missed': parsedData.L3_missed || 0,
    'Auto L4 Missed': parsedData.L4_missed || 0,
    'Auto Processor Missed': parsedData.Processor_missed || 0,
    'Auto Net Missed': parsedData.Net_missed || 0
  }
}

/**
 * Test function to validate parser with example inputs
 */
export function testParser() {
  const testCases = [
    'A1B4MP2NM',
    'LEAVEA1A2A3',
    'CS1A1B2CS2',
    'P1P2P3NNM',
    'A4B4C4D4L4',
    ''
  ]
  
  console.log('Auto Path Parser Test Results:')
  testCases.forEach(testCase => {
    const result = parseAutoPath(testCase)
    console.log(`Input: "${testCase}"`)
    console.log('Result:', result)
    console.log('Statistics:', getAutoStatistics(result))
    console.log('Analysis Format:', convertToAnalysisFormat(result))
    console.log('---')
  })
}
