import '../../styles/archived/page-styles.css'
import '../../utils/archived/frontend/picklistConfiguration.js'
import { subscribeData } from '../../utils/backend/data/dataAccessor.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Button } from '../../components/archived/ui/button'
import { Badge } from '../../components/archived/ui/badge'
import { supabaseConfigured } from '../../utils/backend/data/supabaseClient'
import {
  addPicklistEntry,
  createPicklistList,
  deletePicklistList,
  getMasterTeamsWithRank,
  getOrCreatePicklistBoardSnapshot,
  getPicklistEventKeys,
  hasGlobalPicklistPasscode,
  movePicklistEntry,
  parsePicklistSnapshot,
  removePicklistEntry,
  renamePicklistList,
  reorderPicklistEntries,
  setGlobalPicklistPasscode,
  updatePicklistEntryNote,
  verifyGlobalPicklistPasscode,
} from '../../utils/archived/backend/data/picklistApi'
import '../../styles/archived/picklist.css'

const STORAGE_SELECTED_EVENT = 'picklistSelectedEvent'
const SESSION_UNLOCKED = 'picklistUnlocked'
const SESSION_PASSCODE = 'picklistPasscode'
const MASTER_PREFIX = 'master:'
const ENTRY_PREFIX = 'entry:'
const LIST_PREFIX = 'list:'

const emptyBoardState = { boardId: null, eventKey: null, lists: [] }

const formatTimestamp = (date) => {
  if (!date) return 'Never'
  return date.toLocaleTimeString()
}

const parseDragNumber = (raw, prefix) => {
  if (!raw || !raw.startsWith(prefix)) return null
  const value = Number(raw.slice(prefix.length))
  return Number.isFinite(value) ? value : null
}

function MasterTeamRow({ team, disabled }) {
  const dragId = `${MASTER_PREFIX}${team.teamNumber}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: dragId,
    data: { type: 'master-team', teamNumber: team.teamNumber },
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={[
        'picklist-row',
        isDragging ? 'picklist-row-dragging' : '',
        disabled ? 'picklist-row-locked' : '',
      ].join(' ')}
    >
      <td className="picklist-drag-cell">
        <button
          type="button"
          className="picklist-drag-handle"
          disabled={disabled}
          aria-label={`Drag team ${team.teamNumber}`}
          {...listeners}
          {...attributes}
        >
          ::
        </button>
      </td>
      <td>{team.teamNumber}</td>
      <td>{team.rank ?? '—'}</td>
    </tr>
  )
}

function SortableEntryRow({
  listId,
  entry,
  disabled,
  rankByTeam,
  noteValue,
  onNoteChange,
  onNoteBlur,
  onRemove,
}) {
  const sortableId = `${ENTRY_PREFIX}${entry.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { type: 'entry', entryId: entry.id, listId, teamNumber: entry.teamNumber },
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={[
        'picklist-row',
        isDragging ? 'picklist-row-dragging' : '',
        disabled ? 'picklist-row-locked' : '',
      ].join(' ')}
    >
      <td className="picklist-drag-cell">
        <button
          type="button"
          className="picklist-drag-handle"
          disabled={disabled}
          aria-label={`Reorder team ${entry.teamNumber}`}
          {...listeners}
          {...attributes}
        >
          ::
        </button>
      </td>
      <td>{entry.teamNumber}</td>
      <td>{rankByTeam.get(entry.teamNumber) ?? '—'}</td>
      <td>
        <input
          type="text"
          value={noteValue}
          disabled={disabled}
          onChange={(e) => onNoteChange(entry.id, e.target.value)}
          onBlur={() => onNoteBlur(entry.id)}
          className="picklist-note-input"
          placeholder="Notes"
        />
      </td>
      <td>
        <button
          type="button"
          className="picklist-remove-btn"
          disabled={disabled}
          onClick={() => onRemove(entry.id)}
        >
          Remove
        </button>
      </td>
    </tr>
  )
}

function PicklistListCard({
  list,
  disabled,
  titleValue,
  onTitleChange,
  onTitleBlur,
  onDelete,
  rankByTeam,
  noteDrafts,
  onNoteChange,
  onNoteBlur,
  onRemove,
}) {
  const listDropId = `${LIST_PREFIX}${list.id}`
  const sortableIds = list.entries.map(entry => `${ENTRY_PREFIX}${entry.id}`)
  const { setNodeRef, isOver } = useDroppable({
    id: listDropId,
    data: { type: 'list', listId: list.id },
  })

  return (
    <article
      ref={setNodeRef}
      className={['picklist-list-card', isOver ? 'picklist-list-over' : ''].join(' ')}
    >
      <div className="picklist-list-card-header">
        <input
          type="text"
          className="picklist-list-title-input"
          value={titleValue}
          disabled={disabled}
          onChange={(e) => onTitleChange(list.id, e.target.value)}
          onBlur={() => onTitleBlur(list.id)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onDelete(list.id, list.title)}
        >
          Delete
        </Button>
      </div>

      <div className="picklist-table-wrap">
        <table className="picklist-table">
          <thead>
            <tr>
              <th></th>
              <th>Team #</th>
              <th>Rank</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {list.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="picklist-empty-cell">
                    Drop teams here.
                  </td>
                </tr>
              ) : (
                list.entries.map((entry) => (
                  <SortableEntryRow
                    key={entry.id}
                    listId={list.id}
                    entry={entry}
                    disabled={disabled}
                    rankByTeam={rankByTeam}
                    noteValue={noteDrafts[entry.id] ?? entry.note}
                    onNoteChange={onNoteChange}
                    onNoteBlur={onNoteBlur}
                    onRemove={onRemove}
                  />
                ))
              )}
            </SortableContext>
          </tbody>
        </table>
      </div>
    </article>
  )
}

function Picklist() {
  const [eventKeys, setEventKeys] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(() => localStorage.getItem(STORAGE_SELECTED_EVENT) || '')
  const [masterTeams, setMasterTeams] = useState([])
  const [board, setBoard] = useState(emptyBoardState)
  const [loadingData, setLoadingData] = useState(false)
  const [refreshingEvents, setRefreshingEvents] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const [hasPasscode, setHasPasscode] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [unlockedPasscode, setUnlockedPasscode] = useState('')

  const [setPasscodeValue, setSetPasscodeValue] = useState('')
  const [setPasscodeConfirm, setSetPasscodeConfirm] = useState('')
  const [unlockPasscodeValue, setUnlockPasscodeValue] = useState('')
  const [changeCurrentPasscode, setChangeCurrentPasscode] = useState('')
  const [changeNewPasscode, setChangeNewPasscode] = useState('')
  const [changeNewPasscodeConfirm, setChangeNewPasscodeConfirm] = useState('')

  const [newListTitle, setNewListTitle] = useState('')
  const [titleDrafts, setTitleDrafts] = useState({})
  const [noteDrafts, setNoteDrafts] = useState({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const rankByTeam = useMemo(() => {
    const map = new Map()
    for (const row of masterTeams) {
      map.set(row.teamNumber, row.rank)
    }
    return map
  }, [masterTeams])

  const clearUnlockState = useCallback(() => {
    sessionStorage.removeItem(SESSION_UNLOCKED)
    sessionStorage.removeItem(SESSION_PASSCODE)
    setIsUnlocked(false)
    setUnlockedPasscode('')
  }, [])

  const setUnlockState = useCallback((passcode) => {
    sessionStorage.setItem(SESSION_UNLOCKED, 'true')
    sessionStorage.setItem(SESSION_PASSCODE, passcode)
    setIsUnlocked(true)
    setUnlockedPasscode(passcode)
  }, [])

  const loadPicklistData = useCallback(async (eventKey, options = {}) => {
    const { silent = false, showErrorToast = true, refresh = false } = options
    if (!supabaseConfigured) return
    if (!eventKey) {
      setMasterTeams([])
      setBoard(emptyBoardState)
      return
    }

    if (!silent) setLoadingData(true)
    try {
      const [teams, snapshot] = await Promise.all([
        getMasterTeamsWithRank(eventKey),
        getOrCreatePicklistBoardSnapshot(eventKey, { refresh }),
      ])
      setMasterTeams(teams)
      setBoard(parsePicklistSnapshot(snapshot))
      setLastUpdatedAt(new Date())
    } catch (error) {
      console.error('[Picklist] Failed loading board:', error)
      if (showErrorToast) {
        toast.error(`Failed to load picklist data: ${error.message || error}`)
      }
    } finally {
      if (!silent) setLoadingData(false)
    }
  }, [])

  const refreshEventKeys = useCallback(async () => {
    if (!supabaseConfigured) return
    setRefreshingEvents(true)
    try {
      const events = await getPicklistEventKeys()
      setEventKeys(events)
      setSelectedEvent((current) => {
        if (events.some((e) => e.key === current)) return current
        return events[0]?.key || ''
      })
    } catch (error) {
      console.error('[Picklist] Failed loading event keys:', error)
      toast.error(`Could not load events: ${error.message || error}`)
    } finally {
      setRefreshingEvents(false)
    }
  }, [])

  const loadPasscodeState = useCallback(async () => {
    if (!supabaseConfigured) return
    try {
      const has = await hasGlobalPicklistPasscode()
      setHasPasscode(has)
      if (!has) {
        clearUnlockState()
        return
      }

      const storedUnlocked = sessionStorage.getItem(SESSION_UNLOCKED) === 'true'
      const storedPasscode = sessionStorage.getItem(SESSION_PASSCODE) || ''
      if (!(storedUnlocked && storedPasscode)) {
        clearUnlockState()
        return
      }

      const verified = await verifyGlobalPicklistPasscode(storedPasscode)
      if (verified) {
        setUnlockState(storedPasscode)
      } else {
        clearUnlockState()
      }
    } catch (error) {
      console.error('[Picklist] Failed loading passcode state:', error)
      clearUnlockState()
    }
  }, [clearUnlockState, setUnlockState])

  useEffect(() => {
    refreshEventKeys()
    loadPasscodeState()
  }, [refreshEventKeys, loadPasscodeState])

  useEffect(() => {
    if (!selectedEvent) {
      setMasterTeams([])
      setBoard(emptyBoardState)
      return
    }
    localStorage.setItem(STORAGE_SELECTED_EVENT, selectedEvent)
    loadPicklistData(selectedEvent)
  }, [loadPicklistData, selectedEvent])

  useEffect(() => {
    setTitleDrafts((prev) => {
      const next = {}
      for (const list of board.lists) {
        next[list.id] = prev[list.id] ?? list.title
      }
      return next
    })

    setNoteDrafts((prev) => {
      const next = {}
      for (const list of board.lists) {
        for (const entry of list.entries) {
          next[entry.id] = prev[entry.id] ?? entry.note
        }
      }
      return next
    })
  }, [board.lists])

  useEffect(() => {
    if (!selectedEvent) return
    return subscribeData(key => {
      if (key === `resource:picklist:${selectedEvent}` || key === 'match_data' || key === 'statbotics_data') {
        void loadPicklistData(selectedEvent, { silent: true, showErrorToast: false })
      }
    })
  }, [loadPicklistData, selectedEvent])

  const handleWriteError = useCallback((error) => {
    const message = String(error?.message || error || 'Unknown error')
    if (message.toLowerCase().includes('invalid picklist passcode')) {
      clearUnlockState()
      toast.error('Passcode is invalid or expired. Unlock again to continue editing.')
      return
    }
    toast.error(message)
  }, [clearUnlockState])

  const runProtectedWrite = useCallback(async (operation, options = {}) => {
    const { reload = true, successMessage = '' } = options
    if (!isUnlocked || !unlockedPasscode) {
      toast.message('Editing is locked. Unlock with passcode first.')
      return false
    }

    try {
      await operation(unlockedPasscode)
      if (successMessage) toast.success(successMessage)
      if (reload && selectedEvent) {
        await loadPicklistData(selectedEvent, { silent: true, showErrorToast: false, refresh: true })
      }
      return true
    } catch (error) {
      console.error('[Picklist] Write failed:', error)
      handleWriteError(error)
      return false
    }
  }, [handleWriteError, isUnlocked, loadPicklistData, selectedEvent, unlockedPasscode])

  const getEntryLocation = useCallback((entryId, sourceLists) => {
    for (const list of sourceLists) {
      const index = list.entries.findIndex(entry => entry.id === entryId)
      if (index !== -1) return { listId: list.id, index }
    }
    return null
  }, [])

  const resolveDropTarget = useCallback((overId, sourceLists) => {
    if (overId.startsWith(LIST_PREFIX)) {
      const listId = parseDragNumber(overId, LIST_PREFIX)
      if (listId === null) return null
      const targetList = sourceLists.find(list => list.id === listId)
      if (!targetList) return null
      return { listId, index: targetList.entries.length, isListContainer: true }
    }
    if (overId.startsWith(ENTRY_PREFIX)) {
      const entryId = parseDragNumber(overId, ENTRY_PREFIX)
      if (entryId === null) return null
      const location = getEntryLocation(entryId, sourceLists)
      if (!location) return null
      return { listId: location.listId, index: location.index, isListContainer: false }
    }
    return null
  }, [getEntryLocation])

  const handleDragEnd = useCallback(async ({ active, over }) => {
    if (!over) return
    if (!isUnlocked) {
      toast.message('Unlock picklist editing to drag and drop teams.')
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)
    const lists = board.lists
    const target = resolveDropTarget(overId, lists)
    if (!target) return

    if (activeId.startsWith(MASTER_PREFIX)) {
      const teamNumber = parseDragNumber(activeId, MASTER_PREFIX)
      if (teamNumber === null) return

      const targetList = lists.find((list) => list.id === target.listId)
      if (!targetList) return

      if (targetList.entries.some((entry) => entry.teamNumber === teamNumber)) {
        toast.message(`Team ${teamNumber} is already in "${targetList.title}".`)
        return
      }

      const tempId = -(Date.now())
      const optimisticEntry = {
        id: tempId,
        listId: target.listId,
        teamNumber,
        position: target.index,
        note: '',
      }
      const insertAt = target.index
      setBoard((prev) => ({
        ...prev,
        lists: prev.lists.map((list) => {
          if (list.id !== target.listId) return list
          const updated = [...list.entries]
          updated.splice(insertAt, 0, optimisticEntry)
          return { ...list, entries: updated }
        }),
      }))

      const savedBoard = board
      const ok = await runProtectedWrite(
        async (passcode) => {
          await addPicklistEntry({
            listId: target.listId,
            teamNumber,
            targetPosition: target.index,
            note: '',
            passcode,
          })
        },
        { reload: true },
      )
      if (!ok) setBoard(savedBoard)
      return
    }

    if (activeId.startsWith(ENTRY_PREFIX)) {
      const entryId = parseDragNumber(activeId, ENTRY_PREFIX)
      if (entryId === null) return

      const source = getEntryLocation(entryId, lists)
      if (!source) return

      const sourceList = lists.find((list) => list.id === source.listId)
      const targetList = lists.find((list) => list.id === target.listId)
      if (!sourceList || !targetList) return

      if (source.listId === target.listId) {
        let targetIndex = target.index
        if (target.isListContainer) {
          targetIndex = sourceList.entries.length - 1
        }
        if (targetIndex < 0 || source.index === targetIndex) return

        setBoard((prev) => ({
          ...prev,
          lists: prev.lists.map((list) => {
            if (list.id !== source.listId) return list
            return { ...list, entries: arrayMove(list.entries, source.index, targetIndex) }
          }),
        }))

        const reorderedIds = arrayMove(
          sourceList.entries.map((entry) => entry.id),
          source.index,
          targetIndex,
        )

        const savedBoard = board
        const ok = await runProtectedWrite(
          async (passcode) => {
            await reorderPicklistEntries({
              listId: sourceList.id,
              entryIds: reorderedIds,
              passcode,
            })
          },
          { reload: false },
        )
        if (!ok) setBoard(savedBoard)
      } else {
        const movingEntry = sourceList.entries[source.index]
        if (!movingEntry) return
        if (targetList.entries.some((entry) => entry.teamNumber === movingEntry.teamNumber)) {
          toast.message(`Team ${movingEntry.teamNumber} is already in "${targetList.title}".`)
          return
        }

        setBoard((prev) => ({
          ...prev,
          lists: prev.lists.map((list) => {
            if (list.id === source.listId) {
              return { ...list, entries: list.entries.filter((e) => e.id !== movingEntry.id) }
            }
            if (list.id === target.listId) {
              const updated = [...list.entries]
              updated.splice(target.index, 0, { ...movingEntry, listId: target.listId })
              return { ...list, entries: updated }
            }
            return list
          }),
        }))

        const savedBoard = board
        const ok = await runProtectedWrite(
          async (passcode) => {
            await movePicklistEntry({
              entryId: movingEntry.id,
              targetListId: targetList.id,
              targetPosition: target.index,
              passcode,
            })
          },
          { reload: true },
        )
        if (!ok) setBoard(savedBoard)
      }
    }
  }, [board, getEntryLocation, isUnlocked, resolveDropTarget, runProtectedWrite])

  const handleSetInitialPasscode = async () => {
    if (setPasscodeValue.length < 4) {
      toast.error('Passcode must be at least 4 characters.')
      return
    }
    if (setPasscodeValue !== setPasscodeConfirm) {
      toast.error('Passcode confirmation does not match.')
      return
    }

    try {
      const ok = await setGlobalPicklistPasscode({
        currentPasscode: null,
        newPasscode: setPasscodeValue,
      })
      if (!ok) {
        toast.error('Could not set passcode.')
        return
      }
      setHasPasscode(true)
      setUnlockState(setPasscodeValue)
      setSetPasscodeValue('')
      setSetPasscodeConfirm('')
      toast.success('Global passcode has been set.')
    } catch (error) {
      handleWriteError(error)
    }
  }

  const handleUnlock = async () => {
    if (!unlockPasscodeValue) {
      toast.error('Enter passcode to unlock.')
      return
    }
    try {
      const ok = await verifyGlobalPicklistPasscode(unlockPasscodeValue)
      if (!ok) {
        toast.error('Incorrect passcode.')
        return
      }
      setUnlockState(unlockPasscodeValue)
      setUnlockPasscodeValue('')
      toast.success('Editing unlocked.')
    } catch (error) {
      handleWriteError(error)
    }
  }

  const handleChangePasscode = async () => {
    if (changeNewPasscode.length < 4) {
      toast.error('New passcode must be at least 4 characters.')
      return
    }
    if (changeNewPasscode !== changeNewPasscodeConfirm) {
      toast.error('New passcode confirmation does not match.')
      return
    }

    try {
      const ok = await setGlobalPicklistPasscode({
        currentPasscode: changeCurrentPasscode,
        newPasscode: changeNewPasscode,
      })
      if (!ok) {
        toast.error('Current passcode is incorrect.')
        return
      }
      setUnlockState(changeNewPasscode)
      setChangeCurrentPasscode('')
      setChangeNewPasscode('')
      setChangeNewPasscodeConfirm('')
      toast.success('Passcode changed.')
    } catch (error) {
      handleWriteError(error)
    }
  }

  const handleCreateList = async () => {
    const title = newListTitle.trim()
    if (!title) {
      toast.error('List title is required.')
      return
    }
    const ok = await runProtectedWrite(
      async (passcode) => {
        await createPicklistList({
          eventKey: selectedEvent,
          title,
          passcode,
        })
      },
      { reload: true, successMessage: 'List created.' },
    )
    if (ok) setNewListTitle('')
  }

  const handleListTitleBlur = async (listId) => {
    const list = board.lists.find(item => item.id === listId)
    if (!list) return
    const title = (titleDrafts[listId] ?? '').trim()
    if (!title) {
      setTitleDrafts(prev => ({ ...prev, [listId]: list.title }))
      return
    }
    if (title === list.title) return

    const ok = await runProtectedWrite(
      async (passcode) => {
        await renamePicklistList({
          listId,
          title,
          passcode,
        })
      },
      { reload: false, successMessage: 'List renamed.' },
    )

    if (ok) {
      setBoard(prev => ({
        ...prev,
        lists: prev.lists.map(item => (item.id === listId ? { ...item, title } : item)),
      }))
    } else {
      setTitleDrafts(prev => ({ ...prev, [listId]: list.title }))
    }
  }

  const handleListTitleChange = (listId, value) => {
    setTitleDrafts(prev => ({ ...prev, [listId]: value }))
  }

  const handleDeleteList = async (listId, title) => {
    const confirmed = window.confirm(`Delete "${title}" and all its rows?`)
    if (!confirmed) return

    await runProtectedWrite(
      async (passcode) => {
        await deletePicklistList({ listId, passcode })
      },
      { reload: true, successMessage: 'List deleted.' },
    )
  }

  const handleNoteChange = (entryId, value) => {
    setNoteDrafts(prev => ({ ...prev, [entryId]: value }))
  }

  const handleNoteBlur = async (entryId) => {
    const entry = board.lists.flatMap(list => list.entries).find(item => item.id === entryId)
    if (!entry) return
    const nextNote = noteDrafts[entryId] ?? entry.note
    if (nextNote === entry.note) return

    const ok = await runProtectedWrite(
      async (passcode) => {
        await updatePicklistEntryNote({
          entryId,
          note: nextNote,
          passcode,
        })
      },
      { reload: false },
    )

    if (ok) {
      setBoard(prev => ({
        ...prev,
        lists: prev.lists.map(list => ({
          ...list,
          entries: list.entries.map(item => (item.id === entryId ? { ...item, note: nextNote } : item)),
        })),
      }))
    } else {
      setNoteDrafts(prev => ({ ...prev, [entryId]: entry.note }))
    }
  }

  const handleRemoveEntry = async (entryId) => {
    await runProtectedWrite(
      async (passcode) => {
        await removePicklistEntry({ entryId, passcode })
      },
      { reload: true, successMessage: 'Entry removed.' },
    )
  }


  if (!supabaseConfigured) {
    return (
      <div className="picklist-container">
        <h2>Picklist</h2>
        <p>Supabase is not configured. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` to use Picklist.</p>
      </div>
    )
  }

  return (
    <div className="picklist-container">
      <header className="picklist-header">
        <div>
          <h2>Picklist</h2>
          <p>Build custom first/second pick tables from the master team ranking list.</p>
        </div>
        <div className="picklist-badges">
          <Badge variant="outline">Refreshes every 60 seconds</Badge>
          <Badge variant="outline">Updated {formatTimestamp(lastUpdatedAt)}</Badge>
          <Badge variant={isUnlocked ? 'secondary' : 'outline'}>
            {isUnlocked ? 'Unlocked' : 'Locked'}
          </Badge>
        </div>
      </header>

      <section className="picklist-panel">
        <div className="picklist-panel-row">
          <label className="picklist-label" htmlFor="picklist-event-select">Event</label>
          <select
            id="picklist-event-select"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="picklist-select"
          >
            {eventKeys.length === 0 ? <option value="">No events available</option> : null}
            {eventKeys.map((event) => (
              <option key={event.key} value={event.key}>{event.name}</option>
            ))}
          </select>
          <Button
            variant="outline"
            type="button"
            onClick={refreshEventKeys}
            disabled={refreshingEvents}
          >
            {refreshingEvents ? 'Refreshing...' : 'Refresh Events'}
          </Button>
        </div>

        <div className="picklist-panel-row">
          <label className="picklist-label" htmlFor="picklist-new-list-title">Create Table</label>
          <input
            id="picklist-new-list-title"
            type="text"
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            placeholder="e.g. Best Defense"
            disabled={!isUnlocked || !selectedEvent}
            className="picklist-text-input"
          />
          <Button
            type="button"
            onClick={handleCreateList}
            disabled={!isUnlocked || !selectedEvent || !newListTitle.trim()}
          >
            Add Table
          </Button>
        </div>
      </section>

      <section className="picklist-panel picklist-lock-panel">
        <h3>Admin Lock</h3>
        {!hasPasscode ? (
          <div className="picklist-lock-grid">
            <input
              type="password"
              placeholder="Set global passcode"
              value={setPasscodeValue}
              onChange={(e) => setSetPasscodeValue(e.target.value)}
              className="picklist-text-input"
            />
            <input
              type="password"
              placeholder="Confirm passcode"
              value={setPasscodeConfirm}
              onChange={(e) => setSetPasscodeConfirm(e.target.value)}
              className="picklist-text-input"
            />
            <Button
              type="button"
              onClick={handleSetInitialPasscode}
              disabled={!setPasscodeValue || setPasscodeValue !== setPasscodeConfirm}
            >
              Set Passcode
            </Button>
          </div>
        ) : !isUnlocked ? (
          <div className="picklist-lock-grid">
            <input
              type="password"
              placeholder="Enter passcode to unlock editing"
              value={unlockPasscodeValue}
              onChange={(e) => setUnlockPasscodeValue(e.target.value)}
              className="picklist-text-input"
            />
            <Button type="button" onClick={handleUnlock} disabled={!unlockPasscodeValue}>
              Unlock
            </Button>
          </div>
        ) : (
          <div className="picklist-lock-grid">
            <div className="picklist-lock-actions">
              <p>Editing is unlocked for this browser session.</p>
              <Button type="button" variant="outline" onClick={clearUnlockState}>
                Lock Now
              </Button>
            </div>
            <input
              type="password"
              placeholder="Current passcode"
              value={changeCurrentPasscode}
              onChange={(e) => setChangeCurrentPasscode(e.target.value)}
              className="picklist-text-input"
            />
            <input
              type="password"
              placeholder="New passcode"
              value={changeNewPasscode}
              onChange={(e) => setChangeNewPasscode(e.target.value)}
              className="picklist-text-input"
            />
            <input
              type="password"
              placeholder="Confirm new passcode"
              value={changeNewPasscodeConfirm}
              onChange={(e) => setChangeNewPasscodeConfirm(e.target.value)}
              className="picklist-text-input"
            />
            <Button
              type="button"
              onClick={handleChangePasscode}
              disabled={
                !changeCurrentPasscode ||
                !changeNewPasscode ||
                changeNewPasscode !== changeNewPasscodeConfirm
              }
            >
              Change Passcode
            </Button>
          </div>
        )}
      </section>

      {loadingData ? <p>Loading board...</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="picklist-board-grid">
          <section className="picklist-master-pane">
            <h3>Master List</h3>
            <div className="picklist-table-wrap">
              <table className="picklist-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Team #</th>
                    <th>Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {masterTeams.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="picklist-empty-cell">
                        No teams found for this event.
                      </td>
                    </tr>
                  ) : (
                    masterTeams.map(team => (
                      <MasterTeamRow key={team.teamNumber} team={team} disabled={!isUnlocked} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="picklist-custom-pane">
            <h3>Custom Pick Tables</h3>
            <div className="picklist-list-strip">
              {board.lists.length === 0 ? (
                <div className="picklist-empty-card">Create a table to start building your picklist.</div>
              ) : (
                board.lists.map(list => (
                  <PicklistListCard
                    key={list.id}
                    list={list}
                    disabled={!isUnlocked}
                    titleValue={titleDrafts[list.id] ?? list.title}
                    onTitleChange={handleListTitleChange}
                    onTitleBlur={handleListTitleBlur}
                    onDelete={handleDeleteList}
                    rankByTeam={rankByTeam}
                    noteDrafts={noteDrafts}
                    onNoteChange={handleNoteChange}
                    onNoteBlur={handleNoteBlur}
                    onRemove={handleRemoveEntry}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </DndContext>
    </div>
  )
}

export default Picklist
