import { useMemo, useState } from 'react'
import TeamSelector from '../components/TeamSelector'
import Loading from '../components/Loading'
import { useTeamData } from '../hooks/useTeamData'
import { useQualData } from '../hooks/useQualData'
import { useSelectedTeams } from '../hooks/useLocalStorage'
import {
  DEFENSE_ACTIONS,
  formatMatchLabel,
  formatNumber,
  getDefenseActionValue,
  getDefenseRatingValue,
  getPenaltyValue,
  isEmptyDefenseText,
  mergeTeamLists,
  noteText,
  orderedTeamIds,
  qualRowHasTeam,
  summarizeDefense,
  teamFromMatchRow,
} from '../utils/scoutingMetrics'

const handleTeamToggle = (setSelectedTeams) => (teamNumber) => {
  const teamStr = String(teamNumber)
  setSelectedTeams(prev => {
    const current = Array.isArray(prev) ? prev.map(String) : []
    if (current.includes(teamStr)) return current.filter(team => team !== teamStr)
    return [...current, teamStr]
  })
}

function DefenseAction({ action, binary }) {
  const rate = action.matches > 0 ? `${action.didCount}/${action.matches}` : '—'
  const percent = action.matches > 0 ? `${formatNumber((action.didCount / action.matches) * 100, 0)}%` : null
  const detail = !action.does
    ? 'never'
    : binary
      ? percent
      : `avg ${formatNumber(action.average)}`
  return (
    <div
      className={`defense-flag ${action.does ? 'defense-flag-on' : 'defense-flag-off'}`}
      title={action.does
        ? `${action.label} in ${rate} matches${binary ? ` (${percent})` : `. Average ${formatNumber(action.average)}`}.`
        : `No ${action.label.toLowerCase()} marked as done.`}
    >
      <span className="defense-flag-mark" aria-hidden="true">{action.does ? '✓' : '–'}</span>
      <span className="defense-flag-copy">
        <span className="defense-flag-name">{action.label}</span>
        <span className="defense-flag-meta">{rate} · {detail}</span>
      </span>
    </div>
  )
}

function ScoutingDefenseCard({ team, rows }) {
  const summary = useMemo(() => summarizeDefense(rows), [rows])
  const scale = summary.scale || 5
  const generalPercent = summary.generalAverage == null
    ? 0
    : Math.max(0, Math.min(100, (summary.generalAverage / scale) * 100))
  const inclusionById = useMemo(() => {
    const map = new Map()
    for (const entry of summary.assessedRows || []) {
      if (entry.id != null) map.set(entry.id, entry.included)
    }
    return map
  }, [summary.assessedRows])

  return (
    <article className="role-team-card">
      <div className="role-team-header">
        <h3 className="team-header">Team {team}</h3>
        <p className="role-team-sub">{summary.matchCount} scouted match{summary.matchCount === 1 ? '' : 'es'}</p>
      </div>

      {rows.length === 0 ? (
        <p>No scouting defense data for this team.</p>
      ) : (
        <>
          <div className="defense-general">
            <div>
              <p className="stat-kicker">General defense rating</p>
              <p className="stat-value">
                {formatNumber(summary.generalAverage)}
                <span className="stat-suffix"> / {scale}</span>
              </p>
            </div>
            <div className="stat-bar" aria-hidden="true">
              <span style={{ width: `${generalPercent}%` }} />
            </div>
            <p className="stat-hint">
              Average Defense Rating from {summary.includedCount} match{summary.includedCount === 1 ? '' : 'es'} where they played defense
              {summary.excludedCount > 0 ? ` · ${summary.excludedCount} with no checks and 0 stars omitted` : ''}.
              Highlighted rows in the table are included.
            </p>
          </div>

          <div className="defense-flag-grid" role="list" aria-label={`Defense actions for team ${team}`}>
            {summary.actions.map(action => (
              <DefenseAction key={action.key} action={action} binary={summary.binary} />
            ))}
            <DefenseAction action={summary.penalties} binary />
          </div>

          <div className="team-data-table-container">
            <div className="table-wrapper">
              <table className="defense-raw-table">
                <thead>
                  <tr>
                    <th className="sticky-column">Match</th>
                    {DEFENSE_ACTIONS.map(action => (
                      <th key={action.key}>{action.label}</th>
                    ))}
                    <th>Stars</th>
                    <th>Penalties</th>
                    <th>In avg</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const assessed = summary.assessedRows?.[idx]
                    const included = assessed?.included ?? inclusionById.get(row['Scouting ID']) ?? false
                    const general = getDefenseRatingValue(row)
                    const penalties = getPenaltyValue(row)
                    return (
                      <tr
                        key={row['Scouting ID'] || `${team}-${idx}`}
                        className={included ? 'defense-row-included' : 'defense-row-excluded'}
                        title={included ? 'Included in defense average' : 'Omitted from defense average: no checks and 0 stars'}
                      >
                        <td className="sticky-column">{formatMatchLabel(row)}</td>
                        {DEFENSE_ACTIONS.map(action => {
                          const value = getDefenseActionValue(row, action)
                          return (
                            <td key={action.key} className={value > 0 ? 'rating-hot' : ''}>
                              {formatNumber(value, 0)}
                            </td>
                          )
                        })}
                        <td className={general > 0 ? 'rating-hot' : ''}>{formatNumber(general, 0)}</td>
                        <td className={penalties ? 'rating-hot' : ''}>{penalties == null ? '—' : penalties ? 'Yes' : 'No'}</td>
                        <td>
                          <span className={included ? 'avg-chip avg-chip-on' : 'avg-chip avg-chip-off'}>
                            {included ? 'Included' : 'Omitted'}
                          </span>
                        </td>
                        <td className="wrap-cell">{noteText(row.Notes) || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </article>
  )
}

function QualDefenseCard({ team, rows, hideEmpty }) {
  const visibleRows = hideEmpty ? rows.filter(row => !isEmptyDefenseText(row.defense)) : rows

  return (
    <article className="role-team-card">
      <div className="role-team-header">
        <h3 className="team-header">Team {team}</h3>
        <p className="role-team-sub">
          {visibleRows.length} defense note{visibleRows.length === 1 ? '' : 's'}
          {hideEmpty && rows.length !== visibleRows.length ? ` · ${rows.length - visibleRows.length} empty hidden` : ''}
        </p>
      </div>

      {visibleRows.length === 0 ? (
        <p>{rows.length === 0 ? 'No qual records for this team.' : 'No isolated defense notes for this team.'}</p>
      ) : (
        <div className="team-data-table-container">
          <div className="table-wrapper">
            <table className="qual-data-table">
              <thead>
                <tr>
                  <th className="sticky-column">Match</th>
                  <th>Alliance</th>
                  <th>Teams</th>
                  <th>Defense</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, idx) => (
                  <tr key={row.id ?? `${team}-qual-${idx}`}>
                    <td className="sticky-column">{row.match || '—'}</td>
                    <td>{row.alliance || '—'}</td>
                    <td>{row.teams || '—'}</td>
                    <td className={isEmptyDefenseText(row.defense) ? 'muted-cell' : ''}>
                      {isEmptyDefenseText(row.defense) ? '—' : row.defense}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  )
}

function Defense() {
  const [selectedTeams, setSelectedTeams] = useSelectedTeams('selectedTeamsDefense', [])
  const [hideEmptyQual, setHideEmptyQual] = useState(true)
  const safeSelected = useMemo(
    () => (Array.isArray(selectedTeams) ? selectedTeams.map(String) : []),
    [selectedTeams],
  )
  const { allTeams: matchTeams, matchRows, loading: matchLoading } = useTeamData(safeSelected, true)
  const { rows: qualRows, teams: qualTeams, loading: qualLoading } = useQualData()

  const allTeams = useMemo(
    () => mergeTeamLists(matchTeams, qualTeams),
    [matchTeams, qualTeams],
  )
  const orderedTeams = useMemo(() => orderedTeamIds(safeSelected), [safeSelected])

  const matchRowsByTeam = useMemo(() => {
    const grouped = new Map(orderedTeams.map(team => [team, []]))
    for (const row of matchRows || []) {
      const team = teamFromMatchRow(row)
      if (grouped.has(team)) grouped.get(team).push(row)
    }
    return grouped
  }, [matchRows, orderedTeams])

  const qualRowsByTeam = useMemo(() => {
    const grouped = new Map(orderedTeams.map(team => [team, []]))
    for (const row of qualRows || []) {
      for (const team of orderedTeams) {
        if (qualRowHasTeam(row, team)) grouped.get(team).push(row)
      }
    }
    return grouped
  }, [qualRows, orderedTeams])

  return (
    <div className="role-page">
      <h1>Defense</h1>
      <p className="role-lead">
        Pin, ram, block, steal, and penalties come from scouting. A check means they did that in at least one match.
        Defense rating averages only matches with a checked action or more than 0 stars. Qual notes are the defense field only.
      </p>

      <TeamSelector
        allTeams={allTeams}
        selectedTeams={safeSelected}
        onTeamToggle={handleTeamToggle(setSelectedTeams)}
        onClearAll={() => setSelectedTeams([])}
        title="Filter teams"
        showByDefault
      />

      {orderedTeams.length === 0 ? (
        <p>Select one or more teams to view defense data.</p>
      ) : (
        <>
          <section className="role-section">
            <div className="team-data-header">
              <h2>Scouting app</h2>
            </div>
            {matchLoading ? (
              <Loading message="Loading scouting defense data..." />
            ) : (
              <div className="role-team-grid">
                {orderedTeams.map(team => (
                  <ScoutingDefenseCard key={`scout-${team}`} team={team} rows={matchRowsByTeam.get(team) || []} />
                ))}
              </div>
            )}
          </section>

          <section className="role-section">
            <div className="team-data-header">
              <h2>Qual data</h2>
              <label className="filter-label role-toggle">
                <input
                  type="checkbox"
                  checked={hideEmptyQual}
                  onChange={event => setHideEmptyQual(event.target.checked)}
                />
                Hide empty defense notes
              </label>
            </div>
            {qualLoading ? (
              <Loading message="Loading qual defense notes..." />
            ) : (
              <div className="role-team-grid">
                {orderedTeams.map(team => (
                  <QualDefenseCard
                    key={`qual-${team}`}
                    team={team}
                    rows={qualRowsByTeam.get(team) || []}
                    hideEmpty={hideEmptyQual}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default Defense
