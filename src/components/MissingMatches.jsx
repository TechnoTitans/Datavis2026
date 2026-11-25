import { useMemo } from 'react'
import { useDataTable } from '../hooks/useAppData.js'
import { findMissingMatches } from '../utils/frontend/matchRecord.js'

export default function MissingMatches() {
  const { rows, error } = useDataTable('match_data')
  const { missing } = useMemo(() => findMissingMatches(rows), [rows])
  if (error || missing.length === 0) return null
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
