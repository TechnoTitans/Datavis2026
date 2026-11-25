import '../../styles/archived/page-styles.css'
import { useMemo, useState } from 'react'
import { useDataTable } from '../../hooks/useAppData.js'
import { useSelectedTeams } from '../../hooks/usePreferences.js'
import TeamSelector from '../../components/TeamSelector'
import Loading from '../../components/Loading'

function PrescoutingData() {
  const [selectedTeams, setSelectedTeams] = useSelectedTeams('selectedTeamsPrescoutingData', [])
  const { rows: prescoutingRows, loading: loading, error } = useDataTable('prescouting_data')
  const allTeams = useMemo(() => [...new Set(prescoutingRows.map(row => String(row.team_number)))].sort((a, b) => Number(a) - Number(b)), [prescoutingRows])
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

    return prescoutingRows.filter(row => {
      if (!row?.team_number) return false

      const matchesTeam = selectedTeams.includes(String(row.team_number))
      if (!matchesTeam) return false

      if (matchTerm.length === 0) return true
      const rowMatch = String(row.match || '').toLowerCase()
      return rowMatch.includes(matchTerm)
    })
  }, [selectedTeams, matchFilter, prescoutingRows])

  if (error) return <p role="alert">{error}</p>

  return (
    <div>
      <h1>Prescouting Data</h1>

      <TeamSelector
        allTeams={allTeams}
        selectedTeams={selectedTeams}
        onTeamToggle={handleTeamToggle}
        onClearAll={clearAllTeams}
        title="Select Teams to View"
      />

      <div className="team-data-section">
        <div className="team-data-header">
          <h2>Prescouting Data for {getTeamDisplayText()}</h2>
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
          <Loading message="Loading prescouting data..." />
        ) : selectedTeams.length === 0 ? (
          <p>Select one or more teams to view their prescouting records.</p>
        ) : filteredRows.length === 0 ? (
          <p>No prescouting data found for the selected teams.</p>
        ) : (
          <div className="team-data-container">
            {selectedTeams.map(team => {
              const teamRows = filteredRows.filter(row =>
                String(row.team_number) === team
              )

              if (teamRows.length === 0) return null

              return (
                <div key={team} className="team-data-table-section">
                  <h3 className="team-header">Team {team}</h3>
                  <div className="team-data-table-container">
                    <div className="table-wrapper">
                      <table className="qual-data-table">
                        <thead>
                          <tr>
                            <th className="sticky-column" style={{ width: '11rem', minWidth: '11rem', maxWidth: '11rem', textAlign: 'left' }}>Match</th>
                            <th>Scout Name</th>
                            <th>Alliance Teams</th>
                            <th>Strategies</th>
                            <th>Defense</th>
                            <th>Misc</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamRows.map((row, idx) => {
                            const rowKey = row.id ?? `${team}-${idx}`
                            return (
                              <tr key={rowKey}>
                                <td className="sticky-column" style={{ width: '11rem', minWidth: '11rem', maxWidth: '11rem', textAlign: 'left' }}>{row.match}</td>
                                <td>{row.name}</td>
                                <td>{row.alliance_teams}</td>
                                <td>{row.strategies}</td>
                                <td>{row.defense}</td>
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

export default PrescoutingData