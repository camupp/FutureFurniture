import { describe, expect, it } from 'vitest'
import { blocksOpening, blocksWall } from '@/domain/validation/rules'
import { placeBlock, placeBlockInSection, placeBlockOnWall } from '@/domain/placement/snapping'
import { makeFurniture, makeOpening, makePartitionedRoom, makeRoom } from '../../../fixtures'

const roomCenter = { x: 1800, y: 1500 }

describe('placeBlock', () => {
  it('uses only the 10 mm grid when smart placement is disabled', () => {
    const cabinet = makeFurniture('cabinet', { rotation: 17 })
    const result = placeBlock(cabinet, { x: 123, y: 456 }, makeRoom(), [], roomCenter, false)
    expect(result).toEqual({ position: { x: 120, y: 460 }, rotation: 17 })
  })

  it('snaps a cabinet back-first to the nearest wall', () => {
    const cabinet = makeFurniture('cabinet')
    const result = placeBlock(cabinet, { x: 1000, y: 200 }, makeRoom(), [], roomCenter, true)
    expect(result.position).toEqual({ x: 1000, y: 330 })
    expect(result.rotation).toBe(0)
    expect(result.wallAnchor).toEqual({ wallId: 'top', side: 'left', offset: 1000, distance: 0 })
  })

  it('stops a wide cabinet at the inner face of a corner wall', () => {
    const cabinet = makeFurniture('cabinet', { params: { ...makeFurniture().params, width: 1200 } })
    const result = placeBlock(cabinet, { x: 300, y: 200 }, makeRoom(), [], roomCenter, true)

    expect(result.position).toEqual({ x: 650, y: 330 })
    expect(result.wallAnchor).toEqual({ wallId: 'top', side: 'left', offset: 650, distance: 0 })
  })

  it('uses wall-local coordinates in an elevation of a side wall', () => {
    const cabinet = makeFurniture('cabinet', {
      wallAnchor: { wallId: 'right', side: 'left', offset: 1000, distance: 0 },
    })
    const result = placeBlockInSection(cabinet, 'right', 1500, 0, makeRoom(), [], roomCenter, true)
    expect(result.position).toEqual({ x: 3270, y: 1500 })
    expect(result.rotation).toBe(90)
    expect(result.wallAnchor).toEqual({ wallId: 'right', side: 'left', offset: 1500, distance: 0 })
  })

  it('does not unexpectedly switch the attached wall near a corner', () => {
    const cabinet = makeFurniture('cabinet', {
      position: { x: 3300, y: 330 },
      wallAnchor: { wallId: 'top', side: 'left', offset: 3300, distance: 0 },
    })

    const nearCorner = placeBlock(cabinet, { x: 3500, y: 200 }, makeRoom(), [], roomCenter, true)
    expect(nearCorner.wallAnchor?.wallId).toBe('top')
    expect(nearCorner.wallAnchor?.offset).toBe(3250)

    const clearlyOnRight = placeBlock(cabinet, { x: 3550, y: 300 }, makeRoom(), [], roomCenter, true)
    expect(clearlyOnRight.wallAnchor?.wallId).toBe('right')
  })

  it('allows a floor cabinet below a window sill', () => {
    const cabinet = makeFurniture('cabinet')
    const room = makeRoom({ openings: [makeOpening('window')] })
    const result = placeBlock(cabinet, { x: 1800, y: 200 }, room, [], roomCenter, true)
    const placed = { ...cabinet, ...result }
    expect(result.position.x).toBe(1800)
    expect(blocksOpening(placed, room)).toBe(false)
  })

  it('repels a tall cabinet from a window protection zone', () => {
    const tall = makeFurniture('cabinet', { params: { ...makeFurniture().params, height: 2100 } })
    const room = makeRoom({ openings: [makeOpening('window')] })
    const result = placeBlock(tall, { x: 1800, y: 200 }, room, [], roomCenter, true)
    const placed = { ...tall, ...result }
    expect(result.position.x).not.toBe(1800)
    expect(blocksOpening(placed, room)).toBe(false)
  })

  it('repels floor furniture from the door swing sector', () => {
    const cabinet = makeFurniture('cabinet')
    const room = makeRoom({ openings: [makeOpening('door')] })
    const result = placeBlock(cabinet, { x: 1800, y: 500 }, room, [], roomCenter, true)
    const placed = { ...cabinet, ...result }
    expect(blocksOpening(placed, room)).toBe(false)
  })

  it('leaves a manual door conflict for validation to report', () => {
    const cabinet = makeFurniture('cabinet')
    const room = makeRoom({ openings: [makeOpening('door')] })
    const result = placeBlock(cabinet, { x: 1800, y: 500 }, room, [], roomCenter, false)
    expect(blocksOpening({ ...cabinet, ...result }, room)).toBe(true)
  })

  it('pushes a cabinet out of an occupied place in its row', () => {
    const existing = makeFurniture('cabinet', { id: 'existing', position: { x: 1500, y: 330 } })
    const moving = makeFurniture('cabinet', { id: 'moving' })
    const result = placeBlock(moving, { x: 1500, y: 200 }, makeRoom(), [existing], roomCenter, true)
    expect(Math.abs(result.position.x - existing.position.x)).toBe(600)
    expect(result.position.y).toBe(330)
  })

  it('keeps a cabinet on an inner wall clear of the exterior wall at its start', () => {
    const room = makePartitionedRoom()
    const cabinet = makeFurniture('cabinet', {
      params: { ...makeFurniture().params, width: 1200 },
      position: { x: 2030, y: 2750 },
      wallAnchor: { wallId: 'inner-vertical', side: 'left', offset: 250, distance: 0 },
    })
    const result = placeBlockOnWall(cabinet, 'inner-vertical', 250, room, [], roomCenter, true)

    expect(result.wallAnchor?.offset).toBeGreaterThanOrEqual(650)
    expect(blocksWall({ ...cabinet, ...result }, room)).toBe(false)
  })

  it('moves a cabinet on the exterior wall away from a T-junction', () => {
    const room = makePartitionedRoom()
    const cabinet = makeFurniture('cabinet', {
      params: { ...makeFurniture().params, width: 1200 },
      position: { x: 1700, y: 2670 },
      wallAnchor: { wallId: 'bottom', side: 'left', offset: 1900, distance: 0 },
    })
    const result = placeBlockOnWall(cabinet, 'bottom', 1900, room, [], roomCenter, true)

    expect(Math.abs((result.wallAnchor?.offset ?? 0) - 1900)).toBeGreaterThan(600)
    expect(blocksWall({ ...cabinet, ...result }, room)).toBe(false)
  })

  it('selects the side of a partition from the cursor position', () => {
    const room = makePartitionedRoom()
    const cabinet = makeFurniture('cabinet')
    const left = placeBlock(cabinet, { x: 1450, y: 2200 }, room, [], roomCenter, true)
    const right = placeBlock(cabinet, { x: 1950, y: 2200 }, room, [], roomCenter, true)

    expect(left.wallAnchor).toMatchObject({ wallId: 'inner-vertical', side: 'right' })
    expect(right.wallAnchor).toMatchObject({ wallId: 'inner-vertical', side: 'left' })
  })
})
