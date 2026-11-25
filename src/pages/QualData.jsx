import { useMemo, useState } from 'react'
import { useDataTable } from '../hooks/useAppData.js'
import { useTeamData } from '../hooks/useScoutingData.js'
import { useSelectedTeams } from '../hooks/usePreferences.js'
import TeamSelector from '../components/TeamSelector'
import Loading from '../components/Loading'

function QualData() {
  const [selectedTeams, setSelectedTeams] = useSelectedTeams('selectedTeamsQualData', [])
  const { allTeams } = useTeamData(selectedTeams, false)
  const { rows: qualRows, loading: loading, error } = useDataTable('qual_data')
  const [matchFilter, setMatchFilter] = useState('')

  const handleTeamToggle = (teamNumber) => {
    const teamStr = String(teamNumber)
    setSelectedTeams(prev => {
      if (prev.includes(teamStr)) {
        return prev.filter(t => t !== teamStr)
      } else {
        return [...prev, teamStr]
      }
    })
  }

  const clearAllTeams = () => {
    setSelectedTeams([])
  }

  const getTeamDisplayText = () => {
    if (selectedTeams.length === 0) return 'No Teams'
    if (selectedTeams.length === 1) return `Team ${selectedTeams[0]}`
    return `${selectedTeams.length} Teams`
  }



  const filteredRows = useMemo(() => {
    if (!selectedTeams || selectedTeams.length === 0) return []

    const matchTerm = String(matchFilter || '').trim().toLowerCase()

    return qualRows.filter(row => {
      if (!row?.teams) return false

      // Team matching (teams column contains space-separated team numbers)
      const teams = String(row.teams).trim().split(/\s+/)
      const matchesTeam = selectedTeams.some(team => teams.includes(team))
      if (!matchesTeam) return false

      // Optional match filtering (partial match)
      if (matchTerm.length === 0) return true
      const rowMatch = String(row.match || '').toLowerCase()
      return rowMatch.includes(matchTerm)
    })
  }, [selectedTeams, matchFilter, qualRows])

  if (error) return <p role="alert">{error}</p>

  return (
    <div>
      <h1>Qual Data</h1>

      <TeamSelector
        allTeams={allTeams}
        selectedTeams={selectedTeams}
        onTeamToggle={handleTeamToggle}
        onClearAll={clearAllTeams}
        title="Select Teams to View"
      />

      <div className="team-data-section">
        <div className="team-data-header">
          <h2>Qual Data for {getTeamDisplayText()}</h2>
          <div className="filter-row">
            <label className="filter-label">
              Filter match:
              <input
                value={matchFilter}
                onChange={e => setMatchFilter(e.target.value)}
                placeholder=" Match name/number"
                className="filter-input"
              />
            </label>
          </div>
        </div>

        {loading ? (
          <Loading message="Loading qual data..." />
        ) : selectedTeams.length === 0 ? (
          <p>Select one or more teams to view their qual records.</p>
        ) : filteredRows.length === 0 ? (
          <p>No qual data found for the selected teams.</p>
        ) : (
          <div className="team-data-container">
            {selectedTeams.map(team => {
              const teamRows = filteredRows.filter(row => {
                const teams = String(row.teams || '').trim().split(/\s+/)
                return teams.includes(team)
              })

              if (teamRows.length === 0) return null

              return (
                <div key={team} className="team-data-table-section">
                  <h3 className="team-header">Team {team}</h3>
                  <div className="team-data-table-container">
                    <div className="table-wrapper">
                      <table className="qual-data-table">
                        <thead>
                          <tr>
                            <th className="sticky-column">Match</th>
                            <th>Name</th>
                            <th>Alliance</th>
                            <th>Teams</th>
                            <th>Defense</th>
                            <th>Strategies</th>
                            <th>Misc</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamRows.map((row, idx) => {
                            const rowKey = row.id ?? `${team}-${idx}`
                            return (
                              <tr key={rowKey}>
                                <td className="sticky-column">{row.match}</td>
                                <td>{row.name}</td>
                                <td>{row.alliance}</td>
                                <td>{row.teams}</td>
                                <td>{row.defense}</td>
                                <td>{row.strategies}</td>
                                <td>{row.misc}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
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

export default QualData
