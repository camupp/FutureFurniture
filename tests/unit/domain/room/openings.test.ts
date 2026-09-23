import { describe, expect, it } from 'vitest'
import {
  DOOR_SWING_CLEARANCE,
  clampOffset,
  doorSwingFootprint,
  nearestWall,
  normalizeOpening,
  openingObstaclePolygons,
} from '@/domain/room/openings'
import { makeOpening, makeRoom } from '../../../fixtures'

describe('opening normalization', () => {
  const room = makeRoom()
  const top = room.walls[0]

  it('keeps an opening inside its wall', () => {
    const normalized = normalizeOpening(makeOpening('window', { offset: 50 }), top, room.wallHeight)
    expect(normalized.offset).toBe(normalized.width / 2)
    expect(clampOffset({ ...normalized, offset: 9999 }, top)).toBe(3600 - normalized.width / 2)
  })

  it('forces a door to start at the floor', () => {
    const normalized = normalizeOpening(makeOpening('door', { sill: 700 }), top, room.wallHeight)
    expect(normalized.sill).toBe(0)
  })
})

describe('opening obstacle geometry', () => {
  const room = makeRoom()

  it('adds a swing sector only for a door', () => {
    expect(openingObstaclePolygons(makeOpening('window'), room, { x: 1800, y: 1500 })).toHaveLength(1)
    expect(openingObstaclePolygons(makeOpening('door'), room, { x: 1800, y: 1500 })).toHaveLength(2)
  })

  it('uses door width plus clearance as swing radius', () => {
    const door = makeOpening('door')
    const sector = doorSwingFootprint(door, room, { x: 1800, y: 1500 })
    expect(sector).not.toBeNull()
    const [hinge, firstArcPoint] = sector!
    expect(Math.hypot(firstArcPoint.x - hinge.x, firstArcPoint.y - hinge.y)).toBeCloseTo(
      door.width + DOOR_SWING_CLEARANCE,
    )
  })

  it('finds the nearest wall and offset', () => {
    const hit = nearestWall({ x: 1250, y: 80 }, room, 100)
    expect(hit?.wall.id).toBe('top')
    expect(hit?.offset).toBeCloseTo(1250)
    expect(nearestWall({ x: 1800, y: 1500 }, room, 100)).toBeNull()
  })
})
