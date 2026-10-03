import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/application/project'
import { normalizeProjectDocument, partializeProject } from '@/application/project/persistence'
import { makeFurniture, makeRoom } from '../fixtures'

const state = useAppStore.getState

beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom({ walls: [] }), furniture: [] }, true)
})

function twoCabinets() {
  const first = makeFurniture('cabinet', { id: 'first', position: { x: 1000, y: 1000 } })
  const second = makeFurniture('cabinet', { id: 'second', position: { x: 1600, y: 1000 } })
  useAppStore.setState({ furniture: [first, second] })
}

describe('multi-selection and grouping', () => {
  it('supports additive selection, grouping, rigid movement and undo/redo', () => {
    twoCabinets()
    state().selectFurniture('first')
    state().selectFurniture('second', true)
    expect(state().selectedFurnitureIds).toEqual(['first', 'second'])
    expect(state().groupSelectedFurniture()).toBe(true)
    const groupId = state().furniture[0]?.groupId
    expect(groupId).toBeTruthy()
    expect(state().furniture[1]?.groupId).toBe(groupId)

    expect(state().moveSelectedFurniture('first', { x: 1200, y: 1100 })).toBe(true)
    expect(state().furniture.map((item) => item.position)).toEqual([
      { x: 1200, y: 1100 },
      { x: 1800, y: 1100 },
    ])
    state().undo()
    expect(state().furniture[0]?.position).toEqual({ x: 1000, y: 1000 })
    state().redo()
    expect(state().furniture[1]?.position).toEqual({ x: 1800, y: 1100 })

    state().selectFurniture('second')
    expect(state().selectedFurnitureIds).toEqual(['first', 'second'])
    state().ungroupSelectedFurniture()
    expect(state().furniture.every((item) => !item.groupId)).toBe(true)
  })

  it('rejects a group move that would collide with another cabinet', () => {
    twoCabinets()
    useAppStore.setState({
      furniture: [...state().furniture, makeFurniture('cabinet', { id: 'third', position: { x: 2800, y: 1000 } })],
    })
    state().selectFurnitureInMarquee(['first', 'second'])
    state().groupSelectedFurniture()
    expect(state().moveSelectedFurniture('first', { x: 2200, y: 1000 })).toBe(false)
    expect(state().furniture.find((item) => item.id === 'first')?.position).toEqual({ x: 1000, y: 1000 })
  })

  it('moves a sink with its grouped cabinet row', () => {
    twoCabinets()
    useAppStore.setState({
      furniture: [...state().furniture, makeFurniture('sink', { id: 'sink', position: { x: 1000, y: 1000 } })],
    })
    state().selectFurnitureInMarquee(['first', 'second'])
    expect(state().groupSelectedFurniture()).toBe(true)
    expect(state().selectedFurnitureIds).toContain('sink')
    expect(state().moveSelectedFurniture('second', { x: 1800, y: 1000 })).toBe(true)
    expect(state().furniture.find((item) => item.id === 'sink')?.position).toEqual({ x: 1200, y: 1000 })
  })

  it('rebuilds automatic countertops after a grouped row is moved', () => {
    twoCabinets()
    state().addCountertopForRow('first')
    const before = state().furniture.find((item) => item.autoCountertop)!
    state().selectFurnitureInMarquee(['first', 'second'])
    state().groupSelectedFurniture()
    expect(state().moveSelectedFurniture('first', { x: 1200, y: 1000 })).toBe(true)
    const after = state().furniture.find((item) => item.autoCountertop)!
    expect(after.position.x).toBe(before.position.x + 200)
    expect(after.autoCountertop?.supportIds).toEqual(before.autoCountertop?.supportIds)
  })

  it('persists group membership and restores selection after deletion and undo', () => {
    twoCabinets()
    state().selectFurnitureInMarquee(['first', 'second'])
    state().groupSelectedFurniture()
    const saved = partializeProject(state())
    const loaded = normalizeProjectDocument(saved, state(), () => 'generated')
    expect(loaded?.furniture.map((item) => item.groupId)).toEqual([
      state().furniture[0]?.groupId,
      state().furniture[1]?.groupId,
    ])
    state().removeFurniture('second')
    expect(state().furniture[0]?.groupId).toBeUndefined()
    state().undo()
    expect(state().furniture[0]?.groupId).toBe(state().furniture[1]?.groupId)
  })
})
