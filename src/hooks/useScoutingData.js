// React views of scouting datasets: team matches and qualification rows.
import { useMemo } from 'react'
import { useDataTable } from './useAppData.js'
import { parseTeamNumber, parseMatchNumber } from '../utils/frontend/matchRecord.js'
import { teamsFromQualRow, toNumber } from '../utils/frontend/scoutingMetrics.js'

export const useTeamData = (selectedTeams = [], useDataOnly = false) => {
  const { rows, loading, error, reload } = useDataTable('match_data')
  const allTeams = useMemo(() => [...new Set(rows.map(row => parseTeamNumber(row['Scouting ID']))
    .filter(team => team != null))].sort((a, b) => a - b), [rows])
  const matchRows = useMemo(() => {
    const teams = new Set(selectedTeams.map(String))
    return rows.filter(row => teams.has(String(parseTeamNumber(row['Scouting ID']))) &&
      (!useDataOnly || row['Use Data'] === true || row['Use Data'] === 'true'))
      .map(row => ({ ...row, team: parseTeamNumber(row['Scouting ID']) }))
      .sort((a, b) => a.team - b.team || parseMatchNumber(a['Scouting ID']) - parseMatchNumber(b['Scouting ID']))
  }, [rows, selectedTeams, useDataOnly])
  return { allTeams, matchRows, loading, error, reloadData: reload }
}

export const useQualData = () => {
  const { rows, loading, error } = useDataTable('qual_data')

  const teams = useMemo(() => {
    const unique = new Set()
    for (const row of rows) {
      for (const team of teamsFromQualRow(row)) {
        const numeric = toNumber(team)
        if (numeric != null) unique.add(numeric)
      }
    }
    return [...unique].sort((a, b) => a - b)
  }, [rows])

  return { rows, teams, loading, error }
}
