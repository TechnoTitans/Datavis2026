import { enqueueOp } from './offlineQueue'
import { supabase } from '../supabaseClient'
import { pickMatchRecord } from './matchRecord'

const isLikelyNetworkError = (err) => {
  if (!err) return false
  const message = String(err.message || err)
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed') ||
    message.includes('fetch')
  )
}

const isDuplicateKeyError = (err) => {
  if (!err) return false
  const code = err.code
  const message = String(err.message || '')
  return code === '23505' || message.toLowerCase().includes('duplicate key')
}

const enqueueAndReturn = async (op) => {
  await enqueueOp(op)
  return { queued: true }
}

const runOrQueue = async (op, runner) => {
  if (!supabase) {
    return await enqueueAndReturn(op)
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return await enqueueAndReturn(op)
  }

  try {
    const result = await runner()
    if (result?.error) {
      if (isLikelyNetworkError(result.error)) return await enqueueAndReturn(op)
      if (op.type === 'insertUnconfirmedData' && isDuplicateKeyError(result.error)) return { queued: false }
      return { queued: false, error: result.error }
    }
    return { queued: false, data: result?.data }
  } catch (err) {
    if (isLikelyNetworkError(err)) return await enqueueAndReturn(op)
    return { queued: false, error: err }
  }
}

export const updateMatchUseData = async ({ scoutingId, value }) => {
  return await runOrQueue(
    {
      type: 'updateMatchUseData',
      dedupeKey: `updateMatchUseData:${scoutingId}`,
      payload: { scoutingId, value },
    },
    async () =>
      await supabase
        .from('match_data')
        .update({ 'Use Data': value })
        .eq('"Scouting ID"', scoutingId)
        .select(),
  )
}

export const insertUnconfirmedData = async (row) => {
  console.log("INSERTING UNCONFIRMED:", row)

  const scoutingId = row?.['Scouting ID']
  return await runOrQueue(
    {
      type: 'insertUnconfirmedData',
      dedupeKey: scoutingId ? `insertUnconfirmedData:${scoutingId}` : null,
      payload: { row },
    },
    async () => await supabase.from('unconfirmed_data').insert([row]).select(),
  )
}

export const approveUnconfirmedData = async (unconfirmedItem) => {
  const scoutingId = unconfirmedItem?.['Scouting ID']
  return await runOrQueue(
    {
      type: 'approveUnconfirmedData',
      dedupeKey: scoutingId ? `approveUnconfirmedData:${scoutingId}` : null,
      payload: { unconfirmedItem },
    },
    async () => {
      await supabase.from('match_data').delete().eq('"Scouting ID"', scoutingId)

      const matchData = pickMatchRecord(unconfirmedItem)

      console.log("APPROVING MATCH DATA:", matchData)
      const insertResult = await supabase.from('match_data').insert([matchData])
      if (insertResult.error) return insertResult

      const deleteUnconfirmedResult = await supabase
        .from('unconfirmed_data')
        .delete()
        .eq('"Scouting ID"', scoutingId)
      if (deleteUnconfirmedResult.error) return deleteUnconfirmedResult

      return { data: true, error: null }
    },
  )
}

export const rejectUnconfirmedData = async (scoutingId) => {
  return await runOrQueue(
    {
      type: 'rejectUnconfirmedData',
      dedupeKey: `rejectUnconfirmedData:${scoutingId}`,
      payload: { scoutingId },
    },
    async () => await supabase.from('unconfirmed_data').delete().eq('"Scouting ID"', scoutingId),
  )
}
