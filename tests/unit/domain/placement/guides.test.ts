import { expect, it } from 'vitest'
import { alignmentGuides } from '@/domain/placement/guides'
import { placeBlock } from '@/domain/placement/snapping'
import { makeFurniture, makeRoom } from '../../../fixtures'

it('aligns the fronts of free-standing cabinets with different depths and highlights the actual neighbour', () => {
  const item = makeFurniture('cabinet', {
    position: { x: 610, y: 50 },
    params: { ...makeFurniture().params, depth: 400 },
  })
  const other = makeFurniture('cabinet', { id: 'neighbour', position: { x: 0, y: 0 } })
  const placement = placeBlock(item, item.position, makeRoom({ walls: [] }), [other], { x: 0, y: 0 }, true)
  expect(placement.position).toEqual({ x: 600, y: 80 })
  const guides = alignmentGuides({ ...item, ...placement }, [other])
  expect(guides.some((guide) => guide.kind === 'contact' && guide.targetId === 'neighbour')).toBe(true)
  expect(guides.some((guide) => guide.kind === 'front' && guide.start.y === 280 && guide.end.y === 280)).toBe(true)
})

it('does not claim front alignment when a wall constrains two cabinets of different depths', () => {
  const item = makeFurniture('cabinet', {
    position: { x: 610, y: 250 },
    params: { ...makeFurniture().params, depth: 400 },
  })
  const other = makeFurniture('cabinet', { id: 'neighbour', position: { x: 1000, y: 330 } })
  const placement = placeBlock(item, { x: 1600, y: 200 }, makeRoom(), [other], { x: 1800, y: 1500 }, true)
  expect(alignmentGuides({ ...item, ...placement }, [other]).some((guide) => guide.kind === 'front')).toBe(false)
})

it('ignores another elevation and generates side guides in rotated local coordinates', () => {
  const item = makeFurniture('cabinet', { rotation: 90, position: { x: 0, y: 0 } })
  const other = makeFurniture('cabinet', { id: 'other', rotation: 90, position: { x: 800, y: 0 } })
  expect(alignmentGuides(item, [other]).some((guide) => guide.kind === 'side')).toBe(true)
  expect(alignmentGuides(item, [{ ...other, elevation: 1200 }])).toEqual([])
})

it('chooses the same nearest snap target regardless of furniture array order', () => {
  const item = makeFurniture('cabinet', { position: { x: 650, y: 50 } })
  const near = makeFurniture('cabinet', { id: 'near', position: { x: 0, y: 0 } })
  const far = makeFurniture('cabinet', { id: 'far', position: { x: 1400, y: 0 } })
  const room = makeRoom({ walls: [] })
  expect(placeBlock(item, item.position, room, [near, far], { x: 0, y: 0 }, true)).toEqual(
    placeBlock(item, item.position, room, [far, near], { x: 0, y: 0 }, true),
  )
})
