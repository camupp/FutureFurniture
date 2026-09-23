import type { FurnitureItem, Point, Wall } from '@/domain/model'
import { distance, rotatePoint } from '@/shared/lib/geometry2d'

export const wallLength = (wall: Wall) => distance(wall.start, wall.end)

/** Угол стены в радианах на плане. */
export const wallAngle = (wall: Wall) => Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x)

export const wallCenter = (wall: Wall): Point => ({
  x: (wall.start.x + wall.end.x) / 2,
  y: (wall.start.y + wall.end.y) / 2,
})

/** Вершины контура помещения: стены считаются цепочкой. */
export function roomPolygon(walls: Wall[]): Point[] {
  if (walls.length === 0) return []
  const points: Point[] = [walls[0].start]
  for (const wall of walls) points.push(wall.end)
  if (points.length > 2 && distance(points[0], points[points.length - 1]) < 1) points.pop()
  return points
}

/** Четыре угла блока на плане с учётом поворота. */
export function itemFootprint(item: FurnitureItem): Point[] {
  const halfW = item.params.width / 2
  const halfD = item.params.depth / 2
  const offsets = [
    { x: -halfW, y: -halfD },
    { x: halfW, y: -halfD },
    { x: halfW, y: halfD },
    { x: -halfW, y: halfD },
  ]
  return offsets.map((o) =>
    rotatePoint({ x: item.position.x + o.x, y: item.position.y + o.y }, item.position, item.rotation),
  )
}

/**
 * Меняет длину стены, двигая её конец вдоль текущего направления.
 * Последующие стены цепочки сдвигаются на ту же дельту, чтобы контур не разорвался.
 */
export function setWallLength(walls: Wall[], wallId: string, newLength: number): Wall[] {
  const index = walls.findIndex((w) => w.id === wallId)
  if (index === -1) return walls
  const wall = walls[index]
  const length = wallLength(wall)
  if (length < 1 || newLength < 1) return walls

  const ux = (wall.end.x - wall.start.x) / length
  const uy = (wall.end.y - wall.start.y) / length
  const newEnd = { x: wall.start.x + ux * newLength, y: wall.start.y + uy * newLength }
  const dx = newEnd.x - wall.end.x
  const dy = newEnd.y - wall.end.y

  return walls.map((w, i) => {
    if (i < index) return w
    if (i === index) return { ...w, end: newEnd }
    return {
      ...w,
      start: { x: w.start.x + dx, y: w.start.y + dy },
      end: { x: w.end.x + dx, y: w.end.y + dy },
    }
  })
}
