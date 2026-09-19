/**
 * Season match schema.
 *
 * This is the only file that should need edits when the scouting app or game
 * year changes. QR payloads are newline-separated:
 *   1. team number
 *   2. match number
 *   3+. one line per MATCH_FIELDS entry, in this list's order
 *
 * `type` controls QR / CSV parsing:
 *   string   | raw text
 *   nullable | text, or null when the line is "null"
 *   int      | integer (0/1 flags are ints)
 *   bool     | true/false
 *
 * `role` lets the rest of the app find fields without hardcoding names:
 *   defense-action | pin/ram/block/steal-style 0/1 flags
 *   defense-rating | overall defense score
 *   cycles         | cycle / shot count
 *
 * `aliases` are older column names still accepted when reading data.
 * `compare: true` includes the field on the Compare page.
 */

export const EVENT_CODE = 'GACMP'

export const MATCH_FIELDS = [
  { key: 'Scouter Name', type: 'string' },
  { key: 'Position', type: 'string' },
  { key: 'Auto Path', type: 'nullable' },
  { key: 'Cycle Count', type: 'int', role: 'cycles', aliases: ['Shot Coordinates'], compare: true },
  { key: 'Tier', type: 'int', compare: true },
  { key: 'Pins', type: 'int', role: 'defense-action', label: 'Pin', aliases: ['Pin Rating', 'Pin'], compare: true },
  { key: 'Steals', type: 'int', role: 'defense-action', label: 'Steal', aliases: ['Steal Rating', 'Steal'], compare: true },
  { key: 'Blocks', type: 'int', role: 'defense-action', label: 'Block', aliases: ['Block Rating', 'Block'], compare: true },
  { key: 'Rams', type: 'int', role: 'defense-action', label: 'Ram', aliases: ['Ram Rating', 'Ram'], compare: true },
  { key: 'Defense Rating', type: 'int', role: 'defense-rating', aliases: ['Defense Ability', 'Defense'], compare: true },
  { key: 'Endgame Climb', type: 'string' },
  { key: 'Bump?', type: 'bool', compare: true },
  { key: 'Trench?', type: 'bool', compare: true },
  { key: 'Penalties?', type: 'bool', compare: true },
  { key: 'Broke Down?', type: 'bool', compare: true },
  { key: 'Notes', type: 'string' },
]

export const MATCH_COLUMN_KEYS = [
  'Scouting ID',
  ...MATCH_FIELDS.map(field => field.key),
  'Use Data',
]

export const QR_LINE_COUNT = 2 + MATCH_FIELDS.length

export const DEFENSE_ACTIONS = MATCH_FIELDS
  .filter(field => field.role === 'defense-action')
  .map(field => ({
    key: (field.label || field.key).toLowerCase(),
    label: field.label || field.key,
    columns: [field.key, ...(field.aliases || [])],
  }))

export const DEFENSE_RATING_COLUMNS = MATCH_FIELDS
  .filter(field => field.role === 'defense-rating')
  .flatMap(field => [field.key, ...(field.aliases || [])])

export const CYCLE_COLUMNS = MATCH_FIELDS
  .filter(field => field.role === 'cycles')
  .flatMap(field => [field.key, ...(field.aliases || []), 'cycleCount', 'shots'])

export const COMPARE_FIELDS = MATCH_FIELDS
  .filter(field => field.compare)
  .map(field => ({
    id: field.label || field.key.replace(/\?$/, ''),
    key: field.key,
    aliases: field.aliases || [],
    type: field.type === 'bool' ? 'bool' : 'number',
  }))

export const getFieldByColumn = (column) =>
  MATCH_FIELDS.find(field => field.key === column || (field.aliases || []).includes(column)) || null
