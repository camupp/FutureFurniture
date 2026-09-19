import type { FurnitureItem, Point, Room, Wall } from '../types'
import { blocksOverlap, projectExtent } from './collision'
import { snapElevation } from './elevation'
import { distance, itemFootprint, rotatePoint, snap, snapPoint, wallAngle, wallLength } from './geometry'

/** На сколько мм от задней грани блока ловится стена. */
const WALL_GRAB = 350
/** Зазор между соседними блоками, в пределах которого они стыкуются вплотную. */
const NEIGHBOUR_GRAB = 250
/** Допуск по разнице углов, при котором блоки считаются стоящими в одну линию. */
const ALIGN_TOLERANCE_DEG = 1
/** Разница высот установки, в пределах которой блоки считаются одним рядом. */
const SAME_ROW_TOLERANCE = 50
/** Сколько раз пытаться вытолкнуть блок из пересечения, прежде чем сдаться. */
const RESOLVE_STEPS = 6
const GRID_STEP = 10

export type Placement = { position: Point; rotation: number }

/** Посадка на стену вместе с её системой координат: ось вдоль стены и нормаль внутрь. */
type WallFit = { placement: Placement; origin: Point; axis: Point; normal: Point; offset: number }

/** Приводит угол к [0, 360) и убирает хвост после округлений. */
function normalizeAngle(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) * 100) / 100
}

/**
 * Угол блока, при котором фасад смотрит вдоль вектора `dir`.
 * Фасад блока с поворотом θ направлен в (-sin θ, cos θ), отсюда θ = atan2(-x, y).
 */
function rotationFacing(dir: Point): number {
  return (Math.atan2(-dir.x, dir.y) * 180) / Math.PI
}

/** Направление ширины блока на плане. */
function widthAxis(rotationDeg: number): Point {
  const rad = (rotationDeg * Math.PI) / 180
  return { x: Math.cos(rad), y: Math.sin(rad) }
}

function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq < 1) return a
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return { x: a.x + dx * t, y: a.y + dy * t }
}

/** Нормаль стены, направленная внутрь помещения. */
function inwardNormal(wall: Wall, roomCenter: Point): Point {
  const dx = wall.end.x - wall.start.x
  const dy = wall.end.y - wall.start.y
  const length = Math.hypot(dx, dy) || 1
  const normal = { x: -dy / length, y: dx / length }
  const center = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }
  const toCenter = { x: roomCenter.x - center.x, y: roomCenter.y - center.y }
  const sign = normal.x * toCenter.x + normal.y * toCenter.y >= 0 ? 1 : -1
  return { x: normal.x * sign, y: normal.y * sign }
}

/**
 * Ставит блок задней стенкой к ближайшей стене и разворачивает по ней.
 * Возвращает null, если подходящей стены рядом нет.
 */
function snapToWall(item: FurnitureItem, position: Point, room: Room, roomCenter: Point): WallFit | null {
  let best: { wall: Wall; projection: Point; distance: number } | null = null

  for (const wall of room.walls) {
    if (wallLength(wall) < 1) continue
    const projection = closestPointOnSegment(position, wall.start, wall.end)
    const d = distance(position, projection)
    if (d > item.params.depth / 2 + WALL_GRAB) continue
    if (!best || d < best.distance) best = { wall, projection, distance: d }
  }
  if (!best) return null

  const normal = inwardNormal(best.wall, roomCenter)
  const offset = best.wall.thickness / 2 + item.params.depth / 2
  const angle = wallAngle(best.wall)
  const axis = { x: Math.cos(angle), y: Math.sin(angle) }
  const half = item.params.width / 2
  const length = wallLength(best.wall)
  const along = (best.projection.x - best.wall.start.x) * axis.x + (best.projection.y - best.wall.start.y) * axis.y
  const clamped = Math.min(Math.max(along, half), Math.max(half, length - half))

  return {
    placement: {
      position: {
        x: best.wall.start.x + axis.x * clamped + normal.x * offset,
        y: best.wall.start.y + axis.y * clamped + normal.y * offset,
      },
      rotation: rotationFacing(normal),
    },
    origin: best.wall.start,
    axis,
    normal,
    offset,
  }
}

/**
 * Возвращает блок на линию стены, сохраняя смещение вдоль неё.
 * Стыковка с соседом и выталкивание двигают блок свободно и могут оторвать его
 * от стены — после них положение поперёк стены восстанавливается.
 */
function keepOnWall(position: Point, fit: WallFit): Point {
  const along =
    (position.x - fit.origin.x) * fit.axis.x + (position.y - fit.origin.y) * fit.axis.y
  return {
    x: fit.origin.x + fit.axis.x * along + fit.normal.x * fit.offset,
    y: fit.origin.y + fit.axis.y * along + fit.normal.y * fit.offset,
  }
}

/**
 * Стыкует блок вплотную к однотипному соседу, стоящему в той же линии.
 * Работает в локальной системе соседа: x — вдоль его ширины, y — вдоль глубины.
 */
function snapToNeighbour(item: FurnitureItem, placement: Placement, others: FurnitureItem[]): Placement | null {
  for (const other of others) {
    // Стыкуются только однотипные блоки: столешница ложится поверх тумб, а не в их линию.
    if (other.type !== item.type) continue
    // И только блоки одного ряда: навесной шкаф не встаёт в линию с напольной тумбой.
    if (Math.abs(item.elevation - other.elevation) > SAME_ROW_TOLERANCE) continue
    const angleDiff = Math.abs(((placement.rotation - other.rotation) % 360) + 360) % 360
    const aligned = angleDiff < ALIGN_TOLERANCE_DEG || Math.abs(angleDiff - 180) < ALIGN_TOLERANCE_DEG
    if (!aligned) continue

    const local = rotatePoint(placement.position, other.position, -other.rotation)
    const dx = local.x - other.position.x
    const dy = local.y - other.position.y
    const contact = other.params.width / 2 + item.params.width / 2

    if (Math.abs(dy) > item.params.depth / 2) continue
    if (Math.abs(Math.abs(dx) - contact) > NEIGHBOUR_GRAB) continue

    const snappedLocal = { x: other.position.x + Math.sign(dx || 1) * contact, y: other.position.y }
    return { position: rotatePoint(snappedLocal, other.position, other.rotation), rotation: placement.rotation }
  }
  return null
}

/**
 * Выталкивает блок из пересечения вдоль его собственной ширины — так расстановка
 * работает в кухонных планировщиках: блок «съезжает» к ближайшему свободному месту
 * и встаёт вплотную к соседу, вместо того чтобы залезать на него.
 */
function resolveOverlap(item: FurnitureItem, placement: Placement, others: FurnitureItem[]): Placement {
  const axis = widthAxis(placement.rotation)
  const half = item.params.width / 2
  let position = placement.position

  for (let step = 0; step < RESOLVE_STEPS; step++) {
    const candidate: FurnitureItem = { ...item, position, rotation: placement.rotation }
    const blocker = others.find((other) => blocksOverlap(candidate, other))
    if (!blocker) break

    const blockerExtent = projectExtent(itemFootprint(blocker), axis)
    const center = position.x * axis.x + position.y * axis.y
    const before = blockerExtent.min - half
    const after = blockerExtent.max + half
    const target = Math.abs(before - center) <= Math.abs(after - center) ? before : after
    const shift = target - center
    position = { x: position.x + axis.x * shift, y: position.y + axis.y * shift }
  }

  return { position, rotation: placement.rotation }
}

/**
 * Итоговая посадка блока при перетаскивании на плане.
 * Порядок важен: стена задаёт поворот и линию, сосед подтягивает вплотную,
 * и только потом разбираются пересечения.
 */
export function placeBlock(
  item: FurnitureItem,
  position: Point,
  room: Room,
  others: FurnitureItem[],
  roomCenter: Point,
  snapEnabled: boolean,
): Placement {
  if (!snapEnabled) {
    return { position: snapPoint(position, GRID_STEP), rotation: item.rotation }
  }

  const wallFit = snapToWall(item, position, room, roomCenter)
  const base: Placement = wallFit?.placement ?? { position, rotation: item.rotation }
  const neighbour = snapToNeighbour(item, base, others)
  const aligned = neighbour ?? { position: snapPoint(base.position, GRID_STEP), rotation: base.rotation }
  const resolved = resolveOverlap(item, aligned, others)

  return {
    position: wallFit ? keepOnWall(resolved.position, wallFit) : resolved.position,
    rotation: normalizeAngle(resolved.rotation),
  }
}

export type SectionPlacement = Placement & { elevation: number }

/**
 * Посадка блока при перетаскивании в виде спереди: по горизонтали работают те же
 * привязки, что и на плане, по вертикали — притяжение к уровням соседей.
 * Глубина блока на плане не меняется — двигается только ось X и высота.
 */
export function placeBlockInSection(
  item: FurnitureItem,
  x: number,
  elevation: number,
  room: Room,
  others: FurnitureItem[],
  roomCenter: Point,
  snapEnabled: boolean,
): SectionPlacement {
  const raised = Math.max(0, elevation)
  const position = { x, y: item.position.y }

  if (!snapEnabled) {
    return {
      position: snapPoint(position, GRID_STEP),
      rotation: item.rotation,
      elevation: snap(raised, GRID_STEP),
    }
  }

  const snapped = snapElevation({ ...item, position }, raised, others)
  const placement = placeBlock({ ...item, elevation: snapped }, position, room, others, roomCenter, true)
  return { ...placement, elevation: snapped }
}
