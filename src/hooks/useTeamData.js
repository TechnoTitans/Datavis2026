import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { parseTeamNumber, parseMatchNumber } from '../utils/helpers'
import { fetchCSVData } from '../utils/csvHandler'

/**
 * Custom hook for fetching and managing team data
 * @param {string[]} selectedTeams - Array of selected team numbers as strings
 * @param {boolean} useDataOnly - Whether to filter for "Use Data" true only
 * @returns {object} - Hook return object with teams, matches, loading state, and functions
 */
export const useTeamData = (selectedTeams = [], useDataOnly = false) => {
  const [allTeams, setAllTeams] = useState([])
  const [matchRows, setMatchRows] = useState([])
  const [loading, setLoading] = useState(false)

    const fetchAllTeams = async () => {
      try {
        let data = null
        try {
          const result = await Promise.race([
            supabase.from('match_data').select('"Scouting ID"'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
          ])
          data = result.data
        } catch (err) {
          console.warn('Supabase fetch failed or timed out, falling back to CSV:', err)
        }
        if (!data) {
          const csvData = await fetchCSVData()
          data = csvData
        }
        const teamNumbers = (data || [])
          .map(row => parseTeamNumber(row["Scouting ID"]))
          .filter(num => num !== null)
        const uniqueTeams = [...new Set(teamNumbers)].sort((a, b) => a - b)
        setAllTeams(uniqueTeams)
      } catch (finalError) {
        console.error('Failed to load match data from all sources:', finalError)
        setAllTeams([])
      } finally {
        setLoading(false)
      }
    }

  // Fetch matches for selected teams
    const fetchMatches = async () => {
      if (!selectedTeams || selectedTeams.length === 0) {
        setMatchRows([])
        return
      }

      setLoading(true)
      try {
        let data = null
        try {
          const result = await Promise.race([
            supabase.from('match_data').select('*'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
          ])
          data = result.data
          console.log("MATCH DATA FROM SUPABASE:", data)
        } catch (err) {
          console.warn('Supabase fetch failed or timed out, falling back to CSV:', err)
        }
        if (!data) {
          const csvData = await fetchCSVData()
          data = csvData
        }
        const selectedTeamsStr = selectedTeams.map(String)
        let filteredRows = []
        for (const row of data) {
          const teamNumber = parseTeamNumber(row["Scouting ID"])
          if (teamNumber && selectedTeamsStr.includes(String(teamNumber))) {
            if (useDataOnly && row["Use Data"] !== 'true' && row["Use Data"] !== true) {
              continue
            }
            const { 
              'Shot Coordinates': _shotCoordinates,
              'Shot While Moving': _shotWhileMoving,
              ...cleanRow
            } = row

            filteredRows.push({ 
              ...cleanRow, 
              team: Number(teamNumber) 
            })
          }
        }
        // Sort by team, then by match number
        filteredRows.sort((a, b) => {
          if (a.team !== b.team) return Number(a.team) - Number(b.team)
          return parseMatchNumber(a["Scouting ID"]) - parseMatchNumber(b["Scouting ID"])
        })
        setMatchRows(filteredRows)
      } catch (finalError) {
        console.error('Failed to load match data from all sources:', finalError)
        setMatchRows([])
      } finally {
        setLoading(false)
      }
    }

  // Reload all data
  const reloadData = async () => {
    await fetchAllTeams()
    await fetchMatches()
  }

  // Fetch data when selectedTeams changes
  useEffect(() => {
    fetchAllTeams()
    fetchMatches()
  }, [selectedTeams.join(','), useDataOnly]) // Use join to avoid unnecessary re-renders

  return {
    allTeams,
    matchRows,
    loading,
    fetchAllTeams,
    fetchMatches,
    reloadData,
    setMatchRows
  }
}