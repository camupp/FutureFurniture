import { describe, expect, it } from 'vitest'
import { blocksOpening } from '../../../../src/modules/validation/rules'
import { placeBlock } from '../../../../src/shared/utils/snapping'
import { makeFurniture, makeOpening, makeRoom } from '../../../fixtures'

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
})
