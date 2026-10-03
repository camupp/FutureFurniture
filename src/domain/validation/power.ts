import { POWER_REACH_DEFAULT, type FurnitureItem, type Point, type Room, type Utility } from '@/domain/model'
import { wallFootprint } from '@/domain/geometry/geometry'
import { wallNormal } from '@/domain/placement/wallAnchors'
import { utilityPoint, wallUtilityFrame } from '@/domain/room/utilities'
import { pointInPolygon, rotatePoint } from '@/shared/lib/geometry2d'

export type PowerDemand = { key: string; item: FurnitureItem }

function rearSegment(item: FurnitureItem): [Point, Point] {
  const rearY = item.position.y - item.params.depth / 2
  const halfWidth = item.params.width / 2
  return [
    rotatePoint({ x: item.position.x - halfWidth, y: rearY }, item.position, item.rotation),
    rotatePoint({ x: item.position.x + halfWidth, y: rearY }, item.position, item.rotation),
  ]
}

function closestPoint(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    : 0
  return { x: start.x + t * dx, y: start.y + t * dy }
}

function crossesWall(from: Point, to: Point, polygon: Point[]): boolean {
  if (pointInPolygon(from, polygon)) return true
  const dx = to.x - from.x
  const dy = to.y - from.y
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index]!
    const b = polygon[(index + 1) % polygon.length]!
    const ex = b.x - a.x
    const ey = b.y - a.y
    const denominator = dx * ey - dy * ex
    if (Math.abs(denominator) < 0.0001) continue
    const ax = a.x - from.x
    const ay = a.y - from.y
    const t = (ax * ey - ay * ex) / denominator
    const u = (ax * dy - ay * dx) / denominator
    // Touching the rear face at the endpoint is not crossing the wall.
    if (t > 0.0001 && t < 0.9999 && u >= 0 && u <= 1) return true
  }
  return false
}

/** Approximate distance to the rear service zone, not a verified cable or hose route. */
export function rearServiceDistance(item: FurnitureItem, utility: Utility, room: Room): number | null {
  if (utility.type !== 'power' && utility.type !== 'gas') return null
  const point = utilityPoint(utility, room)
  const [start, end] = rearSegment(item)
  const rear = closestPoint(point, start, end)
  const frame = wallUtilityFrame(utility, room)
  if (utility.mount.kind === 'wall' && !frame) return null
  if (frame) {
    if (item.wallAnchor) {
      if (item.wallAnchor.wallId !== frame.wall.id) return null
      const side = wallNormal(frame.wall, item.wallAnchor.side)
      if (side.x * frame.inward.x + side.y * frame.inward.y < 0.5) return null
    } else {
      const facing = { x: item.position.x - rear.x, y: item.position.y - rear.y }
      if (facing.x * frame.inward.x + facing.y * frame.inward.y < item.params.depth * 0.25) return null
    }
  }
  if (room.walls.some((wall) => crossesWall(point, rear, wallFootprint(wall)))) return null

  // The exact cord exit is unknown; use a low rear service point for a sketch.
  const serviceHeight = item.elevation + Math.min(item.params.height, 600)
  return Math.hypot(point.x - rear.x, point.y - rear.y, utility.height - serviceHeight)
}

export function powerReachDistance(item: FurnitureItem, socket: Utility, room: Room): number | null {
  if (socket.type !== 'power') return null
  return rearServiceDistance(item, socket, room)
}

/** Maximum-cardinality, deterministic allocation of individual socket positions. */
export function matchPowerOutlets(demands: PowerDemand[], room: Room): Map<string, Utility> {
  const slots = room.utilities
    .filter((utility) => utility.type === 'power')
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((socket) => Array.from({ length: socket.socketCount ?? 2 }, () => socket))
  const reach = room.powerReachMm ?? POWER_REACH_DEFAULT
  const candidates = demands.map(({ item }) =>
    slots
      .map((socket, slot) => ({ slot, distance: powerReachDistance(item, socket, room) }))
      .filter(
        (candidate): candidate is { slot: number; distance: number } =>
          candidate.distance !== null && candidate.distance <= reach,
      )
      .sort((a, b) => a.distance - b.distance || a.slot - b.slot)
      .map(({ slot }) => slot),
  )
  const owners = new Map<number, number>()
  const assign = (index: number, visited: Set<number>): boolean => {
    for (const slot of candidates[index]!) {
      if (visited.has(slot)) continue
      visited.add(slot)
      const owner = owners.get(slot)
      if (owner === undefined || assign(owner, visited)) {
        owners.set(slot, index)
        return true
      }
    }
    return false
  }
  const order = demands
    .map((_, index) => index)
    .sort((a, b) => candidates[a]!.length - candidates[b]!.length || demands[a]!.key.localeCompare(demands[b]!.key))
  for (const index of order) assign(index, new Set())

  const result = new Map<string, Utility>()
  for (const [slot, index] of owners) result.set(demands[index]!.key, slots[slot]!)
  return result
}
