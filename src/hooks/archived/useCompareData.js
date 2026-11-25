import { useMemo, useState, useEffect } from 'react'
import { useTeamData } from '../useScoutingData.js'
import { readTable, subscribeData } from '../../utils/backend/data/dataAccessor.js'

const OFFICIAL_TABLE_CANDIDATES = ['tba_data', 'tba_matches', 'statbotics_matches']

export const useCompareData = ({
  selectedTeams = [],
  useDataOnly = true,
  selectedScouters = [],
}) => {
  const {
    allTeams,
    matchRows: rawMatchRows,
    loading: scouterLoading,
    error: scouterError,
  } = useTeamData(selectedTeams, useDataOnly)

  const [tbaRows, setTbaRows] = useState([])
  const [officialTableUsed, setOfficialTableUsed] = useState(null)
  const [error, setError] = useState(null)


  // Load cached official data
  useEffect(() => {
    let active = true
    const load = async () => {
      for (const table of OFFICIAL_TABLE_CANDIDATES) {
        try {
          const rows = await readTable(table)
          if (!active) return
          if (rows.length) { setTbaRows(rows); setOfficialTableUsed(table); setError(null); return }
        } catch { /* Optional official tables may not exist. */ }
      }
      if (active) { setTbaRows([]); setOfficialTableUsed(null); setError('Official data is unavailable.') }
    }
    void load()
    const unsubscribe = subscribeData(key => { if (OFFICIAL_TABLE_CANDIDATES.includes(key)) void load() })
    return () => { active = false; unsubscribe() }
  }, [])

  // Extract scouter names from the data
  const scouterNames = useMemo(() => {
    return Array.from(
      new Set(
        (rawMatchRows || [])
          .map((row) => String(row['Scouter Name'] || row._scouterName || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [rawMatchRows])

  // Filter by selected scouters
  const selectedScouterSet = useMemo(
    () => new Set((selectedScouters || []).map((name) => String(name).trim()).filter(Boolean)),
    [selectedScouters],
  )

  const matchRows = useMemo(() => {
    let filtered = [...(rawMatchRows || [])]
    
    // Filter by selected scouters if any are selected
    if (selectedScouterSet.size > 0) {
      filtered = filtered.filter((row) => {
        const scouterName = String(row['Scouter Name'] || row._scouterName || '').trim()
        return selectedScouterSet.has(scouterName)
      })
    }

    // Sort by team, then match number
    filtered.sort((a, b) => {
      const teamA = Number(a.team) || 0
      const teamB = Number(b.team) || 0
      if (teamA !== teamB) return teamA - teamB
      return (a.matchNumber || 0) - (b.matchNumber || 0)
    })

    return filtered
  }, [rawMatchRows, selectedScouterSet])

  // Diagnostics
  const diagnostics = useMemo(() => ({
    scouterRawRows: rawMatchRows.length,
    scouterRowsAfterUseData: matchRows.length,
    officialRows: tbaRows.length,
    totalRowsBeforeTeamFilter: rawMatchRows.length + tbaRows.length,
  }), [rawMatchRows, matchRows, tbaRows])

  return {
    allTeams,
    matchRows,
    tbaRows,
    scouterNames,
    loading: scouterLoading,
    error: scouterError || error,
    officialTableUsed,
    diagnostics,
  }
}
