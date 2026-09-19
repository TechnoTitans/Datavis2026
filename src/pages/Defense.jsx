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
            <p className="stat-hint">Average scouted Defense Rating across matches. Pin, ram, block, and steal are 0/1 did-or-didn’t flags.</p>
          </div>

          <div className="defense-flag-grid" role="list" aria-label={`Defense actions for team ${team}`}>
            {summary.actions.map(action => (
              <DefenseAction key={action.key} action={action} binary={summary.binary} />
            ))}
          </div>

          <div className="team-data-table-container">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th className="sticky-column">Match</th>
                    <th>Pin</th>
                    <th>Ram</th>
                    <th>Block</th>
                    <th>Steal</th>
                    <th>General</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const pin = getDefenseActionValue(row, DEFENSE_ACTIONS[0])
                    const ram = getDefenseActionValue(row, DEFENSE_ACTIONS[1])
                    const block = getDefenseActionValue(row, DEFENSE_ACTIONS[2])
                    const steal = getDefenseActionValue(row, DEFENSE_ACTIONS[3])
                    const general = getDefenseRatingValue(row)
                    return (
                      <tr key={row['Scouting ID'] || `${team}-${idx}`}>
                        <td className="sticky-column">{formatMatchLabel(row)}</td>
                        <td className={pin > 0 ? 'rating-hot' : ''}>{formatNumber(pin, 0)}</td>
                        <td className={ram > 0 ? 'rating-hot' : ''}>{formatNumber(ram, 0)}</td>
                        <td className={block > 0 ? 'rating-hot' : ''}>{formatNumber(block, 0)}</td>
                        <td className={steal > 0 ? 'rating-hot' : ''}>{formatNumber(steal, 0)}</td>
                        <td>{formatNumber(general, 0)}</td>
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
        Pin, ram, block, and steal come from scouting ratings. A check means they did that action in at least one match.
        Qual notes are isolated to the defense field only.
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
