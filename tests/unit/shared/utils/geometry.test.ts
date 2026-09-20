import { describe, expect, it } from 'vitest'
import { orthoSnap, pointInPolygon, roomPolygon, setWallLength, snapPoint } from '../../../../src/shared/utils/geometry'
import { makeRoom } from '../../../fixtures'

describe('plan geometry', () => {
  it('snaps points and orthogonal drawing independently', () => {
    expect(snapPoint({ x: 123, y: 456 }, 10)).toEqual({ x: 120, y: 460 })
    expect(orthoSnap({ x: 0, y: 0 }, { x: 900, y: 300 })).toEqual({ x: 900, y: 0 })
    expect(orthoSnap({ x: 0, y: 0 }, { x: 200, y: 700 })).toEqual({ x: 0, y: 700 })
  })

  it('builds a closed room polygon without duplicating its first point', () => {
    const polygon = roomPolygon(makeRoom().walls)
    expect(polygon).toHaveLength(4)
    expect(pointInPolygon({ x: 1800, y: 1500 }, polygon)).toBe(true)
    expect(pointInPolygon({ x: -1, y: 1500 }, polygon)).toBe(false)
  })

  it('moves all following walls when a segment length changes', () => {
    const walls = setWallLength(makeRoom().walls, 'top', 4000)
    expect(walls[0]?.end).toEqual({ x: 4000, y: 0 })
    expect(walls[1]?.start).toEqual({ x: 4000, y: 0 })
    expect(walls[3]?.end).toEqual({ x: 400, y: 0 })
  })
})
