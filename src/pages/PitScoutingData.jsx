import { useMemo, useState } from 'react'
import { useDataTable } from '../hooks/useAppData.js'

const FIELDS = [
  { key: 'drivetrain_type', label: 'Drivetrain' },
  { key: 'drivetrain_reliability', label: 'Drivetrain Reliability' },
  { key: 'ball_capacity', label: 'Ball Capacity' },
  { key: 'intake_type', label: 'Intake Type' },
  { key: 'balls_per_second', label: 'Balls/Second' },
  { key: 'shoot_on_move', label: 'Shoot on Move?' },
  { key: 'climb_l1', label: 'Climb L1' },
  { key: 'climb_l2', label: 'Climb L2' },
  { key: 'climb_l3', label: 'Climb L3' },
  { key: 'can_do_bump', label: 'Bump?' },
  { key: 'can_do_trench', label: 'Trench?' },
  { key: 'robot_vision', label: 'Robot Vision' },
  { key: 'game_strategy', label: 'Game Strategy' },
  { key: 'auto_path', label: 'Auto Path' },
  { key: 'driver_seasons', label: 'Driver Seasons' },
  { key: 'coach_seasons', label: 'Coach Seasons' },
  { key: 'gracious_professionalism', label: 'GP Rating' },
  { key: 'robot_weight_lbs', label: 'Weight (lbs)' },
  { key: 'electrical_organization', label: 'Electrical' },
  { key: 'defense_cam', label: 'Defense Cam?' },
  { key: 'has_spare_parts', label: 'Spare Parts?' },
  { key: 'additional_notes', label: 'Notes' },
]

function getDriveDirectUrl(url) {
  if (!url) return null
  if (url.includes('uc?export=view')) return url
  const match = url.match(/id=([\w-]+)/)
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`
  return url
}

function formatTimestamp(ts) {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d)) return ts
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'UTC',
  })
}

function TeamCard({ team, row }) {
  return (
    <div className="team-data-table-section">
      <h3 className="team-header">Team {team}</h3>

      {row.robot_image_url && (
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
          <img
            src={getDriveDirectUrl(row.robot_image_url)}
            alt={`Team ${team} robot`}
            style={{
              maxHeight: '18rem',
              maxWidth: '100%',
              borderRadius: '10px',
              border: '1px solid rgba(148,163,184,0.3)',
              objectFit: 'contain',
            }}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '1.5rem',
        flexWrap: 'wrap',
        marginBottom: '1rem',
        fontSize: '0.875rem',
        color: 'rgba(148,163,184,0.95)',
      }}>
        {row.scout_name && (
          <span>
            <strong style={{ color: 'rgba(203,213,225,0.95)' }}>Scouted by:</strong>{' '}
            {row.scout_name}
          </span>
        )}
        {row.timestamp && (
          <span>
            <strong style={{ color: 'rgba(203,213,225,0.95)' }}>Time:</strong>{' '}
            {formatTimestamp(row.timestamp)}
          </span>
        )}
      </div>

      <div className="rankings-table-container">
        <table className="rankings-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '25%' }} />
            <col style={{ width: '75%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Category</th>
              <th>Response</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map(({ key, label }) => {
              const val = row[key]
              if (val === null || val === undefined || val === '') return null
              return (
                <tr key={key}>
                  <td style={{
                    fontWeight: 600,
                    color: 'rgba(147,197,253,0.95)',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'top',
                    paddingTop: '0.6rem',
                  }}>
                    {label}
                  </td>
                  <td style={{
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                    color: 'rgba(226,232,240,0.95)',
                    verticalAlign: 'top',
                    paddingTop: '0.6rem',
                  }}>
                    {String(val)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PitScoutingData() {
  const { rows: rows, loading: loading, error } = useDataTable('pit_scouting_data')
  const [search, setSearch] = useState('')
  const [selectedTeams, setSelectedTeams] = useState([])



  const allTeams = useMemo(() => {
    const seen = new Set()
    return rows
      .filter(r => r.team_number && !seen.has(r.team_number) && seen.add(r.team_number))
      .map(r => r.team_number)
      .sort((a, b) => Number(a) - Number(b))
  }, [rows])

  const filteredTeams = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return allTeams
    return allTeams.filter(t => String(t).includes(term))
  }, [allTeams, search])

  const handleTeamToggle = (team) => {
    setSelectedTeams(prev =>
      prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]
    )
  }

  const clearAll = () => setSelectedTeams([])

  const getDisplayText = () => {
    if (selectedTeams.length === 0) return 'No Teams'
    if (selectedTeams.length === 1) return `Team ${selectedTeams[0]}`
    return `${selectedTeams.length} Teams`
  }

  if (error) return <p role="alert">{error}</p>

  return (
    <div>
      <h1>Pit Scouting</h1>

      <div className="compare-team-selection">
        <div className="team-selection-header">
          <h2>Select Teams</h2>
        </div>

        <div className="team-selection-controls">
          <div className="search-container">
            <input
              className="team-search-input"
              placeholder="Search team number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="selection-actions">
            <span className="selected-count">{getDisplayText()} selected</span>
            {selectedTeams.length > 0 && (
              <button className="action-btn" onClick={clearAll}>
                Clear All
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="loading-container">Loading teams...</p>
        ) : (
          <div className="teams-grid">
            {filteredTeams.length === 0 ? (
              <p className="no-teams">No teams found.</p>
            ) : (
              filteredTeams.map(team => (
                <div
                  key={team}
                  className={`team-checkbox${selectedTeams.includes(team) ? ' selected' : ''}`}
                  onClick={() => handleTeamToggle(team)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleTeamToggle(team)}
                >
                  <span className="team-number">{team}</span>
                  <span className="checkmark">✓</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {error && <div className="page-error">{error}</div>}

      <div className="team-data-section">
        {selectedTeams.length === 0 ? (
          <p>Select one or more teams above to view their pit scouting data.</p>
        ) : (
          <div className="team-data-container">
            {selectedTeams.map(team => {
              const row = rows.find(r => String(r.team_number) === String(team))
              if (!row) return (
                <div key={team} className="team-data-table-section">
                  <h3 className="team-header">Team {team}</h3>
                  <p>No pit scouting data found for this team.</p>
                </div>
              )
              return <TeamCard key={team} team={team} row={row} />
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default PitScoutingData