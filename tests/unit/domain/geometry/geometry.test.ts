import { describe, expect, it } from 'vitest'
import { roomPolygon, setWallLength } from '@/domain/geometry/geometry'
import { orthoSnap, pointInPolygon, snapPoint } from '@/shared/lib/geometry2d'
import { makePartitionedRoom, makeRoom } from '../../../fixtures'

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

  it('keeps the same floor polygon after two internal walls, including old untyped walls', () => {
    const room = makePartitionedRoom()
    const expected = roomPolygon(makeRoom().walls)
    expect(roomPolygon(room.walls)).toEqual(expected)
    expect(roomPolygon(room.walls.map(({ kind: _kind, ...wall }) => wall))).toEqual(expected)
    expect(roomPolygon(room.walls.slice(0, 3))).toEqual([])
  })

  it('resizes a partition without translating outer walls or unrelated partitions', () => {
    const room = makePartitionedRoom()
    const resized = setWallLength(room.walls, 'inner-vertical', 1500)
    expect(resized.slice(0, 4)).toEqual(room.walls.slice(0, 4))
    expect(resized[5]).toEqual(room.walls[5])
    expect(resized[4]?.end).toEqual({ x: 1700, y: 1500 })
  })

  it('moves all following walls when a segment length changes', () => {
    const walls = setWallLength(makeRoom().walls, 'top', 4000)
    expect(walls[0]?.end).toEqual({ x: 4000, y: 0 })
    expect(walls[1]?.start).toEqual({ x: 4000, y: 0 })
    expect(walls[3]?.end).toEqual({ x: 400, y: 0 })
  })
})
