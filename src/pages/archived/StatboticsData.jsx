import '../../styles/archived/page-styles.css'
import { useState, useMemo } from 'react'
import { useDataTable } from '../../hooks/useAppData.js'
import TeamSelector from '../../components/TeamSelector'
import Loading from '../../components/Loading'
import '../../styles/tables.css'

function StatboticsData() {
  const [selectedTeams, setSelectedTeams] = useState([])
  const { rows, loading, error } = useDataTable('statbotics_data')
  const allTeams = useMemo(() => [...new Set(rows.map(row => row.team))].sort((a, b) => Number(a) - Number(b)), [rows])
  const selectedTeamRows = useMemo(() => rows.filter(row => selectedTeams.map(String).includes(String(row.team)))
    .sort((a, b) => Number(a.num) - Number(b.num)), [rows, selectedTeams])

  const columns = useMemo(() => {
    if (!selectedTeamRows || selectedTeamRows.length === 0) return []

    // Build a stable column order based on the first row, while including any extra keys
    const firstRowKeys = Object.keys(selectedTeamRows[0])
    const allKeys = new Set(firstRowKeys)
    selectedTeamRows.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)))

    // Keep firstRowKeys order, then append any extras
    const extraKeys = Array.from(allKeys).filter(k => !firstRowKeys.includes(k))
    return [...firstRowKeys, ...extraKeys]
  }, [selectedTeamRows])

  const headerLabels = useMemo(() => ({
    r_1: 'Energized_RP_EPA',
    r_2: 'Supercharged_RP_EPA',
    r_3: 'Traversal_RP_EPA',
  }), [])

  const getHeaderLabel = (col) => {
    const normalized = String(col).toLowerCase()
    if (normalized === 'r_1' || normalized.includes('r_1')) return headerLabels.r_1
    if (normalized === 'r_2' || normalized.includes('r_2')) return headerLabels.r_2
    if (normalized === 'r_3' || normalized.includes('r_3')) return headerLabels.r_3
    return headerLabels[col] ?? col
  }

  if (error) return <div className="page-error">Error: {error}</div>
  if (loading) return <Loading />

  return (
    <div className="page-container">
      <h1>Statbotics Data</h1>

      <TeamSelector
        allTeams={allTeams}
        selectedTeams={selectedTeams}
        onTeamToggle={team => {
          const s = String(team)
          setSelectedTeams(prev =>
            prev.includes(s)
              ? prev.filter(x => x !== s)
              : [...prev, s]
          )
        }}
        onClearAll={() => setSelectedTeams([])}
      />

      {selectedTeams.length > 0 && (
        <div className="team-data-container statbotics-team-data">
          {selectedTeams.map(s => {
            const rows = selectedTeamRows.filter(r => String(r.team).trim().toLowerCase() === String(s).trim().toLowerCase())
            if (rows.length === 0) return null

            return (
              <div key={s} className="team-data-table-section">
                <h3 className="team-header">Team {s}</h3>
                <div className="team-data-table-container statbotics-table-container">
                  <table className="statbotics-table">
                    <thead>
                      <tr>
                        {columns.map(col => (
                          <th key={col}>{getHeaderLabel(col)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx}>
                          {columns.map(col => {
                            const value = row[col]
                            const display =
                              value === undefined || value === null
                                ? '—'
                                : String(value)
                            return <td key={col}>{display}</td>
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
  )
}

export default StatboticsData