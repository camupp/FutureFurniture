import { OPENING_LIMITS, type Opening, type Point, type Room, type Wall } from '@/domain/model'
import { wallAngle, wallLength } from '@/domain/geometry/geometry'
import { clamp } from '@/shared/lib/units'

/** Свободное место вдоль и перед оконным/дверным проёмом. */
export const OPENING_CLEARANCE = 100
/** Дополнительный запас вокруг траектории дверного полотна. */
export const DOOR_SWING_CLEARANCE = 120

/** Проём в системе координат стены: ось вдоль стены, нормаль поперёк. */
export type OpeningFrame = {
  wall: Wall
  /** Единичный вектор вдоль стены. */
  axis: Point
  /** Единичная нормаль стены. */
  normal: Point
  /** Центр проёма на осевой линии стены. */
  center: Point
  /** Края проёма на осевой линии. */
  start: Point
  end: Point
}

/** Смещение центра проёма, зажатое так, чтобы проём не вылезал за концы стены. */
export function clampOffset(opening: Opening, wall: Wall): number {
  const length = wallLength(wall)
  const half = opening.width / 2
  if (length <= opening.width) return length / 2
  return Math.min(Math.max(opening.offset, half), length - half)
}

/**
 * Приводит проём к инвариантам стены: он целиком помещается по длине и высоте,
 * а дверь всегда начинается от пола. Вызывать на всех границах записи в стор.
 */
export function normalizeOpening(opening: Opening, wall: Wall, wallHeight: number): Opening {
  const length = wallLength(wall)
  const maxWidth = Math.min(OPENING_LIMITS.width.max, length)
  const width = clamp(opening.width, OPENING_LIMITS.width.min, maxWidth)
  const maxSill = Math.min(OPENING_LIMITS.sill.max, wallHeight - OPENING_LIMITS.height.min)
  const sill = opening.type === 'door' ? 0 : clamp(opening.sill, OPENING_LIMITS.sill.min, maxSill)
  const maxHeight = Math.min(OPENING_LIMITS.height.max, wallHeight - sill)
  const height = clamp(opening.height, OPENING_LIMITS.height.min, maxHeight)
  const half = width / 2

  return {
    ...opening,
    width,
    height,
    sill,
    offset: Math.round(clamp(opening.offset, half, length - half)),
  }
}

export function openingFrame(opening: Opening, room: Room): OpeningFrame | null {
  const wall = room.walls.find((candidate) => candidate.id === opening.wallId)
  if (!wall || wallLength(wall) < 1) return null

  const angle = wallAngle(wall)
  const axis = { x: Math.cos(angle), y: Math.sin(angle) }
  const normal = { x: -axis.y, y: axis.x }
  const offset = clampOffset(opening, wall)
  const half = opening.width / 2

  const center = { x: wall.start.x + axis.x * offset, y: wall.start.y + axis.y * offset }
  return {
    wall,
    axis,
    normal,
    center,
    start: { x: center.x - axis.x * half, y: center.y - axis.y * half },
    end: { x: center.x + axis.x * half, y: center.y + axis.y * half },
  }
}

/** Габаритный прямоугольник проёма на плане: ширина вдоль стены, толщина стены плюс запас. */
export function openingFootprint(opening: Opening, room: Room): Point[] | null {
  const frame = openingFrame(opening, room)
  if (!frame) return null
  const half = opening.width / 2 + OPENING_CLEARANCE
  const across = frame.wall.thickness / 2 + OPENING_CLEARANCE

  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([alongSign, acrossSign]) => ({
    x: frame.center.x + frame.axis.x * half * alongSign + frame.normal.x * across * acrossSign,
    y: frame.center.y + frame.axis.y * half * alongSign + frame.normal.y * across * acrossSign,
  }))
}

/** Нормаль стены, направленная внутрь помещения. */
export function inwardWallNormal(wall: Wall, roomCenter: Point): Point {
  const angle = wallAngle(wall)
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) }
  const center = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }
  const toCenter = { x: roomCenter.x - center.x, y: roomCenter.y - center.y }
  const sign = normal.x * toCenter.x + normal.y * toCenter.y >= 0 ? 1 : -1
  return { x: normal.x * sign, y: normal.y * sign }
}

/** Сектор, который занимает открывающееся внутрь дверное полотно. */
export function doorSwingFootprint(opening: Opening, room: Room, roomCenter: Point): Point[] | null {
  if (opening.type !== 'door') return null
  const frame = openingFrame(opening, room)
  if (!frame) return null

  const hinge = opening.hinge === 'left' ? frame.start : frame.end
  const closed = opening.hinge === 'left' ? frame.axis : { x: -frame.axis.x, y: -frame.axis.y }
  const opened = inwardWallNormal(frame.wall, roomCenter)
  const startAngle = Math.atan2(closed.y, closed.x)
  const endAngle = Math.atan2(opened.y, opened.x)
  let delta = endAngle - startAngle
  while (delta <= -Math.PI) delta += Math.PI * 2
  while (delta > Math.PI) delta -= Math.PI * 2

  const radius = opening.width + DOOR_SWING_CLEARANCE
  const arc: Point[] = []
  const steps = 10
  for (let step = 0; step <= steps; step++) {
    const angle = startAngle + (delta * step) / steps
    arc.push({ x: hinge.x + Math.cos(angle) * radius, y: hinge.y + Math.sin(angle) * radius })
  }
  return [hinge, ...arc]
}

/** Все запретные области проёма на плане: полоса стены и, для двери, сектор открывания. */
export function openingObstaclePolygons(opening: Opening, room: Room, roomCenter: Point): Point[][] {
  const footprint = openingFootprint(opening, room)
  const swing = doorSwingFootprint(opening, room, roomCenter)
  return [footprint, swing].filter((area): area is Point[] => area !== null)
}

/** Проекция точки на осевую линию стены: расстояние от её начала. */
export function offsetAlongWall(point: Point, wall: Wall): number {
  const angle = wallAngle(wall)
  return (point.x - wall.start.x) * Math.cos(angle) + (point.y - wall.start.y) * Math.sin(angle)
}

/** Ближайшая к точке стена и смещение вдоль неё — для установки проёма кликом. */
export function nearestWall(point: Point, room: Room, maxDistance: number): { wall: Wall; offset: number } | null {
  let best: { wall: Wall; offset: number; distance: number } | null = null

  for (const wall of room.walls) {
    const length = wallLength(wall)
    if (length < 1) continue
    const raw = offsetAlongWall(point, wall)
    const offset = Math.min(Math.max(raw, 0), length)
    const angle = wallAngle(wall)
    const projection = {
      x: wall.start.x + Math.cos(angle) * offset,
      y: wall.start.y + Math.sin(angle) * offset,
    }
    const distance = Math.hypot(point.x - projection.x, point.y - projection.y)
    if (distance > maxDistance) continue
    if (!best || distance < best.distance) best = { wall, offset, distance }
  }

  return best ? { wall: best.wall, offset: best.offset } : null
}
