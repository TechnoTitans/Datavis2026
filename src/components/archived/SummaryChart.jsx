import React from 'react'


function SummaryChart({
  safeSelectedTeams,
  matchRows,
  summary,
  oprData,
  handleTeamClick,
  sortedFields,
  fieldColorMaps,
  pinnedField,
  handleFieldDoubleClick,
  handleCellClick,
  calculateRatingStats,
  calculateBooleanPercentage,
  zeroToNull,
  RATING_FIELDS,
  RANK_COLOR_STYLES
}) {
  return (
    <>
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
                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(219, 234, 254, 0.82)', borderBottom: '1px solid rgba(148, 163, 184, 0.28)', fontWeight: 600 }}>
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
                        const isRatingField = RATING_FIELDS.includes(field)
                        const booleanFields = ['Penalties', 'Bump', 'Trench', 'Broke Down']
                        const isBooleanField = booleanFields.includes(field)

                        const rankLabel = fieldColorMaps[field]?.[team]
                        const rankStyle = rankLabel ? RANK_COLOR_STYLES[rankLabel] : undefined

                        const isPinned = pinnedField === field
                        const fieldCellStyle = isPinned
                          ? { fontWeight: 700, color: '#6366f1', cursor: 'pointer', userSelect: 'none' }
                          : { cursor: 'pointer', userSelect: 'none' }

                        if (isRatingField) {
                          const ratingStats = calculateRatingStats(teamRows, field)
                          if (!ratingStats) return null
                          return (
                            <tr key={field}>
                              <td
                                style={fieldCellStyle}
                                onClick={() => handleCellClick(team, field)}
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

                        if (isBooleanField) {
                          const booleanStats = calculateBooleanPercentage(teamRows, field)
                          return (
                            <tr key={field}>
                              <td
                                style={fieldCellStyle}
                                onClick={() => handleCellClick(team, field)}
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
                                onClick={() => handleCellClick(team, field)}
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
                                onClick={() => handleCellClick(team, field)}
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
                              onClick={() => handleCellClick(team, field)}
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
    </>
  )
}

export default SummaryChart