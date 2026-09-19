import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { teamsFromQualRow, toNumber } from '../utils/scoutingMetrics'

export const useQualData = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const fetchQualData = async () => {
      setLoading(true)
      setError(null)
      try {
        if (!supabase) {
          if (!cancelled) {
            setRows([])
            setError('Supabase is not configured.')
          }
          return
        }

        const result = await Promise.race([
          supabase.from('qual_data').select('*'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ])
        if (result.error) throw result.error
        if (!cancelled) setRows(result.data || [])
      } catch (err) {
        console.error('Error fetching qual_data:', err)
        if (!cancelled) {
          setRows([])
          setError(err.message || 'Failed to load qual data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchQualData()
    return () => {
      cancelled = true
    }
  }, [])

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
