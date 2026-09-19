import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TeamSelector from '../components/TeamSelector'
import { useSelectedTeams, useLocalStorage } from '../hooks/useLocalStorage'
import { useTeamSummary } from '../hooks/useTeamSummary'
import { useCompareData } from '../hooks/useCompareData'
import { EVENT_KEY } from '../constants/scoring'
import { COMPARE_FIELDS } from '../constants/matchSchema'
import { getRowNumber } from '../utils/scoutingMetrics'

const SOURCE_OPTIONS = [
  { value: 'combined', label: 'Combined (Scouter + TBA)' },
  { value: 'scouter', label: 'Scouter Only' },
  { value: 'tba', label: 'TBA Only' },
]

const COMPARE_STAT_FIELDS = COMPARE_FIELDS.map(field => field.id)

const getCompareField = (fieldId) => COMPARE_FIELDS.find(field => field.id === fieldId)

const getSummaryNumericValue = (teamSummary, fieldName) => {
  const metric = teamSummary?.[fieldName]
  if (!metric) return null

  if (metric.type === 'scoring') {
    const parsed = Number(metric.average)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (metric.type === 'number') {
    const parsed = Number(metric.value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const fetchTeamOPR = async (teamNumber) => {
  try {
    const apiKey = import.meta.env.VITE_TBA_API_KEY
    if (!apiKey) {
      console.warn('VITE_TBA_API_KEY not set')
      return null
    }
    const url = `https://www.thebluealliance.com/api/v3/team/frc${teamNumber}/event/${EVENT_KEY}/status`
    const response = await fetch(url, {
      headers: { 'X-TBA-Auth-Key': apiKey }
    })
    if (!response.ok) {
      console.warn(`TBA API response not ok for team ${teamNumber}: ${response.status}`)
      return null
    }
    const data = await response.json()
    return data?.stat_median?.opr ?? null
  } catch (error) {
    console.error(`Failed to fetch OPR for team ${teamNumber}:`, error)
    return null
  }
}

const calculateNumberStats = (teamRows, fieldSpec) => {
  if (!fieldSpec) return null
  const values = teamRows
    .map(row => getRowNumber(row, [fieldSpec.key, ...fieldSpec.aliases]))
    .filter(value => value != null)

  if (values.length === 0) return null

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    type: 'rating',
    average: avg.toFixed(2),
    max: Math.max(...values),
    min: Math.min(...values),
    count: values.length,
  }
}

const calculateBooleanPercentage = (teamRows, fieldSpec) => {
  if (!fieldSpec) return null
  const values = teamRows
    .map(row => row?.[fieldSpec.key] ?? row?.[fieldSpec.aliases[0]])
    .filter(value => value !== null && value !== undefined)

  if (values.length === 0) return null

  const trueCount = values.filter(value => value === true || value === 'true' || value === 1 || value === '1').length
  if (trueCount === 0) return null

  return {
    type: 'boolean',
    trueCount,
    totalCount: values.length,
    percentage: ((trueCount / values.length) * 100).toFixed(1),
  }
}

const getComparisonValue = (teamRows, teamSummary, field) => {
  const fieldSpec = getCompareField(field)
  if (fieldSpec?.type === 'bool') {
    const stats = calculateBooleanPercentage(teamRows, fieldSpec)
    return stats ? parseFloat(stats.percentage) : null
  }
  if (fieldSpec) {
    const stats = calculateNumberStats(teamRows, fieldSpec)
    return stats ? parseFloat(stats.average) : null
  }
  return getSummaryNumericValue(teamSummary, field)
}

const buildFieldColorMap = (teams, matchRows, summary, field) => {
  if (teams.length < 2) return {}

  const values = teams
    .map(team => {
      const teamRows = matchRows.filter(row => String(row.team) === String(team))
      const val = getComparisonValue(teamRows, summary[team], field)
      return { team, val }
    })
    .filter(({ val }) => val !== null)

  if (values.length < 2) return {}

  const max = Math.max(...values.map(v => v.val))
  const min = Math.min(...values.map(v => v.val))

  const colorMap = {}
  for (const { team, val } of values) {
    if (max === min) {
      colorMap[team] = null
    } else if (val === max) {
      colorMap[team] = 'high'
    } else if (val === min) {
      colorMap[team] = 'low'
    } else {
      colorMap[team] = 'mid'
    }
  }
  return colorMap
}

const RANK_COLOR_STYLES = {
  high: { color: '#16a34a', fontWeight: '700' },
  mid: { color: '#ca8a04', fontWeight: '700' },
  low: { color: '#dc2626', fontWeight: '700' },
}

// Returns null for any value that is zero (numeric or string), otherwise returns the value as-is
const zeroToNull = (value) => {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) && num === 0 ? null : value
}

function Compare() {
  const navigate = useNavigate()

  const [selectedTeams, setSelectedTeams] = useSelectedTeams('selectedTeams', [])
  const [selectedStat, setSelectedStat] = useLocalStorage('selectedStat', '', (v) => v, (v) => v)
  const [useMaxValues] = useLocalStorage('compareUseMax', false)
  const [sourceMode, setSourceMode] = useLocalStorage(
    'compareSourceMode',
    'combined',
    (v) => String(v || 'combined'),
    (v) => v,
  )
  const [useDataOnly, setUseDataOnly] = useLocalStorage('compareUseDataOnly', true)
  const [selectedScouters, setSelectedScouters] = useLocalStorage('compareSelectedScouters', [])
  const [oprData, setOprData] = useState({})
  const [pinnedField, setPinnedField] = useState(null)

  const safeSelectedTeams = useMemo(
    () => (Array.isArray(selectedTeams) ? selectedTeams : []),
    [selectedTeams],
  )
  const safeSelectedScouters = useMemo(
    () => (Array.isArray(selectedScouters) ? selectedScouters : []),
    [selectedScouters],
  )

  const {
    allTeams,
    matchRows,
    scouterNames = [],
  } = useCompareData({
    selectedTeams: safeSelectedTeams,
    sourceMode,
    useDataOnly,
    selectedScouters: safeSelectedScouters,
  })

  const summary = useTeamSummary(matchRows, useMaxValues)
  
  console.log("MATCH ROW:", JSON.stringify(matchRows[0], null, 2))

  useEffect(() => {
    if (!COMPARE_STAT_FIELDS.length) {
      if (selectedStat) setSelectedStat('')
      return
    }

    if (!selectedStat || !COMPARE_STAT_FIELDS.includes(selectedStat)) {
      setSelectedStat(COMPARE_STAT_FIELDS[0])
    }
  }, [selectedStat, setSelectedStat])

  useEffect(() => {
    const fetchOPRForTeams = async () => {
      if (!safeSelectedTeams.length) {
        setOprData({})
        return
      }

      const newOprData = {}
      for (const team of safeSelectedTeams) {
        const teamNum = typeof team === 'string' ? parseInt(team) : team
        const opr = await fetchTeamOPR(teamNum)
        newOprData[team] = opr
      }
      setOprData(newOprData)
    }

    fetchOPRForTeams()
  }, [safeSelectedTeams])

  const fieldColorMaps = useMemo(() => {
    const maps = {}
    for (const field of COMPARE_STAT_FIELDS) {
      maps[field] = buildFieldColorMap(safeSelectedTeams, matchRows, summary, field)
    }
    return maps
  }, [safeSelectedTeams, matchRows, summary])

  const sortedFields = useMemo(() => {
    if (!pinnedField) return COMPARE_STAT_FIELDS
    return [pinnedField, ...COMPARE_STAT_FIELDS.filter(f => f !== pinnedField)]
  }, [pinnedField])

  const handleFieldDoubleClick = (field) => {
    setPinnedField(prev => prev === field ? null : field)
  }

  const handleScouterToggle = (scouterName) => {
    const normalized = String(scouterName)
    setSelectedScouters((prev) => {
      const prevArray = Array.isArray(prev) ? prev : []
      if (prevArray.includes(normalized)) {
        return prevArray.filter((name) => name !== normalized)
      }
      return [...prevArray, normalized]
    })
  }

  const handleTeamToggle = (teamNumber) => {
    const teamStr = String(teamNumber)
    setSelectedTeams(prev => {
      const prevArray = Array.isArray(prev) ? prev : []
      if (prevArray.includes(teamStr)) {
        return prevArray.filter(t => t !== teamStr)
      } else {
        return [...prevArray, teamStr]
      }
    })
  }

  const clearAllTeams = () => {
    setSelectedTeams([])
  }

  const handleTeamClick = (teamNumber) => {
    localStorage.setItem('selectedTeamsAnalysis', JSON.stringify([String(teamNumber)]))
    navigate('/team-analysis')
  }

  return (
    <div className="compare-container">
      <h1>Compare Data</h1>

      <div className="compare-data-source-panel compare-stat-selection">
        <div className="compare-data-source-row">
          <label htmlFor="compare-source-mode" className="compare-control-label">
            Data Source
          </label>
          <select
            id="compare-source-mode"
            className="compare-source-select"
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value)}
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {sourceMode !== 'tba' ? (
          <label className="compare-checkbox-inline">
            <input
              type="checkbox"
              checked={!!useDataOnly}
              onChange={(e) => setUseDataOnly(e.target.checked)}
            />
            <span>Only include rows where `Use Data` is true</span>
          </label>
        ) : null}

        {sourceMode !== 'tba' && scouterNames.length > 0 ? (
          <div className="compare-scouter-filter">
            <div className="compare-scouter-filter-header">
              <span className="compare-control-label">Scouter Filter</span>
              <button
                className="action-btn clear-all"
                onClick={() => setSelectedScouters([])}
                type="button"
              >
                Clear
              </button>
            </div>
            <div className="compare-scouter-grid">
              {scouterNames.map((name) => {
                const checked = safeSelectedScouters.includes(name)
                return (
                  <label key={name} className={`compare-scouter-chip ${checked ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleScouterToggle(name)}
                    />
                    <span>{name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <TeamSelector
        allTeams={allTeams || []}
        selectedTeams={safeSelectedTeams}
        onTeamToggle={handleTeamToggle}
        onClearAll={clearAllTeams}
        title="Select Teams to Compare"
      />


      <div className="compare-summary-section">
        <div className="compare-summary-header">
          <h2 className="compare-summary-title">Summaries</h2>
        </div>
        {Object.keys(summary).length === 0 ? (
          <p>No data to summarize.</p>
        ) : (
          <div className="summary-container" data-count={safeSelectedTeams.length}>
            {safeSelectedTeams.map(team => {
              const teamRows = matchRows.filter(row => String(row.team) === String(team))

              return summary[team] ? (
                <div key={team} className="summary-card">
                  <h3
                    className="team-header-clickable"
                    onClick={() => handleTeamClick(team)}
                  >
                    Team {team}
                  </h3>

                  {oprData[team] !== undefined && (
                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(204, 251, 241, 0.82)', borderBottom: '1px solid rgba(148, 163, 184, 0.28)', fontWeight: 600 }}>
                      <strong>OPR (The Blue Alliance):</strong> {oprData[team] !== null ? oprData[team].toFixed(2) : 'N/A'}
                    </div>
                  )}

                  {/* Unified stats table with Avg / Min / Max columns for rating fields */}
                  <table>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Avg</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFields.map(field => {
                        const fieldSpec = getCompareField(field)
                        const rankLabel = fieldColorMaps[field]?.[team]
                        const rankStyle = rankLabel ? RANK_COLOR_STYLES[rankLabel] : undefined

                        const isPinned = pinnedField === field
                        const fieldCellStyle = isPinned
                          ? { fontWeight: 700, color: '#6366f1', cursor: 'pointer', userSelect: 'none' }
                          : { cursor: 'pointer', userSelect: 'none' }

                        if (fieldSpec?.type === 'bool') {
                          const booleanStats = calculateBooleanPercentage(teamRows, fieldSpec)
                          return (
                            <tr key={field}>
                              <td
                                style={fieldCellStyle}
                                onDoubleClick={() => handleFieldDoubleClick(field)}
                                title="Double-click to pin this field to the top"
                              >
                                {isPinned ? ' ' : ''}{field}
                              </td>
                              <td colSpan={3} style={rankStyle || {}}>
                                {booleanStats
                                  ? <span style={rankStyle || {}}>{booleanStats.percentage}%</span>
                                  : 'N/A'}
                              </td>
                              <td>
                                {booleanStats
                                  ? `${booleanStats.trueCount} / ${booleanStats.totalCount} matches`
                                  : '—'}
                              </td>
                            </tr>
                          )
                        }

                        if (fieldSpec) {
                          const ratingStats = calculateNumberStats(teamRows, fieldSpec)
                          if (!ratingStats) return null
                          return (
                            <tr key={field}>
                              <td
                                style={fieldCellStyle}
                                onDoubleClick={() => handleFieldDoubleClick(field)}
                                title="Double-click to pin this field to the top"
                              >
                                {isPinned ? ' ' : ''}{field}
                              </td>
                              <td style={rankStyle || {}}>{ratingStats.average}</td>
                              <td>{ratingStats.min}</td>
                              <td>{ratingStats.max}</td>
                              <td>Rating ({ratingStats.count} matches)</td>
                            </tr>
                          )
                        }

                        if (!summary[team][field]) return null
                        const metric = summary[team][field]

                        if (metric.type === 'scoring') {
                          const attempts = Number(metric.avgAttempts)
                          const made = Number(metric.average)
                          const attemptsLabel = Number.isFinite(attempts) ? attempts.toFixed(2) : String(metric.avgAttempts)
                          const madeLabel = zeroToNull(Number.isFinite(made) ? made.toFixed(2) : null)
                          if (!madeLabel) return null
                          return (
                            <tr key={field}>
                              <td
                                style={fieldCellStyle}
                                onDoubleClick={() => handleFieldDoubleClick(field)}
                                title="Double-click to pin this field to the top"
                              >
                                {isPinned ? ' ' : ''}{field}
                              </td>
                              <td style={rankStyle || {}}>{madeLabel}</td>
                              <td colSpan={2}>—</td>
                              <td>{attemptsLabel} attempts · {metric.successRate}% success</td>
                            </tr>
                          )
                        }

                        if (metric.type === 'number') {
                          const value = Number(metric.value)
                          const displayValue = zeroToNull(Number.isFinite(value) ? value.toFixed(2) : null)
                          if (!displayValue) return null
                          return (
                            <tr key={field}>
                              <td
                                style={fieldCellStyle}
                                onDoubleClick={() => handleFieldDoubleClick(field)}
                                title="Double-click to pin this field to the top"
                              >
                                {isPinned ? ' ' : ''}{field}
                              </td>
                              <td style={rankStyle || {}}>{displayValue}</td>
                              <td colSpan={2}>—</td>
                              <td>—</td>
                            </tr>
                          )
                        }

                        // boolean-like fallback (percent)
                        return (
                          <tr key={field}>
                            <td
                              style={fieldCellStyle}
                              onDoubleClick={() => handleFieldDoubleClick(field)}
                              title="Double-click to pin this field to the top"
                            >
                              {isPinned ? ' ' : ''}{field}
                            </td>
                            <td colSpan={3} style={rankStyle || {}}>{metric.value} ({metric.percent}%)</td>
                            <td>—</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Compare