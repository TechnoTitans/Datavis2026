import { parseMatchNumber } from './helpers.js'

export const MATCH_POSITIONS = ['R1', 'R2', 'R3', 'B1', 'B2', 'B3']

export function findMissingMatches(rows) {
  let maxMatch = 0
  const present = new Set()
  for (const row of rows) {
    const match = parseMatchNumber(row['Scouting ID'])
    if (!Number.isSafeInteger(match) || match < 1) continue
    maxMatch = Math.max(maxMatch, match)
    const position = String(row.Position ?? '').trim().toUpperCase()
    present.add(`${match}-${position}`)
  }

  const missing = []
  for (let match = 1; match <= maxMatch; match++) {
    for (const position of MATCH_POSITIONS) {
      if (!present.has(`${match}-${position}`)) missing.push({ match, position })
    }
  }
  return { maxMatch, missing }
}

export async function fetchMissingMatches(client) {
  const rows = []
  // Continue until an empty page, even if the server caps pages below our size.
  for (;;) {
    const { data, error } = await client
      .from('match_data')
      .select('"Scouting ID", "Position"')
      .order('Scouting ID', { ascending: true })
      .range(rows.length, rows.length + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
  }
  return findMissingMatches(rows)
}
