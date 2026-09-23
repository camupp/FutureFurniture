import type { FurnitureItem, Point, Room, Wall, WallAnchor, WallSide } from '@/domain/model'
import { wallAngle, wallLength } from '@/domain/geometry/geometry'
import { inwardWallNormal, offsetAlongWall } from '@/domain/room/openings'

const INFER_DISTANCE_TOLERANCE = 35
const INFER_ANGLE_TOLERANCE = 1
const WALL_JOINT_TOLERANCE = 1

export type WallFrame = {
  wall: Wall
  length: number
  axis: Point
  leftNormal: Point
}

export function wallFrame(wall: Wall): WallFrame {
  const angle = wallAngle(wall)
  const axis = { x: Math.cos(angle), y: Math.sin(angle) }
  return {
    wall,
    length: wallLength(wall),
    axis,
    leftNormal: { x: -axis.y, y: axis.x },
  }
}

export function wallNormal(wall: Wall, side: WallSide): Point {
  const normal = wallFrame(wall).leftNormal
  const sign = side === 'left' ? 1 : -1
  return { x: normal.x * sign, y: normal.y * sign }
}

export type WallUsableRange = {
  /** Первая точка внутренней грани стены, не занятая примыкающей стеной. */
  start: number
  /** Последняя точка внутренней грани стены, не занятая примыкающей стеной. */
  end: number
}

function samePoint(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= WALL_JOINT_TOLERANCE
}

function clipAtLocalY(polygon: Point[], boundary: number, keepAbove: boolean): Point[] {
  if (polygon.length === 0) return []
  const result: Point[] = []
  const inside = (point: Point) => (keepAbove ? point.y >= boundary : point.y <= boundary)

  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index]!
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!
    const currentInside = inside(current)
    const previousInside = inside(previous)

    if (currentInside !== previousInside) {
      const delta = current.y - previous.y
      const ratio = Math.abs(delta) < 0.0001 ? 0 : (boundary - previous.y) / delta
      result.push({ x: previous.x + (current.x - previous.x) * ratio, y: boundary })
    }
    if (currentInside) result.push(current)
  }

  return result
}

function wallRectangleInFrame(other: Wall, host: Wall, side: WallSide): Point[] {
  const hostFrame = wallFrame(host)
  const normal = wallNormal(host, side)
  const otherFrame = wallFrame(other)
  const half = other.thickness / 2
  const corners = [
    {
      x: other.start.x + otherFrame.leftNormal.x * half,
      y: other.start.y + otherFrame.leftNormal.y * half,
    },
    { x: other.end.x + otherFrame.leftNormal.x * half, y: other.end.y + otherFrame.leftNormal.y * half },
    { x: other.end.x - otherFrame.leftNormal.x * half, y: other.end.y - otherFrame.leftNormal.y * half },
    {
      x: other.start.x - otherFrame.leftNormal.x * half,
      y: other.start.y - otherFrame.leftNormal.y * half,
    },
  ]

  return corners.map((point) => {
    const dx = point.x - host.start.x
    const dy = point.y - host.start.y
    return {
      x: dx * hostFrame.axis.x + dy * hostFrame.axis.y,
      y: dx * normal.x + dy * normal.y,
    }
  })
}

/**
 * Возвращает свободный от угловых стыков отрезок стены.
 *
 * Координаты стен проходят по их оси. Пересекаем тело примыкающей стены с
 * полосой, которую занимает мебель по глубине, поэтому расчёт работает и для
 * косых/вогнутых углов, и для обеих сторон стены.
 */
export function wallUsableRange(
  item: FurnitureItem,
  wall: Wall,
  walls: Wall[],
  side: WallSide,
  distanceFromWall = 0,
): WallUsableRange {
  const frame = wallFrame(wall)
  const depthStart = wall.thickness / 2 + distanceFromWall
  const depthEnd = depthStart + item.params.depth
  let start = 0
  let end = frame.length

  for (const other of walls) {
    if (other.id === wall.id || wallLength(other) < 1) continue
    const connectedToStart = samePoint(other.start, wall.start) || samePoint(other.end, wall.start)
    const connectedToEnd = samePoint(other.start, wall.end) || samePoint(other.end, wall.end)
    if (!connectedToStart && !connectedToEnd) continue

    const inFurnitureBand = clipAtLocalY(
      clipAtLocalY(wallRectangleInFrame(other, wall, side), depthStart, true),
      depthEnd,
      false,
    )
    if (inFurnitureBand.length < 3) continue

    const along = inFurnitureBand.map((point) => point.x)
    const across = inFurnitureBand.map((point) => point.y)
    const minAlong = Math.min(...along)
    const maxAlong = Math.max(...along)
    // Касание границей допустимо: оно не создаёт фактического пересечения тел.
    if (maxAlong - minAlong <= 0.01 || Math.max(...across) - Math.min(...across) <= 0.01) continue

    if (connectedToStart && maxAlong > 0) start = Math.max(start, maxAlong)
    if (connectedToEnd && minAlong < frame.length) end = Math.min(end, minAlong)
  }

  return {
    start: Math.min(frame.length, Math.max(0, start)),
    end: Math.max(0, Math.min(frame.length, end)),
  }
}

export type WallAnchorOffsetLimits = {
  min: number
  max: number
  fits: boolean
}

/** Допустимое положение центра блока вдоль стены с учётом его ширины и углов. */
export function wallAnchorOffsetLimits(
  item: FurnitureItem,
  wall: Wall,
  walls: Wall[],
  side: WallSide = item.wallAnchor?.side ?? 'left',
  distanceFromWall = item.wallAnchor?.distance ?? 0,
): WallAnchorOffsetLimits {
  const usable = wallUsableRange(item, wall, walls, side, distanceFromWall)
  const half = item.params.width / 2
  const min = usable.start + half
  const max = usable.end - half
  if (min <= max) return { min, max, fits: true }

  // Если блок шире свободного участка, держим его по центру. Валидация при этом
  // всё равно покажет ошибку благодаря fits=false.
  const center = (usable.start + usable.end) / 2
  return { min: center, max: center, fits: false }
}

export function wallInteriorSide(wall: Wall, roomCenter: Point): WallSide {
  const normal = inwardWallNormal(wall, roomCenter)
  const left = wallFrame(wall).leftNormal
  return normal.x * left.x + normal.y * left.y >= 0 ? 'left' : 'right'
}

/** Угол блока, при котором его фасад смотрит от стены внутрь комнаты. */
export function rotationFacingWall(wall: Wall, side: WallSide): number {
  const normal = wallNormal(wall, side)
  const degrees = (Math.atan2(-normal.x, normal.y) * 180) / Math.PI
  return Math.round((((degrees % 360) + 360) % 360) * 100) / 100
}

/** Мировая координата центра блока, вычисленная из его привязки. */
export function positionFromWallAnchor(item: FurnitureItem, wall: Wall, anchor = item.wallAnchor): Point {
  if (!anchor) return item.position
  const frame = wallFrame(wall)
  const normal = wallNormal(wall, anchor.side)
  const across = wall.thickness / 2 + anchor.distance + item.params.depth / 2
  return {
    x: wall.start.x + frame.axis.x * anchor.offset + normal.x * across,
    y: wall.start.y + frame.axis.y * anchor.offset + normal.y * across,
  }
}

export function furnitureFromWallAnchor(item: FurnitureItem, wall: Wall): FurnitureItem {
  if (!item.wallAnchor) return item
  return {
    ...item,
    position: positionFromWallAnchor(item, wall),
    rotation: rotationFacingWall(wall, item.wallAnchor.side),
  }
}

/** Пересчитывает мировые координаты после движения/поворота/изменения толщины стен. */
export function syncFurnitureToWalls(furniture: FurnitureItem[], walls: Wall[]): FurnitureItem[] {
  return furniture.map((item) => {
    if (!item.wallAnchor) return item
    const wall = walls.find((candidate) => candidate.id === item.wallAnchor?.wallId)
    if (!wall) {
      const { wallAnchor: _removed, ...detached } = item
      return detached
    }
    const limits = wallAnchorOffsetLimits(item, wall, walls, item.wallAnchor.side, item.wallAnchor.distance)
    const offset = Math.min(Math.max(item.wallAnchor.offset, limits.min), limits.max)
    return furnitureFromWallAnchor({ ...item, wallAnchor: { ...item.wallAnchor, offset } }, wall)
  })
}

export function detachFromWall(item: FurnitureItem): FurnitureItem {
  const { wallAnchor: _removed, ...detached } = item
  return detached
}

/**
 * На фасаде начало шкалы всегда находится слева для наблюдателя внутри комнаты.
 * Поэтому для правой стороны стены геометрическое направление разворачивается.
 */
export function wallOffsetToDisplay(offset: number, wall: Wall, side: WallSide): number {
  return side === 'left' ? offset : wallLength(wall) - offset
}

export function displayToWallOffset(displayOffset: number, wall: Wall, side: WallSide): number {
  return side === 'left' ? displayOffset : wallLength(wall) - displayOffset
}

export function wallPointAtOffset(wall: Wall, offset: number): Point {
  const frame = wallFrame(wall)
  return {
    x: wall.start.x + frame.axis.x * offset,
    y: wall.start.y + frame.axis.y * offset,
  }
}

export function anchorAtPosition(wall: Wall, side: WallSide, position: Point, distanceFromWall = 0): WallAnchor {
  return {
    wallId: wall.id,
    side,
    offset: offsetAlongWall(position, wall),
    distance: distanceFromWall,
  }
}

export function wallAnchorIsValid(item: FurnitureItem, room: Room): boolean {
  const anchor = item.wallAnchor
  if (!anchor) return true
  const wall = room.walls.find((candidate) => candidate.id === anchor.wallId)
  if (!wall) return false
  const limits = wallAnchorOffsetLimits(item, wall, room.walls, anchor.side, anchor.distance)
  return limits.fits && anchor.offset >= limits.min - 0.01 && anchor.offset <= limits.max + 0.01
}

function angleDistance(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360)
  return Math.min(diff, 360 - diff)
}

/**
 * Осторожная миграция старого проекта: привязка создаётся только для блока,
 * который уже точно стоит задней гранью на одной-единственной стене.
 */
export function inferWallAnchor(item: FurnitureItem, room: Room, roomCenter: Point): WallAnchor | undefined {
  if (item.wallAnchor) return item.wallAnchor
  const candidates: { anchor: WallAnchor; error: number }[] = []

  for (const wall of room.walls) {
    const length = wallLength(wall)
    if (length < 1) continue
    const side = wallInteriorSide(wall, roomCenter)
    if (angleDistance(item.rotation, rotationFacingWall(wall, side)) > INFER_ANGLE_TOLERANCE) continue

    const offset = offsetAlongWall(item.position, wall)
    const limits = wallAnchorOffsetLimits(item, wall, room.walls, side, 0)
    if (!limits.fits || offset < limits.min || offset > limits.max) continue

    const linePoint = wallPointAtOffset(wall, offset)
    const expected = wall.thickness / 2 + item.params.depth / 2
    const normal = wallNormal(wall, side)
    const actual = (item.position.x - linePoint.x) * normal.x + (item.position.y - linePoint.y) * normal.y
    const error = Math.abs(actual - expected)
    if (error <= INFER_DISTANCE_TOLERANCE) {
      candidates.push({ anchor: { wallId: wall.id, side, offset, distance: 0 }, error })
    }
  }

  candidates.sort((a, b) => a.error - b.error)
  if (candidates.length !== 1) return undefined
  return candidates[0]?.anchor
}
