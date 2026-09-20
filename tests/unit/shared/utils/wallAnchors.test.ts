import { describe, expect, it } from 'vitest'
import { makeFurniture, makeRoom } from '../../../fixtures'
import {
  displayToWallOffset,
  furnitureFromWallAnchor,
  inferWallAnchor,
  wallAnchorIsValid,
  wallAnchorOffsetLimits,
  wallOffsetToDisplay,
} from '../../../../src/shared/utils/wallAnchors'

describe('wall furniture coordinates', () => {
  it.each([
    ['top', { x: 1000, y: 330 }, 0],
    ['right', { x: 3270, y: 1000 }, 90],
    ['bottom', { x: 2600, y: 2670 }, 180],
    ['left', { x: 330, y: 2000 }, 270],
  ])('places furniture on the interior face of the %s wall', (wallId, position, rotation) => {
    const room = makeRoom()
    const wall = room.walls.find((candidate) => candidate.id === wallId)!
    const item = makeFurniture('cabinet', {
      wallAnchor: { wallId, side: 'left', offset: 1000, distance: 0 },
    })

    const placed = furnitureFromWallAnchor(item, wall)
    expect(placed.position.x).toBeCloseTo(position.x)
    expect(placed.position.y).toBeCloseTo(position.y)
    expect(placed.rotation).toBe(rotation)
  })

  it('reverses the facade scale when the room is on the right side of a wall', () => {
    const room = makeRoom()
    const wall = room.walls[0]!
    expect(wallOffsetToDisplay(400, wall, 'right')).toBe(3200)
    expect(displayToWallOffset(3200, wall, 'right')).toBe(400)
  })

  it('keeps a wide cabinet clear of both wall joints', () => {
    const room = makeRoom()
    const wall = room.walls[0]!
    const item = makeFurniture('cabinet', {
      params: { ...makeFurniture().params, width: 1200 },
      wallAnchor: { wallId: wall.id, side: 'left', offset: 600, distance: 0 },
    })

    expect(wallAnchorOffsetLimits(item, wall, room.walls)).toEqual({ min: 650, max: 2950, fits: true })
    expect(wallAnchorIsValid(item, room)).toBe(false)
    expect(wallAnchorIsValid({ ...item, wallAnchor: { ...item.wallAnchor!, offset: 650 } }, room)).toBe(true)
  })

  it('uses the actual thickness of each adjoining wall', () => {
    const room = makeRoom()
    room.walls[1] = { ...room.walls[1]!, thickness: 80 }
    room.walls[3] = { ...room.walls[3]!, thickness: 200 }
    const wall = room.walls[0]!
    const item = makeFurniture('cabinet', { params: { ...makeFurniture().params, width: 1200 } })

    expect(wallAnchorOffsetLimits(item, wall, room.walls, 'left')).toEqual({
      min: 700,
      max: 2960,
      fits: true,
    })
  })

  it('does not reserve an interior corner on the opposite side of a wall', () => {
    const room = makeRoom()
    const wall = room.walls[0]!
    const item = makeFurniture('cabinet', { params: { ...makeFurniture().params, width: 1200 } })

    expect(wallAnchorOffsetLimits(item, wall, room.walls, 'right')).toEqual({
      min: 600,
      max: 3000,
      fits: true,
    })
  })

  it('accounts for an oblique wall throughout the furniture depth', () => {
    const wall = { id: 'host', start: { x: 0, y: 0 }, end: { x: 2000, y: 0 }, thickness: 100 }
    const diagonal = {
      id: 'diagonal',
      start: { x: 0, y: 0 },
      end: { x: 1000, y: 1000 },
      thickness: 100,
    }
    const item = makeFurniture('cabinet')
    const limits = wallAnchorOffsetLimits(item, wall, [wall, diagonal], 'left')

    expect(limits.min).toBeCloseTo(980.71, 1)
    expect(limits.max).toBe(1700)
    expect(limits.fits).toBe(true)
  })

  it('reports an oversized attached block without choosing an unstable edge', () => {
    const wall = { id: 'short', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 100 }
    const item = makeFurniture('cabinet', { params: { ...makeFurniture().params, width: 1200 } })

    expect(wallAnchorOffsetLimits(item, wall, [wall], 'left')).toEqual({ min: 500, max: 500, fits: false })
  })

  it('migrates an exactly wall-aligned legacy item but leaves a free item alone', () => {
    const room = makeRoom()
    const roomCenter = { x: 1800, y: 1500 }
    const aligned = makeFurniture('cabinet', { position: { x: 1000, y: 330 }, rotation: 0 })
    const free = makeFurniture('cabinet', { position: { x: 1000, y: 900 }, rotation: 17 })
    const outside = makeFurniture('cabinet', { position: { x: 1000, y: -330 }, rotation: 0 })

    expect(inferWallAnchor(aligned, room, roomCenter)).toEqual({
      wallId: 'top',
      side: 'left',
      offset: 1000,
      distance: 0,
    })
    expect(inferWallAnchor(free, room, roomCenter)).toBeUndefined()
    expect(inferWallAnchor(outside, room, roomCenter)).toBeUndefined()
  })
})
