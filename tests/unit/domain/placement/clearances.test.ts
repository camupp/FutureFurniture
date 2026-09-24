import { describe, expect, it } from 'vitest'
import { furnitureClearances, placeAtClearance } from '@/domain/placement/clearances'
import { furnitureFromWallAnchor } from '@/domain/placement/wallAnchors'
import { makeFurniture, makeOpening, makePartitionedRoom, makeRoom } from '../../../fixtures'

describe('face clearances', () => {
  it('measures from cabinet edges to wall faces and to the closest neighbour', () => {
    const item = makeFurniture('cabinet', { position: { x: 1000, y: 330 } })
    const other = makeFurniture('cabinet', { id: 'other', position: { x: 1900, y: 330 } })
    const gaps = furnitureClearances(item, makeRoom(), [item, other])
    expect(gaps.find((gap) => gap.side === 'left')).toMatchObject({ targetId: 'left', distance: 650 })
    expect(gaps.find((gap) => gap.side === 'back')).toMatchObject({ targetId: 'top', distance: 0 })
    expect(gaps.find((gap) => gap.side === 'right')).toMatchObject({ targetId: 'other', distance: 300 })
    expect(gaps.find((gap) => gap.side === 'front')).toMatchObject({ targetId: 'bottom', distance: 2340 })
  })

  it('ignores a wall cabinet above the selected base and an obstacle outside its face span', () => {
    const item = makeFurniture('cabinet', { position: { x: 1000, y: 330 } })
    const upper = makeFurniture('cabinet', { id: 'upper', position: { x: 1800, y: 330 }, elevation: 1200 })
    const elsewhere = makeFurniture('cabinet', { id: 'elsewhere', position: { x: 1800, y: 1500 } })
    expect(
      furnitureClearances(item, makeRoom(), [item, upper, elsewhere]).find((gap) => gap.side === 'right'),
    ).toMatchObject({ kind: 'wall', targetId: 'right', distance: 2250 })
  })

  it('uses local directions for a rotated cabinet and measures an interior partition', () => {
    const item = makeFurniture('cabinet', { position: { x: 1320, y: 2200 }, rotation: 90 })
    const gap = furnitureClearances(item, makePartitionedRoom(), [item]).find((value) => value.side === 'back')!
    expect(gap).toMatchObject({ targetId: 'inner-vertical' })
    expect(gap.distance).toBeCloseTo(50)
    expect(gap.start.x).toBeCloseTo(1600)
    expect(gap.end.x).toBeCloseTo(1650)
  })

  it('measures the minimum gap across the whole face against a diagonal wall', () => {
    const item = makeFurniture('cabinet', { position: { x: 0, y: 0 } })
    const room = makeRoom({
      walls: [{ id: 'diagonal', start: { x: 1000, y: -1000 }, end: { x: 2000, y: 1000 }, thickness: 100 }],
    })
    const gap = furnitureClearances(item, room, [item]).find((value) => value.side === 'right')!
    expect(gap.distance).toBeCloseTo(1060 - 50 * Math.sqrt(1.25))
    expect(gap.start.y).toBeCloseTo(-280)
    expect(gap.end.x - gap.start.x).toBeCloseTo(gap.distance)
  })
})

describe('exact clearance placement', () => {
  it('sets a precise neighbour gap while preserving the wall attachment', () => {
    const room = makeRoom()
    const item = furnitureFromWallAnchor(
      makeFurniture('cabinet', { wallAnchor: { wallId: 'top', side: 'left', offset: 1000, distance: 0 } }),
      room.walls[0]!,
    )
    const other = makeFurniture('cabinet', { id: 'other', position: { x: 1900, y: 330 } })
    const result = placeAtClearance(item, { side: 'right', kind: 'furniture', targetId: other.id }, 100, room, [
      item,
      other,
    ])
    expect(result.error).toBeUndefined()
    expect(result.item?.position.x).toBeCloseTo(1200)
    expect(result.item?.wallAnchor).toMatchObject({ wallId: 'top', offset: 1200, distance: 0 })
  })

  it('sets the rear wall gap without the magnet snapping it back to zero', () => {
    const room = makeRoom()
    const item = furnitureFromWallAnchor(
      makeFurniture('cabinet', { wallAnchor: { wallId: 'top', side: 'left', offset: 1000, distance: 0 } }),
      room.walls[0]!,
    )
    const result = placeAtClearance(item, { side: 'back', kind: 'wall', targetId: 'top' }, 50, room, [item])
    expect(result.item?.position.y).toBeCloseTo(380)
    expect(result.item?.wallAnchor?.distance).toBe(50)
  })

  it('rejects an impossible gap rather than clamping it to another value', () => {
    const item = makeFurniture('cabinet', { position: { x: 1000, y: 330 } })
    const other = makeFurniture('cabinet', { id: 'other', position: { x: 1900, y: 330 } })
    const result = placeAtClearance(item, { side: 'right', kind: 'furniture', targetId: other.id }, 1100, makeRoom(), [
      item,
      other,
    ])
    expect(result.item).toBeUndefined()
    expect(result.error).toBeTruthy()
  })

  it('does not teleport a cabinet through an interior partition even if the destination is free', () => {
    const room = makePartitionedRoom()
    const item = makeFurniture('cabinet', { position: { x: 1000, y: 2200 } })
    const result = placeAtClearance(item, { side: 'left', kind: 'wall', targetId: 'left' }, 2100, room, [item])
    expect(result.item).toBeUndefined()
    expect(result.error).toContain('перегородка')
  })

  it('rejects a move into the door swing zone', () => {
    const room = makeRoom({ openings: [makeOpening('door')] })
    const item = makeFurniture('cabinet', { position: { x: 900, y: 900 } })
    const result = placeAtClearance(item, { side: 'left', kind: 'wall', targetId: 'left' }, 1300, room, [item])
    expect(result.error).toContain('двери')
  })

  it('rejects a stale measurement whose target is no longer nearest', () => {
    const item = makeFurniture('cabinet')
    expect(
      placeAtClearance(item, { side: 'right', kind: 'furniture', targetId: 'removed' }, 100, makeRoom(), [item]).error,
    ).toContain('изменилось')
  })
})
