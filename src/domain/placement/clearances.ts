import type { FurnitureItem, Point, Room } from '@/domain/model'
import { footprintsOverlap } from '@/domain/geometry/collision'
import { itemFootprint } from '@/domain/geometry/geometry'
import { placementObstacles } from '@/domain/validation/obstacles'
import { itemPlacementIssues } from '@/domain/validation/rules'
import { positionFromWallAnchor, wallFrame, wallNormal } from './wallAnchors'

export type ClearanceSide = 'left' | 'right' | 'back' | 'front'
export type ClearanceReference = { side: ClearanceSide; kind: 'wall' | 'furniture'; targetId: string }
export type Clearance = ClearanceReference & {
  label: string
  distance: number
  start: Point
  end: Point
  direction: Point
}
export const CLEARANCE_LABELS: Record<ClearanceSide, string> = {
  left: 'Левый торец',
  right: 'Правый торец',
  back: 'Сзади',
  front: 'Перед фасадом',
}

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y

function clip(polygon: Point[], boundary: number, above: boolean): Point[] {
  const result: Point[] = []
  const inside = (point: Point) => (above ? point.y >= boundary : point.y <= boundary)
  polygon.forEach((point, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!
    if (inside(point) !== inside(previous)) {
      const t = (boundary - previous.y) / (point.y - previous.y)
      result.push({ x: previous.x + t * (point.x - previous.x), y: boundary })
    }
    if (inside(point)) result.push(point)
  })
  return result
}

/** Minimum face-to-obstacle gap across the whole face, never a centre-to-centre distance. */
export function furnitureClearances(item: FurnitureItem, room: Room, furniture: FurnitureItem[]): Clearance[] {
  const angle = (item.rotation * Math.PI) / 180
  const x = { x: Math.cos(angle), y: Math.sin(angle) }
  const y = { x: -x.y, y: x.x }
  const obstacles = placementObstacles(item, room, furniture).filter(
    (obstacle) => obstacle.kind === 'wall' || obstacle.kind === 'furniture',
  )
  const faces: { side: ClearanceSide; direction: Point; half: number; span: number }[] = [
    { side: 'left', direction: { x: -x.x, y: -x.y }, half: item.params.width / 2, span: item.params.depth / 2 },
    { side: 'right', direction: x, half: item.params.width / 2, span: item.params.depth / 2 },
    { side: 'back', direction: { x: -y.x, y: -y.y }, half: item.params.depth / 2, span: item.params.width / 2 },
    { side: 'front', direction: y, half: item.params.depth / 2, span: item.params.width / 2 },
  ]
  return faces.flatMap(({ side, direction, half, span }) => {
    const across = { x: -direction.y, y: direction.x }
    const candidates: Clearance[] = []
    for (const obstacle of obstacles) {
      const local = obstacle.polygon.map((point) => {
        const relative = { x: point.x - item.position.x, y: point.y - item.position.y }
        return { x: dot(relative, direction), y: dot(relative, across) }
      })
      const band = clip(clip(local, -span, true), span, false)
      if (band.length < 3 || Math.max(...band.map((p) => p.y)) - Math.min(...band.map((p) => p.y)) < 0.01) continue
      const nearest = Math.min(...band.map((point) => point.x))
      if (nearest < half - 0.01) continue
      const contacts = band.filter((point) => Math.abs(point.x - nearest) < 0.01)
      const cross = contacts.reduce((sum, point) => sum + point.y, 0) / contacts.length
      const world = (along: number): Point => ({
        x: item.position.x + direction.x * along + across.x * cross,
        y: item.position.y + direction.y * along + across.y * cross,
      })
      candidates.push({
        side,
        kind: obstacle.kind as 'wall' | 'furniture',
        targetId: obstacle.id,
        label: obstacle.label,
        distance: Math.max(0, nearest - half),
        direction,
        start: world(half),
        end: world(nearest),
      })
    }
    candidates.sort((a, b) => a.distance - b.distance || a.targetId.localeCompare(b.targetId))
    return candidates[0] ? [candidates[0]] : []
  })
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const half = (input: Point[]) => {
    const result: Point[] = []
    for (const point of input) {
      while (result.length >= 2 && cross(result[result.length - 2]!, result.at(-1)!, point) <= 0) result.pop()
      result.push(point)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

export function placeAtClearance(
  item: FurnitureItem,
  reference: ClearanceReference,
  requested: number,
  room: Room,
  furniture: FurnitureItem[],
): { item: FurnitureItem; error?: never } | { error: string; item?: never } {
  if (item.autoCountertop) return { error: 'Положение автоматической столешницы задают её тумбы' }
  if (!Number.isFinite(requested) || requested < 0 || requested > 50000)
    return { error: 'Введите зазор от 0 до 50 000 мм' }
  const gap = furnitureClearances(item, room, furniture).find(
    (value) => value.side === reference.side && value.kind === reference.kind && value.targetId === reference.targetId,
  )
  if (!gap) return { error: 'Ближайшее препятствие изменилось. Выберите зазор заново' }
  const amount = gap.distance - Math.round(requested)
  const delta = { x: gap.direction.x * amount, y: gap.direction.y * amount }
  let candidate = { ...item, position: { x: item.position.x + delta.x, y: item.position.y + delta.y } }
  if (item.wallAnchor) {
    const wall = room.walls.find((value) => value.id === item.wallAnchor?.wallId)
    if (!wall) return { error: 'Стена привязки не найдена' }
    const distance = item.wallAnchor.distance + dot(delta, wallNormal(wall, item.wallAnchor.side))
    if (distance < -0.01) return { error: 'Для такого зазора блок должен пересечь стену привязки' }
    const wallAnchor = {
      ...item.wallAnchor,
      offset: item.wallAnchor.offset + dot(delta, wallFrame(wall).axis),
      distance: Math.max(0, distance),
    }
    candidate = { ...candidate, wallAnchor, position: positionFromWallAnchor(item, wall, wallAnchor) }
  }
  const issues = itemPlacementIssues(candidate, furniture, room)
  if (issues.length) return { error: `Зазор не применён: ${issues[0]!.message.toLowerCase()}` }
  // A numeric edit must not teleport through a partition or another cabinet.
  const start = itemFootprint(item)
  const swept = convexHull([...start, ...itemFootprint(candidate)])
  const blocker = placementObstacles(item, room, furniture).find(
    (obstacle) => !footprintsOverlap(start, obstacle.polygon) && footprintsOverlap(swept, obstacle.polygon),
  )
  if (blocker) return { error: `На пути перемещения: ${blocker.label.toLowerCase()}` }
  return { item: candidate }
}
