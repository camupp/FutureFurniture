import { beforeEach, expect, it } from 'vitest'
import { useAppStore } from '@/application/project'
import { mergePersistedProject, partializeProject } from '@/application/project/persistence'
import { makeFurniture, makeRoom } from '../fixtures'

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom({ walls: [] }), furniture: [] }, true)
})

it('notifies subscribers once with synchronized supports and countertop', () => {
  const base = makeFurniture('cabinet')
  useAppStore.setState({ furniture: [base] })
  useAppStore.getState().addCountertopForRow(base.id)
  const snapshots: Array<[number, number]> = []
  const unsubscribe = useAppStore.subscribe((state) => {
    const support = state.furniture.find((item) => item.id === base.id)!
    const top = state.furniture.find((item) => item.autoCountertop)!
    snapshots.push([support.params.width, top.params.width])
  })
  try {
    useAppStore.getState().updateFurnitureParams(base.id, { width: 900 })
    expect(snapshots).toEqual([[900, 900]])
    const saved = partializeProject(useAppStore.getState())
    expect(saved.furniture.find((item) => item.autoCountertop)?.params.width).toBe(900)
  } finally {
    unsubscribe()
  }
})

it('does not persist actions, transient selection or active tools', () => {
  const saved = partializeProject(useAppStore.getState())
  expect(Object.keys(saved).sort()).toEqual(['elevationWallId', 'furniture', 'room', 'viewMode'])
})

it('does not recreate derived geometry for editor-only changes', () => {
  const base = makeFurniture('cabinet')
  useAppStore.setState({ furniture: [base] })
  useAppStore.getState().addCountertopForRow(base.id)
  const furniture = useAppStore.getState().furniture
  useAppStore.getState().setViewMode('2d')
  useAppStore.getState().setTool('wall')
  expect(useAppStore.getState().furniture).toBe(furniture)
})

it('retains the current project when persisted data is malformed', () => {
  const room = useAppStore.getState().room
  const merged = mergePersistedProject({ room: { walls: 'invalid' } }, useAppStore.getState(), () =>
    crypto.randomUUID(),
  )
  useAppStore.setState(merged)
  expect(useAppStore.getState().room).toBe(room)
  expect(typeof useAppStore.getState().addWall).toBe('function')
})
