import { supabase, supabaseConfigured } from '../../../backend/data/supabaseClient'

import { readTable, readResource } from '../../../backend/data/dataAccessor.js'
const TBA_BASE = 'https://www.thebluealliance.com/api/v3'
let districtKey = null
export const configurePicklist = options => { districtKey = options.districtKey || null }

const ensureSupabase = () => {
  if (globalThis.navigator?.onLine === false) throw new Error('This action requires an internet connection.')
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY.')
  }
}

const tbaFetch = path => readResource(`tba:${path}`, async () => {
  ensureSupabase()
  const apiKey = import.meta.env.VITE_TBA_API_KEY
  if (!apiKey) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${TBA_BASE}${path}`, { headers: { 'X-TBA-Auth-Key': apiKey }, signal: controller.signal })
    if (!res.ok) throw new Error(`TBA request failed (${res.status})`)
    return await res.json()
  } finally { clearTimeout(timeout) }
})

const parseEventKeyFromScoutingId = (scoutingId) => {
  if (typeof scoutingId !== 'string') return null
  const parts = scoutingId.split('_')
  return parts.length > 0 && parts[0] ? parts[0] : null
}

const parseTeamFromScoutingId = (scoutingId) => {
  if (typeof scoutingId !== 'string') return null
  const parts = scoutingId.split('_')
  if (parts.length < 2) return null
  const team = Number(parts[1])
  return Number.isFinite(team) ? team : null
}

const coerceRank = (row) => {
  const rankValue = row?.rank ?? row?.num
  const rank = Number(rankValue)
  return Number.isFinite(rank) ? rank : null
}

const callRpc = async (fnName, args = {}) => {
  ensureSupabase()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const { data, error } = await supabase.rpc(fnName, args).abortSignal(controller.signal)
    if (error) throw error
    return data
  } finally { clearTimeout(timeout) }
}

export const getPicklistEventKeys = async () => {

  const scoutingEventsPromise = readTable('match_data').then(data => {
      const events = new Map()
      for (const row of data || []) {
        const key = parseEventKeyFromScoutingId(row?.['Scouting ID'])
        if (key) events.set(key, key)
      }
      return events
    })

  const tbaEventsPromise = (districtKey ? tbaFetch(`/district/${districtKey}/events`) : Promise.resolve([])).then(
    (events) => {
      const map = new Map()
      if (!Array.isArray(events)) return map
      for (const e of events) {
        if (e.key) map.set(e.key, e.name || e.key)
      }
      return map
    },
  )

  const [scoutingEvents, tbaEvents] = await Promise.all([
    scoutingEventsPromise,
    tbaEventsPromise.catch(() => new Map()),
  ])

  const merged = new Map()
  for (const [key, name] of tbaEvents) merged.set(key, name)
  for (const [key, name] of scoutingEvents) {
    if (!merged.has(key)) merged.set(key, name)
  }

  return Array.from(merged.entries())
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

const fetchTbaTeams = async (eventKey) => {
  const teams = await tbaFetch(`/event/${eventKey}/teams/simple`)
  if (!Array.isArray(teams)) return []
  return teams
    .map((t) => t.team_number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
}

export const getMasterTeamsWithRank = async (eventKey) => {
  if (!eventKey) return []

  const scoutingRows = (await readTable('match_data')).filter(row => row['Scouting ID']?.startsWith(`${eventKey}_`))

  const teamSet = new Set()
  for (const row of scoutingRows || []) {
    const team = parseTeamFromScoutingId(row?.['Scouting ID'])
    if (team) teamSet.add(team)
  }

  if (teamSet.size === 0) {
    const tbaTeams = await fetchTbaTeams(eventKey)
    if (tbaTeams.length > 0) {
      return tbaTeams.map((teamNumber) => ({ teamNumber, rank: null }))
    }
    return []
  }

  const teamNumbers = Array.from(teamSet).sort((a, b) => a - b)

  let statboticsRows = []
  try { statboticsRows = await readTable('statbotics_data') }
  catch (error) { console.warn('[Picklist] Statbotics ranks unavailable:', error) }

  const rankMap = new Map()
  const sortedRows = [...statboticsRows].sort((a, b) => {
    const aTime = a?.created_at ? Date.parse(a.created_at) : 0
    const bTime = b?.created_at ? Date.parse(b.created_at) : 0
    return bTime - aTime
  })

  for (const row of sortedRows) {
    const team = Number(row?.team)
    if (!Number.isFinite(team) || !teamSet.has(team) || rankMap.has(team)) continue
    const rank = coerceRank(row)
    if (rank !== null) rankMap.set(team, rank)
  }

  const result = teamNumbers.map(teamNumber => ({
    teamNumber,
    rank: rankMap.has(teamNumber) ? rankMap.get(teamNumber) : null,
  }))

  result.sort((a, b) => {
    const aMissing = a.rank === null
    const bMissing = b.rank === null
    if (aMissing && bMissing) return a.teamNumber - b.teamNumber
    if (aMissing) return 1
    if (bMissing) return -1
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.teamNumber - b.teamNumber
  })

  return result
}

export const hasGlobalPicklistPasscode = async () => {
  const data = await callRpc('picklist_has_passcode')
  return Boolean(data)
}

export const verifyGlobalPicklistPasscode = async (passcode) => {
  const data = await callRpc('picklist_verify_passcode', { p_passcode: passcode })
  return Boolean(data)
}

export const setGlobalPicklistPasscode = async ({ currentPasscode, newPasscode }) => {
  const data = await callRpc('picklist_set_passcode', {
    p_current_passcode: currentPasscode || null,
    p_new_passcode: newPasscode,
  })
  return Boolean(data)
}

export const getOrCreatePicklistBoardSnapshot = (eventKey, options) => readResource(
  `picklist:${eventKey}`, () => callRpc('picklist_get_or_create_board', { p_event_key: eventKey }), options,
)

export const createPicklistList = async ({ eventKey, title, passcode }) => {
  return await callRpc('picklist_create_list', {
    p_event_key: eventKey,
    p_title: title,
    p_passcode: passcode,
  })
}

export const renamePicklistList = async ({ listId, title, passcode }) => {
  return await callRpc('picklist_rename_list', {
    p_list_id: listId,
    p_title: title,
    p_passcode: passcode,
  })
}

export const deletePicklistList = async ({ listId, passcode }) => {
  return await callRpc('picklist_delete_list', {
    p_list_id: listId,
    p_passcode: passcode,
  })
}

export const addPicklistEntry = async ({ listId, teamNumber, targetPosition, note, passcode }) => {
  return await callRpc('picklist_add_entry', {
    p_list_id: listId,
    p_team_number: teamNumber,
    p_target_position: targetPosition ?? null,
    p_note: note ?? '',
    p_passcode: passcode,
  })
}

export const movePicklistEntry = async ({ entryId, targetListId, targetPosition, passcode }) => {
  return await callRpc('picklist_move_entry', {
    p_entry_id: entryId,
    p_target_list_id: targetListId,
    p_target_position: targetPosition ?? null,
    p_passcode: passcode,
  })
}

export const reorderPicklistEntries = async ({ listId, entryIds, passcode }) => {
  return await callRpc('picklist_reorder_entries', {
    p_list_id: listId,
    p_entry_ids: entryIds,
    p_passcode: passcode,
  })
}

export const removePicklistEntry = async ({ entryId, passcode }) => {
  return await callRpc('picklist_remove_entry', {
    p_entry_id: entryId,
    p_passcode: passcode,
  })
}

export const updatePicklistEntryNote = async ({ entryId, note, passcode }) => {
  return await callRpc('picklist_update_entry_note', {
    p_entry_id: entryId,
    p_note: note ?? '',
    p_passcode: passcode,
  })
}

export const parsePicklistSnapshot = (snapshot) => {
  if (!snapshot) {
    return {
      boardId: null,
      eventKey: null,
      lists: [],
    }
  }

  const lists = Array.isArray(snapshot.lists)
    ? snapshot.lists.map(list => {
        const entries = Array.isArray(list.entries)
          ? list.entries
              .map(entry => ({
                id: Number(entry.id),
                listId: Number(list.id),
                teamNumber: Number(entry.team_number),
                position: Number(entry.position) || 0,
                note: entry.note || '',
              }))
              .sort((a, b) => a.position - b.position || a.id - b.id)
          : []

        return {
          id: Number(list.id),
          title: list.title || 'Untitled',
          position: Number(list.position) || 0,
          entries,
        }
      })
    : []

  lists.sort((a, b) => a.position - b.position || a.id - b.id)

  return {
    boardId: Number(snapshot.board_id) || null,
    eventKey: snapshot.event_key || null,
    lists,
  }
}


export const getTeamEventStatus = (teamNumber, eventKey) => tbaFetch(`/team/frc${teamNumber}/event/${eventKey}/status`)
