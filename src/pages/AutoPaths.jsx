import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TeamSelector from '../components/TeamSelector'
import Loading from '../components/Loading'
import { useTeamData } from '../hooks/useTeamData'
import { useSelectedTeams } from '../hooks/useLocalStorage'
import '../index.css'

const OVERLAY_COLORS = [
  '#00ff00', '#ff4d4d', '#4da6ff', '#ffd11a', '#ff66ff',
  '#00e5e5', '#ff9933', '#b366ff', '#99ff33', '#ffffff',
]

const MIN_MATCHES_FOR_COMMON = 2

function AutoPaths() {
  const coords = {
    O: { x: 250, y: 305 },
    D: { x: 100, y: 150 },
    R: { x: 158, y: 295 },
    L: { x: 158, y: 370 },
    C: { x: 158, y: 330 },
    N: { x: 670, y: 305 },
    S: { x: 300, y: 305 },
    F: { x: 140, y: 580 },
  }
  const [selectedMatchNumber, setSelectedMatchNumber] = useState({})
  const [showCommon, setShowCommon] = useState(false)
  const [hiddenGroups, setHiddenGroups] = useState([])

  const handleMatchNumberChange = (team, matchNum) => {
    setSelectedMatchNumber(prev => ({ ...prev, [team]: matchNum }))
  }

  const toggleGroup = (key) => {
    setHiddenGroups(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const getMatchNumbersForTeam = (team) => {
    const nums = matchRows
      .map(row => {
        const parts = row['Scouting ID'].split('_')
        return parts.length > 2 && Number(parts[1]) === Number(team) ? Number(parts[2]) : null
      })
      .filter(n => n !== null)
    return [...new Set(nums)].sort((a, b) => a - b)
  }

  const getAutonPath = (team, matchNum) => {
    if (!matchNum) return []
    const row = matchRows.find(r => {
      const parts = r['Scouting ID'].split('_')
      return parts.length > 2 && Number(parts[1]) === Number(team) && Number(parts[2]) === Number(matchNum)
    })
    if (!row || !row['Auto Path']) return []
    let pathArr = row['Auto Path'].split('').map(l => l.trim()).filter(l => coords[l])
    if (pathArr.length === 0 || pathArr[0] !== 'O') {
      pathArr = ['O', ...pathArr]
    }
    return pathArr
  }

  const getCommonGroups = (team) => {
    const groups = {}
    getMatchNumbersForTeam(team).forEach(n => {
      const path = getAutonPath(team, n)
      if (path.length < 2) return
      const key = path.join('')
      if (!groups[key]) groups[key] = { key, path, matches: [] }
      groups[key].matches.push(n)
    })
    return Object.values(groups)
      .filter(g => g.matches.length >= MIN_MATCHES_FOR_COMMON)
      .sort((a, b) => b.matches.length - a.matches.length)
      .map((g, colorIdx) => ({ ...g, colorIdx }))
  }

  const renderPath = (path, pathIdx, overlay, colorIdx = pathIdx) => {
    const adjustedCoords = { ...coords }
    if (path.some(l => l === 'D' || l === 'R')) {
      adjustedCoords['S'] = { ...adjustedCoords['S'], y: adjustedCoords['S'].y - 90 }
      adjustedCoords['N'] = { ...adjustedCoords['N'], y: adjustedCoords['N'].y - 90 }
    }
    if (path.some(l => l === 'F' || l === 'L')) {
      adjustedCoords['S'] = { ...adjustedCoords['S'], y: adjustedCoords['S'].y + 90 }
      adjustedCoords['N'] = { ...adjustedCoords['N'], y: adjustedCoords['N'].y + 90 }
    }

    const color = overlay ? OVERLAY_COLORS[colorIdx % OVERLAY_COLORS.length] : null
    const rgba = (opacity) => (overlay ? color : `rgba(0, 255, 0, ${opacity})`)

    const elements = []
    const seenPaths = new Set()

    for (let i = 0; i < path.length - 1; i++) {
      const start = adjustedCoords[path[i]]
      const end = adjustedCoords[path[i + 1]]

      const pathKey = `${path[i]}-${path[i + 1]}`
      const reversePathKey = `${path[i + 1]}-${path[i]}`
      const opacity = overlay ? 0.85 : (i + 1) / (path.length - 1)
      const markerId = `arrowhead-${pathIdx}-${i}`
      const stroke = rgba(opacity)
      const isRepeat = seenPaths.has(pathKey) || seenPaths.has(reversePathKey)

      elements.push(
        <g key={`seg-${pathIdx}-${i}`} opacity={overlay ? opacity : 1}>
          <defs>
            <marker
              id={markerId}
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={overlay ? color : stroke} />
            </marker>
          </defs>
          {isRepeat ? (
            <path
              d={`M ${start.x},${start.y} Q ${(start.x + end.x) / 2},${(start.y + end.y) / 2 - 30} ${end.x},${end.y}`}
              stroke={overlay ? color : stroke}
              strokeWidth={overlay ? 3 : 4}
              fill="none"
              markerEnd={`url(#${markerId})`}
            />
          ) : (
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={overlay ? color : stroke}
              strokeWidth={overlay ? 3 : 4}
              markerEnd={`url(#${markerId})`}
            />
          )}
        </g>
      )
      if (!isRepeat) seenPaths.add(pathKey)
    }

    const nodeRadius = overlay ? 12 : 18
    const nodeFont = overlay ? 13 : 18
    const nodes = path
      .filter(l => l !== 'O')
      .map((l, idx) => (
        <g key={`node-${pathIdx}-${l}-${idx}`}>
          <circle
            cx={adjustedCoords[l].x}
            cy={adjustedCoords[l].y}
            r={nodeRadius}
            fill={overlay ? color : 'orange'}
            fillOpacity={overlay ? 0.6 : 1}
            stroke={overlay ? 'black' : 'none'}
            strokeWidth="1"
          />
          <text
            x={adjustedCoords[l].x}
            y={adjustedCoords[l].y + nodeFont / 3}
            textAnchor="middle"
            fontSize={nodeFont}
            fill="black"
          >
            {l}
          </text>
        </g>
      ))

    return <g key={`path-${pathIdx}`}>{elements}{nodes}</g>
  }

  const renderArrows = () => {
    if (!safeSelectedTeams.length) return null
    const team = safeSelectedTeams[0]

    if (showCommon) {
      const visible = getCommonGroups(team).filter(g => !hiddenGroups.includes(g.key))
      if (!visible.length) return null
      return visible.map((g, i) => renderPath(g.path, i, true, g.colorIdx))
    }

    const path = getAutonPath(team, selectedMatchNumber[team])
    if (path.length < 2) return null
    return renderPath(path, 0, false)
  }

  const navigate = useNavigate()
  const [selectedTeams, setSelectedTeams] = useSelectedTeams('selectedTeamsAutoPaths', [])
  const safeSelectedTeams = Array.isArray(selectedTeams) ? selectedTeams : []

  const dummyTeams = safeSelectedTeams.length > 0 ? safeSelectedTeams : ['0']
  const { allTeams, matchRows, loading } = useTeamData(dummyTeams, true)

  const handleTeamToggle = (team) => {
    const teamNum = Number(team)
    setHiddenGroups([])
    if (safeSelectedTeams.includes(teamNum)) {
      setSelectedTeams([])
      setSelectedMatchNumber({})
    } else {
      setSelectedTeams([teamNum])
      setSelectedMatchNumber({ [teamNum]: null })
    }
  }

  const clearAllTeams = () => {
    setSelectedTeams([])
    setHiddenGroups([])
  }

  if (loading) {
    return <Loading />
  }

  const commonGroups =
    showCommon && safeSelectedTeams.length === 1
      ? getCommonGroups(safeSelectedTeams[0])
      : []

  const smallButtonStyle = {
    color: 'black',
    backgroundColor: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
  }

  return (
    <div>
      <div style={{ marginBottom: '16px', textAlign: 'center' }}>
      </div>
      <div className="auto-paths-container">
        <h1>Auto Paths</h1>

        <TeamSelector
          allTeams={allTeams || []}
          selectedTeams={safeSelectedTeams}
          onTeamToggle={handleTeamToggle}
          onClearAll={clearAllTeams}
          title="Select Team"
        />

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginTop: '8px', marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCommon}
              onChange={e => setShowCommon(e.target.checked)}
            />
            Show common autos
          </label>

          {!showCommon && (
            <>
              <strong>Select Match Number:</strong>
              {safeSelectedTeams.length === 1 && (() => {
                const team = safeSelectedTeams[0]
                const uniqueMatchNumbers = getMatchNumbersForTeam(team)
                const currentMatch = selectedMatchNumber[team]
                return (
                  <div key={team} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'white' }}>Team {team}:</span>
                    <select
                      value={currentMatch || ''}
                      onChange={e => handleMatchNumberChange(team, e.target.value === '' ? null : Number(e.target.value))}
                      style={{ color: 'black', backgroundColor: 'white' }}
                    >
                      <option value="">None</option>
                      {uniqueMatchNumbers.map(num => (
                        <option key={num} value={num}>Match {num}</option>
                      ))}
                    </select>
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {showCommon && safeSelectedTeams.length === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            {commonGroups.length === 0 ? (
              <span style={{ color: 'white' }}>
                No auto path repeats across {MIN_MATCHES_FOR_COMMON}+ matches for this team.
              </span>
            ) : (
              <>
                {commonGroups.map(({ key, path, matches, colorIdx }) => {
                  const isHidden = hiddenGroups.includes(key)
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'white',
                        cursor: 'pointer',
                        opacity: isHidden ? 0.4 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!isHidden}
                        onChange={() => toggleGroup(key)}
                      />
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          backgroundColor: OVERLAY_COLORS[colorIdx % OVERLAY_COLORS.length],
                          display: 'inline-block',
                          borderRadius: '2px',
                        }}
                      />
                      <strong>{path.join(' → ')}</strong>
                      <span>
                        · {matches.length} matches: {matches.join(', ')}
                      </span>
                    </label>
                  )
                })}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={smallButtonStyle} onClick={() => setHiddenGroups([])}>All</button>
                  <button
                    style={smallButtonStyle}
                    onClick={() => setHiddenGroups(commonGroups.map(g => g.key))}
                  >
                    None
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '600px' }}>
          <div style={{ position: 'relative', width: '800px', height: '750px' }}>
            <img src="rebuiltauton.png" alt="Background" style={{ width: '100%', height: '100%' }} />
            <svg
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              viewBox="0 0 800 600"
            >
              {renderArrows()}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AutoPaths