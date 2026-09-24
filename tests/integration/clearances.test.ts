import { beforeEach, expect, it } from 'vitest'
import { useAppStore } from '@/application/project'
import { projectSnapshot } from '@/application/project/history'
import { makeFurniture, makeRoom } from '../fixtures'

beforeEach(() => {
  useAppStore.setState(
    {
      ...useAppStore.getInitialState(),
      room: makeRoom(),
      furniture: [makeFurniture('cabinet', { position: { x: 1000, y: 330 } })],
    },
    true,
  )
})

it('records an exact gap edit as one undoable transaction', () => {
  const before = projectSnapshot(useAppStore.getState())
  expect(
    useAppStore.getState().setFurnitureClearance('cabinet-1', { side: 'left', kind: 'wall', targetId: 'left' }, 800),
  ).toBeNull()
  expect(useAppStore.getState().furniture[0]!.position.x).toBe(1150)
  expect(useAppStore.getState().history.past).toHaveLength(1)
  useAppStore.getState().undo()
  expect(projectSnapshot(useAppStore.getState())).toEqual(before)
  useAppStore.getState().redo()
  expect(useAppStore.getState().furniture[0]!.position.x).toBe(1150)
})

it('leaves geometry and history untouched when the requested gap is impossible', () => {
  const before = useAppStore.getState()
  expect(before.setFurnitureClearance('cabinet-1', { side: 'left', kind: 'wall', targetId: 'left' }, 4000)).toBeTruthy()
  expect(useAppStore.getState()).toBe(before)
})
