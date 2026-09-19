import { useMemo, useState } from 'react'
import TeamSelector from '../components/TeamSelector'
import Loading from '../components/Loading'
import { useTeamData } from '../hooks/useTeamData'
import { useQualData } from '../hooks/useQualData'
import { useSelectedTeams } from '../hooks/useLocalStorage'
import {
  extractKeywordLinesForTeam,
  formatNumber,
  formatRange,
  mergeTeamLists,
  orderedTeamIds,
  qualRowHasTeam,
  splitKeywordMatches,
  summarizeShooter,
  teamFromMatchRow,
} from '../utils/scoutingMetrics'

const ROLE_COPY = {
  shoot: { label: 'Shoots', className: 'role-badge-shoot' },
  ferry: { label: 'Ferries', className: 'role-badge-ferry' },
  both: { label: 'Shoots and ferries', className: 'role-badge-both' },
  neither: { label: 'Neither recorded', className: 'role-badge-neither' },
}

const handleTeamToggle = (setSelectedTeams) => (teamNumber) => {
  const teamStr = String(teamNumber)
  setSelectedTeams(prev => {
    const current = Array.isArray(prev) ? prev.map(String) : []
    if (current.includes(teamStr)) return current.filter(team => team !== teamStr)
    return [...current, teamStr]
  })
}

function KeywordText({ text, keyword }) {
  const parts = splitKeywordMatches(text, keyword)
  if (!parts.length) return '—'
  return parts.map((part, idx) => (
    part.match
      ? <mark key={`${part.text}-${idx}`} className="keyword-mark">{part.text}</mark>
      : <span key={`${part.text}-${idx}`}>{part.text}</span>
  ))
}

function OptimisticCaption({ summary }) {
  if (!summary.optimisticRange) {
    return 'No cycle or tier values recorded yet.'
  }
  return 'Optimistic score = cycles × tier point range (T1: 0–20, T2: 21–40, T3: 41–60), averaged across matches.'
}

function ShooterTeamCard({ team, matchRows, qualRows, keyword, matchLoading, qualLoading }) {
  const summary = useMemo(
    () => summarizeShooter(matchRows, qualRows, keyword, team),
    [matchRows, qualRows, keyword, team],
  )
  const role = ROLE_COPY[summary.role] || ROLE_COPY.neither

  return (
    <article className="role-team-card">
      <div className="role-team-header">
        <h3 className="team-header">Team {team}</h3>
        <div className="role-badge-row">
          <span className={`role-badge ${role.className}`}>{role.label}</span>
          <span className={`role-mini ${summary.shoots ? 'is-on' : 'is-off'}`}>Shoot</span>
          <span className={`role-mini ${summary.ferries ? 'is-on' : 'is-off'}`}>Ferry</span>
        </div>
      </div>

      <div className="role-split">
        <section className="role-panel">
          <h4>Shoot</h4>
          {matchLoading ? (
            <Loading message="Loading scouting records..." />
          ) : summary.matchCount === 0 ? (
            <p>No scouting records for this team.</p>
          ) : (
            <>
              <div className="stat-pill-row">
                <div className="stat-pill">
                  <p className="stat-kicker">Avg cycles</p>
                  <p className="stat-value">{formatNumber(summary.cycleAvg)}</p>
                </div>
                <div className="stat-pill">
                  <p className="stat-kicker">Avg tier</p>
                  <p className="stat-value">{formatNumber(summary.tierAvg)}</p>
                  <p className="stat-kicker">Fuel range: {formatRange(summary.fuelRange)}</p>
                </div>
                <div className="stat-pill stat-pill-accent">
                  <p className="stat-kicker">Avg optimistic score</p>
                  <p className="stat-value">{formatRange(summary.optimisticRange)}</p>
                </div>
              </div>
              <p className="stat-hint"><OptimisticCaption summary={summary} /></p>
              {summary.locationMapOnly ? (
                <p className="stat-hint">Some matches only have a painted shooting zone, so those are counted as shooting but not as cycle/fuel totals.</p>
              ) : null}

              <div className="team-data-table-container">
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th className="sticky-column">Match</th>
                        <th>Cycles</th>
                        <th>Tier</th>
                        <th>Fuel range</th>
                        <th>Optimistic</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.parsedRows.map((entry, idx) => (
                        <tr key={entry.row['Scouting ID'] || `${team}-shot-${idx}`}>
                          <td className="sticky-column">{entry.matchLabel}</td>
                          <td>{formatNumber(entry.metrics.cycleCount, 0)}</td>
                          <td>{entry.metrics.tier ?? '—'}</td>
                          <td>{formatRange(entry.metrics.fuelRange)}</td>
                          <td>{formatRange(entry.metrics.optimisticRange)}</td>
                          <td className="wrap-cell">
                            {entry.notes
                              ? <KeywordText text={entry.notes} keyword={keyword} />
                              : (entry.metrics.paintedLocationMap ? 'Shooting zone mapped' : '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="role-panel">
          <h4>Ferry</h4>
          <p className="stat-hint">
            Scouting comments and qual notes matching “{keyword || 'ferry'}”.
          </p>

          <div className="ferry-block">
            <h5>Scouting comments</h5>
            {summary.ferryNotes.length === 0 ? (
              <p>No scouting comments matched that keyword.</p>
            ) : (
              <ul className="ferry-list">
                {summary.ferryNotes.map((entry, idx) => (
                  <li key={entry.row['Scouting ID'] || `${team}-note-${idx}`}>
                    <span className="ferry-match">{entry.matchLabel}</span>
                    <span className="wrap-cell"><KeywordText text={entry.notes} keyword={keyword} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ferry-block">
            <h5>Qual data</h5>
            {qualLoading ? (
              <Loading message="Loading qual notes..." />
            ) : summary.ferryQual.length === 0 ? (
              <p>No qual notes matched that keyword.</p>
            ) : (
              <div className="team-data-table-container">
                <div className="table-wrapper">
                  <table className="qual-data-table">
                    <thead>
                      <tr>
                        <th className="sticky-column">Match</th>
                        <th>Alliance</th>
                        <th>Field</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.ferryQual.flatMap((row, idx) => {
                        const fields = [
                          ['Defense', row.defense],
                          ['Strategies', row.strategies],
                          ['Misc', row.misc],
                        ].flatMap(([field, value]) => {
                          const excerpt = extractKeywordLinesForTeam(value, keyword, team)
                          return excerpt ? [[field, excerpt]] : []
                        })

                        if (fields.length === 0) return []

                        return fields.map(([field, value]) => (
                          <tr key={`${row.id || idx}-${field}`}>
                            <td className="sticky-column">{row.match || '—'}</td>
                            <td>{row.alliance || '—'}</td>
                            <td>{field}</td>
                            <td className="wrap-cell"><KeywordText text={value} keyword={keyword} /></td>
                          </tr>
                        ))
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </article>
  )
}

function ShooterFerry() {
  const [selectedTeams, setSelectedTeams] = useSelectedTeams('selectedTeamsShooterFerry', [])
  const [keyword, setKeyword] = useState('ferry')
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
  const activeKeyword = keyword.trim() || 'ferry'

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
      <h1>Shooter / Ferrying</h1>
      <p className="role-lead">
        Shooting comes from scouted cycles and tier. Ferrying is keyword-matched from scouting comments and qual notes.
        Optimistic score multiplies cycles by the point range of the shooting tier (T1: 0–20, T2: 21–40, T3: 41–60),
        averaged across matches.
      </p>

      <TeamSelector
        allTeams={allTeams}
        selectedTeams={safeSelected}
        onTeamToggle={handleTeamToggle(setSelectedTeams)}
        onClearAll={() => setSelectedTeams([])}
        title="Filter teams"
        showByDefault
      />

      <div className="filter-row">
        <label className="filter-label">
          Ferry keyword
          <input
            className="filter-input"
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            placeholder="ferry"
          />
        </label>
      </div>

      {orderedTeams.length === 0 ? (
        <p>Select one or more teams to see whether they shoot or ferry.</p>
      ) : (
        <div className="role-team-grid">
          {orderedTeams.map(team => (
            <ShooterTeamCard
              key={team}
              team={team}
              matchRows={matchRowsByTeam.get(team) || []}
              qualRows={qualRowsByTeam.get(team) || []}
              keyword={activeKeyword}
              matchLoading={matchLoading}
              qualLoading={qualLoading}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ShooterFerry