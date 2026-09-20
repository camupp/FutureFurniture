import type { FurnitureItem, Point, Wall } from '../types'

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

export const wallLength = (wall: Wall) => distance(wall.start, wall.end)

/** Угол стены в радианах на плане. */
export const wallAngle = (wall: Wall) => Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x)

export const wallCenter = (wall: Wall): Point => ({
  x: (wall.start.x + wall.end.x) / 2,
  y: (wall.start.y + wall.end.y) / 2,
})

export const snap = (value: number, step: number) => Math.round(value / step) * step

export const snapPoint = (p: Point, step: number): Point => ({ x: snap(p.x, step), y: snap(p.y, step) })

/** Притягивает точку к горизонтали или вертикали относительно `from` — углы по умолчанию 90°. */
export function orthoSnap(from: Point, to: Point): Point {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
}

export function rotatePoint(p: Point, origin: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos }
}

/** Вершины контура помещения: стены считаются цепочкой. */
export function roomPolygon(walls: Wall[]): Point[] {
  if (walls.length === 0) return []
  const points: Point[] = [walls[0].start]
  for (const wall of walls) points.push(wall.end)
  if (points.length > 2 && distance(points[0], points[points.length - 1]) < 1) points.pop()
  return points
}

export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses = a.y > p.y !== b.y > p.y
    if (crosses && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
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

export type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  center: Point
}

export function bounds(points: Point[]): Bounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, center: { x: 0, y: 0 } }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  }
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
