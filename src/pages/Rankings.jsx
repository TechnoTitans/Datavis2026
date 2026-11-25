import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Loading from '../components/Loading'
import Toggle from '../components/Toggle'
import { useLocalStorage } from '../hooks/usePreferences.js'
import { useDataTable } from '../hooks/useAppData.js'
import '../styles/tables.css'

function Rankings() {
  const navigate = useNavigate()
  
  // State management with custom hooks
  const [sortBy, setSortBy] = useLocalStorage('rankingsSortBy', 'avgCycles')
  const [sortOrder, setSortOrder] = useLocalStorage('rankingsSortOrder', 'desc')
  const [useAttempts, setUseAttempts] = useLocalStorage('rankingsUseAttempts', false)
  const [useMax, setUseMax] = useLocalStorage('rankingsUseMax', false)
  
  // We need to modify this to get all match data
  const { rows: matchRows, loading: dataLoading, error } = useDataTable('match_data')

  // Custom effect to fetch all match data since useTeamData doesn't work with empty array


  const allMatchRows = useMemo(() => matchRows.filter(row => row['Use Data'] === true || row['Use Data'] === 'true'), [matchRows])

  // Calculate team statistics from match data
  const teamStats = useMemo(() => {
    if (!allMatchRows || allMatchRows.length === 0) return []

    const teamStatsMap = new Map()

    allMatchRows.forEach(match => {
      const teamNumber = match['Scouting ID']?.split('_')[1]
      if (!teamNumber) return

      if (!teamStatsMap.has(teamNumber)) {
        teamStatsMap.set(teamNumber, {
          teamNumber: parseInt(teamNumber),
          matchCount: 0,
          avgCycles: 0,
          avgCoralCycles: 0,
          avgAlgaeCycles: 0,
          avgL4: 0,
          avgL3: 0,
          avgL2: 0,
          avgL1: 0,
          avgProcessor: 0,
          avgNet: 0,
          avgDriverQuality: 0,
          avgDefenseAbility: 0,
          avgMechanicalReliability: 0,
          avgAlgaeDescorability: 0,
          maxCycles: 0,
          maxCoralCycles: 0,
          maxAlgaeCycles: 0,
          maxL4: 0,
          maxL3: 0,
          maxL2: 0,
          maxL1: 0,
          maxProcessor: 0,
          maxNet: 0,
          maxDriverQuality: 0,
          maxDefenseAbility: 0,
          maxMechanicalReliability: 0,
          maxAlgaeDescorability: 0,
          totalMissed: 0,
          accuracy: 0,
          maxAccuracy: 0,
          endgameAverage: 0,
          maxEndgame: 0,
          endgameStats: {
            hanging: 0,
            parking: 0,
            none: 0
          }
        })
      }

      const team = teamStatsMap.get(teamNumber)
      team.matchCount++

      const l4Count = useAttempts ? (match['L4 Count'] || 0) + (match['L4 Missed Count'] || 0) : (match['L4 Count'] || 0)
      const l3Count = useAttempts ? (match['L3 Count'] || 0) + (match['L3 Missed Count'] || 0) : (match['L3 Count'] || 0)
      const l2Count = useAttempts ? (match['L2 Count'] || 0) + (match['L2 Missed Count'] || 0) : (match['L2 Count'] || 0)
      const l1Count = useAttempts ? (match['L1 Count'] || 0) + (match['L1 Missed Count'] || 0) : (match['L1 Count'] || 0)
      const processorCount = useAttempts ? (match['Processor Count'] || 0) + (match['Processor Missed Count'] || 0) : (match['Processor Count'] || 0)
      const netCount = useAttempts ? (match['Net Count'] || 0) + (match['Net Missed Count'] || 0) : (match['Net Count'] || 0)

      const coralCycles = l4Count + l3Count + l2Count + l1Count
      const algaeCycles = processorCount + netCount
      const totalCycles = coralCycles + algaeCycles

      team.avgCycles += totalCycles
      team.avgCoralCycles += coralCycles
      team.avgAlgaeCycles += algaeCycles

      team.avgL4 += l4Count
      team.avgL3 += l3Count
      team.avgL2 += l2Count
      team.avgL1 += l1Count
      team.avgProcessor += processorCount
      team.avgNet += netCount

      team.avgDriverQuality += match['Driver Quality'] || 0
      team.avgDefenseAbility += match['Defense Ability'] || 0
      team.avgMechanicalReliability += match['Mechanical Reliability'] || 0
      team.avgAlgaeDescorability += match['Algae Descorability'] || 0

      // Track max values
      team.maxCycles = Math.max(team.maxCycles, totalCycles)
      team.maxCoralCycles = Math.max(team.maxCoralCycles, coralCycles)
      team.maxAlgaeCycles = Math.max(team.maxAlgaeCycles, algaeCycles)
      team.maxL4 = Math.max(team.maxL4, l4Count)
      team.maxL3 = Math.max(team.maxL3, l3Count)
      team.maxL2 = Math.max(team.maxL2, l2Count)
      team.maxL1 = Math.max(team.maxL1, l1Count)
      team.maxProcessor = Math.max(team.maxProcessor, processorCount)
      team.maxNet = Math.max(team.maxNet, netCount)
      team.maxDriverQuality = Math.max(team.maxDriverQuality, match['Driver Quality'] || 0)
      team.maxDefenseAbility = Math.max(team.maxDefenseAbility, match['Defense Ability'] || 0)
      team.maxMechanicalReliability = Math.max(team.maxMechanicalReliability, match['Mechanical Reliability'] || 0)
      team.maxAlgaeDescorability = Math.max(team.maxAlgaeDescorability, match['Algae Descorability'] || 0)

      const totalShots = (match['L4 Count'] || 0) + (match['L3 Count'] || 0) + 
                        (match['L2 Count'] || 0) + (match['L1 Count'] || 0) + 
                        (match['Processor Count'] || 0) + (match['Net Count'] || 0)
      const totalMissed = (match['L4 Missed Count'] || 0) + (match['L3 Missed Count'] || 0) + 
                         (match['L2 Missed Count'] || 0) + (match['L1 Missed Count'] || 0) + 
                         (match['Processor Missed Count'] || 0) + (match['Net Missed Count'] || 0)
      
      team.totalMissed += totalMissed

      // Calculate accuracy for this match
      const matchAttempts = totalShots + totalMissed
      const matchAccuracy = matchAttempts > 0 ? (totalShots / matchAttempts * 100) : 0
      team.maxAccuracy = Math.max(team.maxAccuracy, matchAccuracy)

      const endgame = match['Endgame Position']?.toLowerCase()
      let endgamePoints = 0
      
      if (endgame?.includes('deep') && endgame?.includes('cage')) {
        endgamePoints = 12
        team.endgameStats.hanging++
      } else if (endgame?.includes('shallow') && endgame?.includes('cage')) {
        endgamePoints = 6
        team.endgameStats.hanging++
      } else if (endgame?.includes('park')) {
        endgamePoints = 3
        team.endgameStats.parking++
      } else {
        endgamePoints = 0
        team.endgameStats.none++
      }

      team.endgameAverage += endgamePoints
      team.maxEndgame = Math.max(team.maxEndgame, endgamePoints)
    })

    // Convert to array and calculate final averages
    const statsArray = Array.from(teamStatsMap.values()).map(team => {
      const count = team.matchCount || 1
      return {
        ...team,
        avgCycles: useMax ? team.maxCycles : (team.avgCycles / count),
        avgCoralCycles: useMax ? team.maxCoralCycles : (team.avgCoralCycles / count),
        avgAlgaeCycles: useMax ? team.maxAlgaeCycles : (team.avgAlgaeCycles / count),
        avgL4: useMax ? team.maxL4 : (team.avgL4 / count),
        avgL3: useMax ? team.maxL3 : (team.avgL3 / count),
        avgL2: useMax ? team.maxL2 : (team.avgL2 / count),
        avgL1: useMax ? team.maxL1 : (team.avgL1 / count),
        avgProcessor: useMax ? team.maxProcessor : (team.avgProcessor / count),
        avgNet: useMax ? team.maxNet : (team.avgNet / count),
        avgDriverQuality: useMax ? team.maxDriverQuality : (team.avgDriverQuality / count),
        avgDefenseAbility: useMax ? team.maxDefenseAbility : (team.avgDefenseAbility / count),
        avgMechanicalReliability: useMax ? team.maxMechanicalReliability : (team.avgMechanicalReliability / count),
        avgAlgaeDescorability: useMax ? team.maxAlgaeDescorability : (team.avgAlgaeDescorability / count),
        endgameAverage: useMax ? team.maxEndgame : (team.endgameAverage / count),
        accuracy: useMax ? team.maxAccuracy : ((team.avgCycles * count) / (team.avgCycles * count + team.totalMissed) * 100 || 0)
      }
    })

    return statsArray
  }, [allMatchRows, useAttempts, useMax])

  const handleSort = (stat) => {
    if (sortBy === stat) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(stat)
      setSortOrder('desc')
    }
  }

  const handleTeamClick = (teamNumber) => {
    localStorage.setItem('selectedTeamsAnalysis', JSON.stringify([String(teamNumber)]))
    navigate('/team-data')
  }

  const sortedTeams = [...teamStats].sort((a, b) => {
    let aValue = a[sortBy]
    let bValue = b[sortBy]

    if (sortBy === 'teamNumber') {
      aValue = parseInt(a.teamNumber)
      bValue = parseInt(b.teamNumber)
    }

    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : bValue < aValue ? -1 : 0
    } else {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
    }
  })

  const getSortIcon = (stat) => {
    if (sortBy !== stat) return '↕️'
    return sortOrder === 'desc' ? '↓' : '↑'
  }

  if (dataLoading) {
    return (
      <div className="rankings-container">
        <h2>Rankings</h2>
        <Loading />
      </div>
    )
  }

  if (error) return <p role="alert">{error}</p>

  return (
    <div className="rankings-container">
      <h2>Team Rankings</h2>
      <div className="rankings-controls">
        <Toggle
          label="Show All Attempts (Made + Missed)"
          checked={useAttempts}
          onChange={(e) => setUseAttempts(e.target.checked)}
        />
        <Toggle
          label="Show Max Values (instead of Average)"
          checked={useMax}
          onChange={(e) => setUseMax(e.target.checked)}
        />
      </div>
      {teamStats.length === 0 ? (
        <p>No team data available. Upload some match data first!</p>
      ) : (
        <div className="rankings-table-container">
          <table className="rankings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th onClick={() => handleSort('teamNumber')} className="sortable">
                  Team {getSortIcon('teamNumber')}
                </th>
                {sortBy !== 'teamNumber' && (
                  <th onClick={() => handleSort(sortBy)} className="sortable rankings-current-sort-header">
                    {sortBy === 'avgCycles' && `${useMax ? 'Max' : 'Avg'} Cycles ${getSortIcon('avgCycles')}`}
                    {sortBy === 'avgCoralCycles' && `${useMax ? 'Max' : 'Avg'} Coral Cycles ${getSortIcon('avgCoralCycles')}`}
                    {sortBy === 'avgAlgaeCycles' && `${useMax ? 'Max' : 'Avg'} Algae Cycles ${getSortIcon('avgAlgaeCycles')}`}
                    {sortBy === 'avgL4' && `${useMax ? 'Max' : 'Avg'} L4 ${getSortIcon('avgL4')}`}
                    {sortBy === 'avgL3' && `${useMax ? 'Max' : 'Avg'} L3 ${getSortIcon('avgL3')}`}
                    {sortBy === 'avgL2' && `${useMax ? 'Max' : 'Avg'} L2 ${getSortIcon('avgL2')}`}
                    {sortBy === 'avgL1' && `${useMax ? 'Max' : 'Avg'} L1 ${getSortIcon('avgL1')}`}
                    {sortBy === 'avgProcessor' && `${useMax ? 'Max' : 'Avg'} Processor ${getSortIcon('avgProcessor')}`}
                    {sortBy === 'avgNet' && `${useMax ? 'Max' : 'Avg'} Net ${getSortIcon('avgNet')}`}
                    {sortBy === 'accuracy' && `${useMax ? 'Max' : 'Avg'} Accuracy % ${getSortIcon('accuracy')}`}
                    {sortBy === 'endgameAverage' && `${useMax ? 'Max' : 'Avg'} Endgame ${getSortIcon('endgameAverage')}`}
                    {sortBy === 'avgDriverQuality' && `${useMax ? 'Max' : 'Avg'} Driver ${getSortIcon('avgDriverQuality')}`}
                    {sortBy === 'avgDefenseAbility' && `${useMax ? 'Max' : 'Avg'} Defense ${getSortIcon('avgDefenseAbility')}`}
                    {sortBy === 'avgMechanicalReliability' && `${useMax ? 'Max' : 'Avg'} Reliability ${getSortIcon('avgMechanicalReliability')}`}
                  </th>
                )}
                {sortBy !== 'avgCycles' && (
                  <th onClick={() => handleSort('avgCycles')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Cycles {getSortIcon('avgCycles')}
                  </th>
                )}
                {sortBy !== 'avgCoralCycles' && (
                  <th onClick={() => handleSort('avgCoralCycles')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Coral Cycles {getSortIcon('avgCoralCycles')}
                  </th>
                )}
                {sortBy !== 'avgAlgaeCycles' && (
                  <th onClick={() => handleSort('avgAlgaeCycles')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Algae Cycles {getSortIcon('avgAlgaeCycles')}
                  </th>
                )}
                {sortBy !== 'avgL4' && (
                  <th onClick={() => handleSort('avgL4')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} L4 {getSortIcon('avgL4')}
                  </th>
                )}
                {sortBy !== 'avgL3' && (
                  <th onClick={() => handleSort('avgL3')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} L3 {getSortIcon('avgL3')}
                  </th>
                )}
                {sortBy !== 'avgL2' && (
                  <th onClick={() => handleSort('avgL2')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} L2 {getSortIcon('avgL2')}
                  </th>
                )}
                {sortBy !== 'avgL1' && (
                  <th onClick={() => handleSort('avgL1')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} L1 {getSortIcon('avgL1')}
                  </th>
                )}
                {sortBy !== 'avgProcessor' && (
                  <th onClick={() => handleSort('avgProcessor')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Processor {getSortIcon('avgProcessor')}
                  </th>
                )}
                {sortBy !== 'avgNet' && (
                  <th onClick={() => handleSort('avgNet')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Net {getSortIcon('avgNet')}
                  </th>
                )}
                {sortBy !== 'accuracy' && (
                  <th onClick={() => handleSort('accuracy')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Accuracy % {getSortIcon('accuracy')}
                  </th>
                )}
                {sortBy !== 'endgameAverage' && (
                  <th onClick={() => handleSort('endgameAverage')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Endgame {getSortIcon('endgameAverage')}
                  </th>
                )}
                {sortBy !== 'avgDriverQuality' && (
                  <th onClick={() => handleSort('avgDriverQuality')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Driver {getSortIcon('avgDriverQuality')}
                  </th>
                )}
                {sortBy !== 'avgDefenseAbility' && (
                  <th onClick={() => handleSort('avgDefenseAbility')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Defense {getSortIcon('avgDefenseAbility')}
                  </th>
                )}
                {sortBy !== 'avgMechanicalReliability' && (
                  <th onClick={() => handleSort('avgMechanicalReliability')} className="sortable">
                    {useMax ? 'Max' : 'Avg'} Reliability {getSortIcon('avgMechanicalReliability')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, index) => (
                <tr key={team.teamNumber}>
                  <td className="rank-cell">
                    <strong>#{index + 1}</strong>
                  </td>
                  <td 
                    className="team-cell team-cell-link" 
                    onClick={() => handleTeamClick(team.teamNumber)}
                  >
                    <strong>{team.teamNumber}</strong>
                  </td>
                  {sortBy !== 'teamNumber' && (
                    <td className="rankings-current-sort-cell">
                      <strong>
                        {sortBy === 'avgCycles' && team.avgCycles.toFixed(2)}
                        {sortBy === 'avgCoralCycles' && team.avgCoralCycles.toFixed(2)}
                        {sortBy === 'avgAlgaeCycles' && team.avgAlgaeCycles.toFixed(2)}
                        {sortBy === 'avgL4' && team.avgL4.toFixed(2)}
                        {sortBy === 'avgL3' && team.avgL3.toFixed(2)}
                        {sortBy === 'avgL2' && team.avgL2.toFixed(2)}
                        {sortBy === 'avgL1' && team.avgL1.toFixed(2)}
                        {sortBy === 'avgProcessor' && team.avgProcessor.toFixed(2)}
                        {sortBy === 'avgNet' && team.avgNet.toFixed(2)}
                        {sortBy === 'accuracy' && `${team.accuracy.toFixed(2)}%`}
                        {sortBy === 'endgameAverage' && team.endgameAverage.toFixed(2)}
                        {sortBy === 'avgDriverQuality' && team.avgDriverQuality.toFixed(2)}
                        {sortBy === 'avgDefenseAbility' && team.avgDefenseAbility.toFixed(2)}
                        {sortBy === 'avgMechanicalReliability' && team.avgMechanicalReliability.toFixed(2)}
                      </strong>
                    </td>
                  )}
                  {sortBy !== 'avgCycles' && <td><strong>{team.avgCycles.toFixed(2)}</strong></td>}
                  {sortBy !== 'avgCoralCycles' && <td><strong>{team.avgCoralCycles.toFixed(2)}</strong></td>}
                  {sortBy !== 'avgAlgaeCycles' && <td><strong>{team.avgAlgaeCycles.toFixed(2)}</strong></td>}
                  {sortBy !== 'avgL4' && <td>{team.avgL4.toFixed(2)}</td>}
                  {sortBy !== 'avgL3' && <td>{team.avgL3.toFixed(2)}</td>}
                  {sortBy !== 'avgL2' && <td>{team.avgL2.toFixed(2)}</td>}
                  {sortBy !== 'avgL1' && <td>{team.avgL1.toFixed(2)}</td>}
                  {sortBy !== 'avgProcessor' && <td>{team.avgProcessor.toFixed(2)}</td>}
                  {sortBy !== 'avgNet' && <td>{team.avgNet.toFixed(2)}</td>}
                  {sortBy !== 'accuracy' && <td>{team.accuracy.toFixed(2)}%</td>}
                  {sortBy !== 'endgameAverage' && <td>{team.endgameAverage.toFixed(2)}</td>}
                  {sortBy !== 'avgDriverQuality' && <td>{team.avgDriverQuality.toFixed(2)}</td>}
                  {sortBy !== 'avgDefenseAbility' && <td>{team.avgDefenseAbility.toFixed(2)}</td>}
                  {sortBy !== 'avgMechanicalReliability' && <td>{team.avgMechanicalReliability.toFixed(2)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Rankings
