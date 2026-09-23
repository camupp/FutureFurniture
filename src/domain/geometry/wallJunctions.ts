import type { Point, Wall } from '@/domain/model'
import { boundaryWalls, wallLength } from './geometry'

const JOINT_TOLERANCE = 1

type End = 'start' | 'end'
export type WallEndProfile = { left: number; right: number }
export type WallJunctionProfile = { start: WallEndProfile; end: WallEndProfile }

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const samePoint = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= JOINT_TOLERANCE

function frame(wall: Wall) {
  const length = wallLength(wall)
  const axis = { x: (wall.end.x - wall.start.x) / length, y: (wall.end.y - wall.start.y) / length }
  return { length, axis, normal: { x: -axis.y, y: axis.x } }
}

function endpoint(wall: Wall, end: End): Point {
  return wall[end]
}

function otherEndAt(other: Wall, point: Point): End | null {
  if (samePoint(other.start, point)) return 'start'
  if (samePoint(other.end, point)) return 'end'
  return null
}

function pointOnWall(point: Point, wall: Wall): boolean {
  const { length, axis } = frame(wall)
  const relative = subtract(point, wall.start)
  const along = dot(relative, axis)
  return (
    along >= -JOINT_TOLERANCE && along <= length + JOINT_TOLERANCE && Math.abs(cross(relative, axis)) <= JOINT_TOLERANCE
  )
}

function miterOffset(wall: Wall, at: End, other: Wall, otherAt: End, side: 1 | -1): number {
  const a = frame(wall)
  const b = frame(other)
  const p = endpoint(wall, at)
  const otherSide = at === otherAt ? -side : side
  const originA = {
    x: p.x + (a.normal.x * wall.thickness * side) / 2,
    y: p.y + (a.normal.y * wall.thickness * side) / 2,
  }
  const originB = {
    x: p.x + (b.normal.x * other.thickness * otherSide) / 2,
    y: p.y + (b.normal.y * other.thickness * otherSide) / 2,
  }
  const denominator = cross(a.axis, b.axis)
  if (Math.abs(denominator) < 0.1) return 0
  const offset = cross(subtract(originB, originA), b.axis) / denominator
  // Very acute joints would produce long spikes or inverted wall panels.
  const limit = Math.min(a.length * 0.4, Math.max(wall.thickness, other.thickness) * 4)
  return Math.abs(offset) <= limit ? offset : 0
}

function buttOffset(wall: Wall, at: End, host: Wall): number {
  const current = frame(wall)
  const hostFrame = frame(host)
  const into = at === 'start' ? current.axis : { x: -current.axis.x, y: -current.axis.y }
  const crossing = Math.abs(dot(into, hostFrame.normal))
  if (crossing < 0.1) return 0
  const distance = host.thickness / 2 / crossing
  if (distance > current.length * 0.4) return 0
  return at === 'start' ? distance : -distance
}

/**
 * Two connected wall ends use a miter. A partition ending on another wall's
 * centreline stops at its near face; the through-wall keeps its whole body.
 * All values are local offsets along the wall axis, in millimetres.
 */
export function wallJunctionProfile(wall: Wall, walls: Wall[]): WallJunctionProfile {
  if (wallLength(wall) <= 1) {
    return { start: { left: 0, right: 0 }, end: { left: 0, right: 0 } }
  }
  const boundaryIds = new Set(boundaryWalls(walls).map((candidate) => candidate.id))
  const isBoundary = (candidate: Wall) =>
    boundaryIds.size ? boundaryIds.has(candidate.id) : candidate.kind !== 'partition'
  const endProfile = (at: End): WallEndProfile => {
    const point = endpoint(wall, at)
    const candidates = walls.filter(
      (other) => other.id !== wall.id && wallLength(other) > 1 && pointOnWall(point, other),
    )
    const through = candidates.find((other) => otherEndAt(other, point) === null)
    if (!isBoundary(wall)) {
      const host = candidates.find((other) => isBoundary(other))
      if (host) {
        const shift = buttOffset(wall, at, host)
        return { left: shift, right: shift }
      }
    }
    const connected = candidates.find(
      (other) => otherEndAt(other, point) !== null && isBoundary(other) === isBoundary(wall),
    )
    if (connected) {
      const otherAt = otherEndAt(connected, point)!
      return {
        left: miterOffset(wall, at, connected, otherAt, 1),
        right: miterOffset(wall, at, connected, otherAt, -1),
      }
    }
    if (through) {
      const shift = buttOffset(wall, at, through)
      return { left: shift, right: shift }
    }
    return { left: 0, right: 0 }
  }
  return { start: endProfile('start'), end: endProfile('end') }
}
