import { executeWithPermission } from '../utils/permissions'
import { useTeamData } from '../hooks/useTeamData'
import { useSelectedTeams } from '../hooks/useLocalStorage'
import TeamSelector from '../components/TeamSelector'
import Loading from '../components/Loading'
import { updateMatchUseData } from '../utils/offlineMutations'
import { toast } from 'sonner'

function TeamData() {
  const [selectedTeams, setSelectedTeams] = useSelectedTeams('selectedTeamsAnalysis', [])
  const safeSelectedTeams = Array.isArray(selectedTeams) ? selectedTeams : []
  const { allTeams, matchRows, loading, setMatchRows } = useTeamData(safeSelectedTeams, true)

  const handleTeamToggle = (teamNumber) => {
    const teamStr = String(teamNumber)
    setSelectedTeams(prev => {
      const prevArray = Array.isArray(prev) ? prev : []
      if (prevArray.includes(teamStr)) {
        return prevArray.filter(t => t !== teamStr)
      }
      return [...prevArray, teamStr]
    })
  }

  const clearAllTeams = () => {
    setSelectedTeams([])
  }

  const handleUseDataChange = async (scoutingId, checked) => {
    console.log('handleUseDataChange called:', { scoutingId, checked })
    try {
      await executeWithPermission(async () => {
        console.log('Permission granted, updating database (or queueing if offline)...')
        const result = await updateMatchUseData({ scoutingId, value: checked })
        if (result?.error) {
          console.error('Error updating Use Data:', result.error)
          toast.error('Could not update "Use Data".')
          return
        }

        setMatchRows(prevRows =>
          prevRows.map(row =>
            row["Scouting ID"] === scoutingId ? { ...row, 'Use Data': checked } : row
          )
        )

        if (result.queued) {
          console.log('Update queued for later sync')
          toast.message('Saved offline', { description: 'Change queued and will sync when online.' })
        } else {
          console.log('Database updated successfully')
          toast.success('Saved', { description: '"Use Data" updated.' })
        }
      })
    } catch (error) {
      console.log('Permission denied or error:', error.message)
    }
  }

  const getTeamDisplayText = () => {
    if (selectedTeams.length === 0) return 'No Teams'
    if (selectedTeams.length === 1) return `Team ${selectedTeams[0]}`
    return `${selectedTeams.length} Teams`
  }

  const EXCLUDED_COLUMNS = ['Use Data', 'team', 'Scouting ID', 'Shot Coordinates']

  return (
    <div>
      <h1>Team Data</h1>

      <TeamSelector
        allTeams={allTeams}
        selectedTeams={selectedTeams}
        onTeamToggle={handleTeamToggle}
        onClearAll={clearAllTeams}
        title="Select Teams to View"
      />

      <div style={{ marginTop: '2rem' }}>
        <h2>Matches for {getTeamDisplayText()}</h2>
        {loading ? (
          <Loading message="Loading matches..." />
        ) : matchRows.length === 0 ? (
          <p>No matches found.</p>
        ) : (
          <div className="team-data-container">
            {selectedTeams.map(team => {
              const teamRows = matchRows.filter(row => String(row.team) === String(team))
              if (teamRows.length === 0) return null
              const visibleCols = Object.keys(teamRows[0]).filter(
                col => !EXCLUDED_COLUMNS.includes(col)
              )

              return (
                <div key={team} className="team-data-table-section">
                  <h3 className="team-header">Team {team}</h3>
                  <div className="team-data-table-container">
                    <table style={{ width: 'max-content', minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th className="sticky-column">Use Data</th>
                          <th className="second-column">Scouting ID</th>
                          {visibleCols.map(col => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {teamRows.map((row, idx) => (
                          <tr key={row["Scouting ID"] ?? row.id ?? idx}>
                            <td className="sticky-column">
                              <input
                                type="checkbox"
                                checked={!!row['Use Data']}
                                onChange={e => handleUseDataChange(row["Scouting ID"], e.target.checked)}
                              />
                            </td>
                            <td className="second-column">
                              {String(row['Scouting ID'] || '')}
                            </td>
                            {visibleCols.map(col => {
                              let val = row[col]
                              if (typeof val === 'boolean' || val === null) {
                                val = String(val)
                              }
                              const displayVal = String(val)
                              return (
                                <td key={col} title={displayVal}>
                                  {displayVal}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default TeamData