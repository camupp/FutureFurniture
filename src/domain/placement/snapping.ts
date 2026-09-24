import type { FurnitureItem, Opening, Point, Room, Wall, WallAnchor, WallSide } from '@/domain/model'
import { blocksOverlap, footprintsOverlap, projectExtent } from '@/domain/geometry/collision'
import { snapElevation } from '@/domain/placement/elevation'
import { boundaryWalls, itemFootprint, wallLength } from '@/domain/geometry/geometry'
import { distance, rotatePoint, snap, snapPoint } from '@/shared/lib/geometry2d'
import { openingObstaclePolygons } from '@/domain/room/openings'
import {
  anchorAtPosition,
  displayToWallOffset,
  positionFromWallAnchor,
  rotationFacingWall,
  wallAnchorOffsetLimits,
  wallFrame,
  wallInteriorSide,
} from '@/domain/placement/wallAnchors'

/** На сколько мм от задней грани блока ловится стена. */
const WALL_GRAB = 350
/** Текущая стена сохраняет приоритет у угла, пока другая не станет заметно ближе. */
const REHOST_HYSTERESIS = 120
/** Зазор между соседними блоками, в пределах которого они стыкуются вплотную. */
const NEIGHBOUR_GRAB = 250
/** Допуск по разнице углов, при котором блоки считаются стоящими в одну линию. */
const ALIGN_TOLERANCE_DEG = 1
/** Разница высот установки, в пределах которой блоки считаются одним рядом. */
const SAME_ROW_TOLERANCE = 50
/** Сколько раз пытаться вытолкнуть блок из пересечения, прежде чем сдаться. */
const RESOLVE_STEPS = 8
const GRID_STEP = 10

export type Placement = { position: Point; rotation: number; wallAnchor?: WallAnchor }

/** Посадка на стену вместе с её системой координат: ось вдоль стены и нормаль внутрь. */
type WallFit = {
  placement: Placement
  wall: Wall
  side: WallSide
  origin: Point
  axis: Point
  normal: Point
  across: number
  distance: number
  minAlong: number
  maxAlong: number
}

/** Приводит угол к [0, 360) и убирает хвост после округлений. */
function normalizeAngle(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) * 100) / 100
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

function attachmentSide(wall: Wall, position: Point, walls: Wall[], roomCenter: Point, preferred?: WallSide): WallSide {
  if (boundaryWalls(walls).some((candidate) => candidate.id === wall.id)) return wallInteriorSide(wall, roomCenter)
  const frame = wallFrame(wall)
  const signed = (position.x - wall.start.x) * frame.leftNormal.x + (position.y - wall.start.y) * frame.leftNormal.y
  if (Math.abs(signed) < 1) return preferred ?? wallInteriorSide(wall, roomCenter)
  return signed > 0 ? 'left' : 'right'
}

function fitToWall(
  item: FurnitureItem,
  wall: Wall,
  side: WallSide,
  desiredOffset: number,
  walls: Wall[],
  distanceFromWall = 0,
): WallFit {
  const frame = wallFrame(wall)
  const normal = side === 'left' ? frame.leftNormal : { x: -frame.leftNormal.x, y: -frame.leftNormal.y }
  const { min: minAlong, max: maxAlong } = wallAnchorOffsetLimits(
    item,
    wall,
    walls,
    side,
    distanceFromWall,
    desiredOffset,
  )
  const offset = Math.min(Math.max(desiredOffset, minAlong), maxAlong)
  const anchor: WallAnchor = { wallId: wall.id, side, offset, distance: distanceFromWall }

  return {
    placement: {
      position: positionFromWallAnchor({ ...item, wallAnchor: anchor }, wall, anchor),
      rotation: rotationFacingWall(wall, side),
      wallAnchor: anchor,
    },
    wall,
    side,
    origin: wall.start,
    axis: frame.axis,
    normal,
    across: wall.thickness / 2 + item.params.depth / 2 + distanceFromWall,
    distance: distanceFromWall,
    minAlong,
    maxAlong,
  }
}

/**
 * Ставит блок задней стенкой к ближайшей стене и разворачивает по ней.
 * Возвращает null, если подходящей стены рядом нет.
 */
function snapToWall(item: FurnitureItem, position: Point, room: Room, roomCenter: Point): WallFit | null {
  let best: { wall: Wall; projection: Point; distance: number } | null = null
  let current: { wall: Wall; projection: Point; distance: number } | null = null

  for (const wall of room.walls) {
    if (wallLength(wall) < 1) continue
    const projection = closestPointOnSegment(position, wall.start, wall.end)
    const d = distance(position, projection)
    if (d > item.params.depth / 2 + WALL_GRAB) continue
    if (wall.id === item.wallAnchor?.wallId) current = { wall, projection, distance: d }
    if (!best || d < best.distance) best = { wall, projection, distance: d }
  }
  if (!best) return null

  if (current && current.distance <= best.distance + REHOST_HYSTERESIS) best = current

  const side = attachmentSide(best.wall, position, room.walls, roomCenter, item.wallAnchor?.side)
  const frame = wallFrame(best.wall)
  const along =
    (best.projection.x - best.wall.start.x) * frame.axis.x + (best.projection.y - best.wall.start.y) * frame.axis.y
  return fitToWall(item, best.wall, side, along, room.walls)
}

/**
 * Возвращает блок на линию стены, сохраняя смещение вдоль неё.
 * Стыковка с соседом и выталкивание двигают блок свободно и могут оторвать его
 * от стены — после них положение поперёк стены восстанавливается.
 */
function keepOnWall(position: Point, fit: WallFit): Point {
  const rawAlong = (position.x - fit.origin.x) * fit.axis.x + (position.y - fit.origin.y) * fit.axis.y
  const along = Math.min(Math.max(rawAlong, fit.minAlong), fit.maxAlong)
  return {
    x: fit.origin.x + fit.axis.x * along + fit.normal.x * fit.across,
    y: fit.origin.y + fit.axis.y * along + fit.normal.y * fit.across,
  }
}

function finishWallPlacement(
  item: FurnitureItem,
  fit: WallFit,
  room: Room,
  others: FurnitureItem[],
  roomCenter: Point,
): Placement {
  const neighbour = snapToNeighbour(item, fit.placement, others)
  const aligned = neighbour ?? fit.placement
  let resolved = aligned
  // Вытеснение из проёма может привести к соседу и наоборот, поэтому даём
  // двум системам ограничений несколько коротких проходов для стабилизации.
  for (let pass = 0; pass < 3; pass++) {
    resolved = resolveOverlap(item, resolved, others)
    resolved = resolveOpeningOverlap(item, resolved, room, roomCenter)
  }

  const position = keepOnWall(resolved.position, fit)
  return {
    position,
    rotation: normalizeAngle(fit.placement.rotation),
    wallAnchor: anchorAtPosition(fit.wall, fit.side, position, fit.distance),
  }
}

function overlapsOpeningHeight(item: FurnitureItem, opening: Opening): boolean {
  const itemTop = item.elevation + item.params.height
  const openingTop = opening.sill + opening.height
  return item.elevation < openingTop && opening.sill < itemTop
}

/**
 * Выталкивает мебель из полосы окна/двери и сектора открывания двери.
 * Сдвиг идёт вдоль ширины блока, поэтому пристенная мебель остаётся в своём ряду.
 */
function resolveOpeningOverlap(item: FurnitureItem, placement: Placement, room: Room, roomCenter: Point): Placement {
  const axis = widthAxis(placement.rotation)
  const half = item.params.width / 2
  let position = placement.position

  const obstacles = room.openings.flatMap((opening) =>
    overlapsOpeningHeight(item, opening) ? openingObstaclePolygons(opening, room, roomCenter) : [],
  )

  for (let step = 0; step < RESOLVE_STEPS; step++) {
    const candidate: FurnitureItem = { ...item, position, rotation: placement.rotation }
    const blocker = obstacles.find((area) => footprintsOverlap(itemFootprint(candidate), area))
    if (!blocker) break

    const blockerExtent = projectExtent(blocker, axis)
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
 * Стыкует блок вплотную к однотипному соседу, стоящему в той же линии.
 * Работает в локальной системе соседа: x — вдоль его ширины, y — вдоль глубины.
 */
function snapToNeighbour(item: FurnitureItem, placement: Placement, others: FurnitureItem[]): Placement | null {
  const candidates: { placement: Placement; distance: number; id: string }[] = []
  for (const other of others) {
    // Стыкуются только однотипные блоки: столешница ложится поверх тумб, а не в их линию.
    if (other.type !== item.type) continue
    // И только блоки одного ряда: навесной шкаф не встаёт в линию с напольной тумбой.
    if (Math.abs(item.elevation - other.elevation) > SAME_ROW_TOLERANCE) continue
    const angleDiff = Math.abs(((placement.rotation - other.rotation) % 360) + 360) % 360
    const sameFacing = angleDiff < ALIGN_TOLERANCE_DEG || 360 - angleDiff < ALIGN_TOLERANCE_DEG
    const aligned = sameFacing || Math.abs(angleDiff - 180) < ALIGN_TOLERANCE_DEG
    if (!aligned) continue

    const local = rotatePoint(placement.position, other.position, -other.rotation)
    const dx = local.x - other.position.x
    const dy = local.y - other.position.y
    const contact = other.params.width / 2 + item.params.width / 2

    if (Math.abs(dy) > item.params.depth / 2) continue
    if (Math.abs(Math.abs(dx) - contact) > NEIGHBOUR_GRAB) continue

    const snappedLocal = {
      x: other.position.x + Math.sign(dx || 1) * contact,
      y: other.position.y + (sameFacing ? (other.params.depth - item.params.depth) / 2 : 0),
    }
    const position = rotatePoint(snappedLocal, other.position, other.rotation)
    candidates.push({
      placement: { position, rotation: placement.rotation },
      distance: distance(position, placement.position),
      id: other.id,
    })
  }
  candidates.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
  return candidates[0]?.placement ?? null
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
  if (wallFit) return finishWallPlacement(item, wallFit, room, others, roomCenter)

  const base: Placement = { position, rotation: item.rotation }
  const neighbour = snapToNeighbour(item, base, others)
  const aligned = neighbour ?? { position: snapPoint(base.position, GRID_STEP), rotation: base.rotation }
  let resolved = aligned
  // Вытеснение из проёма может привести к соседу и наоборот, поэтому даём
  // двум системам ограничений несколько коротких проходов для стабилизации.
  for (let pass = 0; pass < 3; pass++) {
    resolved = resolveOverlap(item, resolved, others)
    resolved = resolveOpeningOverlap(item, resolved, room, roomCenter)
  }

  return { position: resolved.position, rotation: normalizeAngle(resolved.rotation) }
}

/**
 * Переставляет уже привязанный блок на конкретной стене. Используется после
 * изменения его габаритов: стена не выбирается заново, но углы и соседние
 * блоки учитываются так же, как при перетаскивании.
 */
export function placeBlockOnWall(
  item: FurnitureItem,
  wallId: string,
  offset: number,
  room: Room,
  others: FurnitureItem[],
  roomCenter: Point,
  snapEnabled: boolean,
): Placement {
  const wall = room.walls.find((candidate) => candidate.id === wallId)
  if (!wall) return { position: item.position, rotation: item.rotation }

  const sameWall = item.wallAnchor?.wallId === wall.id
  const side =
    sameWall && item.wallAnchor ? item.wallAnchor.side : attachmentSide(wall, item.position, room.walls, roomCenter)
  const distanceFromWall = sameWall && item.wallAnchor ? item.wallAnchor.distance : 0
  const fit = fitToWall(item, wall, side, offset, room.walls, distanceFromWall)
  return snapEnabled ? finishWallPlacement(item, fit, room, others, roomCenter) : fit.placement
}

export type SectionPlacement = Placement & { elevation: number }

/**
 * Посадка блока при перетаскивании в виде спереди: по горизонтали работают те же
 * привязки, что и на плане, по вертикали — притяжение к уровням соседей.
 * Глубина блока на плане не меняется — двигается только ось X и высота.
 */
export function placeBlockInSection(
  item: FurnitureItem,
  wallId: string,
  displayOffset: number,
  elevation: number,
  room: Room,
  others: FurnitureItem[],
  roomCenter: Point,
  snapEnabled: boolean,
): SectionPlacement {
  const wall = room.walls.find((candidate) => candidate.id === wallId)
  if (!wall) return { position: item.position, rotation: item.rotation, elevation: item.elevation }

  const raised = Math.max(0, elevation)
  const rawDisplayOffset = snap(displayOffset, GRID_STEP)
  const side = item.wallAnchor?.wallId === wall.id ? item.wallAnchor.side : wallInteriorSide(wall, roomCenter)
  const offset = displayToWallOffset(rawDisplayOffset, wall, side)
  const wallPlacement = placeBlockOnWall(item, wall.id, offset, room, others, roomCenter, false)

  if (!snapEnabled) {
    return {
      ...wallPlacement,
      elevation: snap(raised, GRID_STEP),
    }
  }

  const snapped = snapElevation({ ...item, position: wallPlacement.position }, raised, others)
  const snappedPlacement = placeBlockOnWall(
    { ...item, elevation: snapped },
    wall.id,
    offset,
    room,
    others,
    roomCenter,
    true,
  )
  return { ...snappedPlacement, elevation: snapped }
}
