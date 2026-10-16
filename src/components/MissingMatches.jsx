import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { fetchMissingMatches } from '../utils/missingMatches'

export default function MissingMatches() {
  const [missing, setMissing] = useState([])

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        if (!supabase) return
        const result = await fetchMissingMatches(supabase)
        if (!cancelled) setMissing(result.missing)
      } catch (err) {
        console.error('Unable to check missing matches:', err)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (missing.length === 0) return null

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4" aria-labelledby="missing-matches-title">
      <h2 id="missing-matches-title">Missing Matches:</h2>
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Missing match positions">
        {missing.map(({ match, position }) => (
          <li key={`${match}-${position}`} className="rounded-md border border-border px-3 py-1 text-sm">
            {match} · {position}
          </li>
        ))}
      </ul>
    </section>
  )
}
