import { beforeEach, describe, expect, it } from 'vitest'
import { canRedo, canUndo, useAppStore } from '@/application/project'
import { HISTORY_LIMIT, projectSnapshot } from '@/application/project/history'
import { makeFurniture, makeOpening, makeRoom, makeUtility } from '../fixtures'

const state = useAppStore.getState

beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom(), furniture: [] }, true)
})

describe('project history', () => {
  it('undoes and redoes wall deletion together with its openings, utilities and furniture attachment', () => {
    const furniture = makeFurniture('cabinet', {
      wallAnchor: { wallId: 'top', side: 'left', offset: 1800, distance: 0 },
    })
    const room = makeRoom({
      openings: [makeOpening('window')],
      utilities: [makeUtility('water', { mount: { kind: 'wall', wallId: 'top', offset: 1800 }, height: 500 })],
    })
    useAppStore.setState({ room, furniture: [furniture], elevationWallId: 'top' })
    const before = projectSnapshot(state())
    state().removeWall('top')
    const removed = projectSnapshot(state())
    expect(removed.room.openings).toHaveLength(0)
    expect(removed.room.utilities).toHaveLength(0)
    expect(removed.furniture[0]?.wallAnchor).toBeUndefined()

    state().undo()
    expect(projectSnapshot(state())).toEqual(before)
    state().redo()
    expect(projectSnapshot(state())).toEqual(removed)
    expect(state().room.walls.some((wall) => wall.id === state().elevationWallId)).toBe(true)
  })

  it('restores synchronized countertop geometry and IDs atomically', () => {
    useAppStore.setState({ room: makeRoom({ walls: [] }), furniture: [makeFurniture()] })
    state().addCountertopForRow('cabinet-1')
    const before = projectSnapshot(state())
    state().updateFurnitureParams('cabinet-1', { width: 900 })
    const after = projectSnapshot(state())
    expect(after.furniture.find((item) => item.autoCountertop)?.params.width).toBe(900)
    const notifications: unknown[] = []
    const unsubscribe = useAppStore.subscribe((next) => notifications.push(projectSnapshot(next)))
    try {
      state().undo()
      expect(notifications).toEqual([before])
      state().redo()
      expect(notifications).toEqual([before, after])
    } finally {
      unsubscribe()
    }
  })

  it('keeps one placement per step and removes stale selection after undoing creation', () => {
    state().addBlock({ type: 'cabinet', elevation: 0, params: makeFurniture().params })
    const added = projectSnapshot(state())
    const id = state().furniture[0]!.id
    state().dropFurniture(id, { x: 1100, y: 200 })
    const placed = projectSnapshot(state())
    expect(state().history.past).toHaveLength(2)
    state().undo()
    expect(projectSnapshot(state())).toEqual(added)
    state().undo()
    expect(state().furniture).toHaveLength(0)
    expect(state().selection).toBeNull()
    state().redo()
    state().redo()
    expect(projectSnapshot(state())).toEqual(placed)
  })

  it('groups a complete slider gesture and can undo while the gesture is still active', () => {
    useAppStore.setState({ furniture: [makeFurniture()] })
    state().beginHistoryGroup()
    state().updateFurnitureParams('cabinet-1', { width: 700 })
    state().updateFurnitureParams('cabinet-1', { width: 800 })
    state().updateFurnitureParams('cabinet-1', { width: 900 })
    expect(canUndo(state())).toBe(true)
    state().undo()
    expect(state().furniture[0]?.params.width).toBe(600)
    expect(canUndo(state())).toBe(false)
    state().redo()
    expect(state().furniture[0]?.params.width).toBe(900)
    expect(state().history.group).toBeNull()
  })

  it('does not record editor preferences, no-op edits or gestures returning to their starting value', () => {
    state().setWallHeight(2800)
    state().undo()
    const future = state().history.future
    state().select({ kind: 'wall', id: 'top' })
    state().setEditorView('elevation')
    state().setViewMode('3d')
    state().setTool('wall')
    state().setWallHeight(2700)
    state().beginHistoryGroup()
    state().setWallHeight(2900)
    state().setWallHeight(2700)
    state().endHistoryGroup()
    expect(canUndo(state())).toBe(false)
    expect(state().history.future).toBe(future)
    state().redo()
    expect(state().room.wallHeight).toBe(2800)
    expect(state()).toMatchObject({ viewMode: '3d', editorView: 'elevation', tool: 'wall' })
  })

  it('discards the redo branch after a new edit', () => {
    state().setWallHeight(2800)
    state().undo()
    state().addOpening('top', 1800, 'window')
    expect(canRedo(state())).toBe(false)
    state().redo()
    expect(state().room.wallHeight).toBe(2700)
    expect(state().room.openings).toHaveLength(1)
  })

  it('undoes clearing the entire sketch', () => {
    const room = makeRoom({ openings: [makeOpening('door')], utilities: [makeUtility('sewer')] })
    useAppStore.setState({ room, furniture: [makeFurniture()] })
    const before = projectSnapshot(state())
    state().clearRoom()
    expect(state().room.walls).toHaveLength(0)
    state().undo()
    expect(projectSnapshot(state())).toEqual(before)
  })

  it('bounds memory by keeping at most 100 undo steps', () => {
    for (let index = 1; index <= HISTORY_LIMIT + 5; index++) state().setWallHeight(2700 + index)
    expect(state().history.past).toHaveLength(HISTORY_LIMIT)
    for (let index = 0; index < HISTORY_LIMIT + 5; index++) state().undo()
    expect(state().room.wallHeight).toBe(2705)
    expect(canUndo(state())).toBe(false)
  })
})
