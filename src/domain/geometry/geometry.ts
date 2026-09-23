import type { FurnitureItem, Point, Wall } from '@/domain/model'
import { distance, rotatePoint } from '@/shared/lib/geometry2d'

export const wallLength = (wall: Wall) => distance(wall.start, wall.end)

/** Угол стены в радианах на плане. */
export const wallAngle = (wall: Wall) => Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x)

export const wallCenter = (wall: Wall): Point => ({
  x: (wall.start.x + wall.end.x) / 2,
  y: (wall.start.y + wall.end.y) / 2,
})

/** Плановое тело стены по оси и толщине, независимо от её роли в контуре пола. */
export function wallFootprint(wall: Wall): Point[] {
  const angle = wallAngle(wall)
  const normal = { x: (-Math.sin(angle) * wall.thickness) / 2, y: (Math.cos(angle) * wall.thickness) / 2 }
  return [
    { x: wall.start.x + normal.x, y: wall.start.y + normal.y },
    { x: wall.end.x + normal.x, y: wall.end.y + normal.y },
    { x: wall.end.x - normal.x, y: wall.end.y - normal.y },
    { x: wall.start.x - normal.x, y: wall.start.y - normal.y },
  ]
}

/** Первый замкнутый внешний контур. Старые проекты без kind читаются по порядку стен. */
export function boundaryWalls(walls: Wall[]): Wall[] {
  const candidates = walls.filter((wall) => wall.kind !== 'partition')
  if (candidates.length < 3) return []
  const chain: Wall[] = []
  for (const wall of candidates) {
    if (chain.length && distance(chain[chain.length - 1]!.end, wall.start) > 1) return []
    chain.push(wall)
    if (chain.length >= 3 && distance(wall.end, chain[0]!.start) <= 1) return chain
  }
  return []
}

/** Пол строится только по замкнутому внешнему контуру, а не по перегородкам. */
export function roomPolygon(walls: Wall[]): Point[] {
  const boundary = boundaryWalls(walls)
  return boundary.map((wall) => wall.start)
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

  // Перегородки — независимые ветви графа, а не продолжение периметра.
  const boundaryIds = new Set(boundaryWalls(walls).map((candidate) => candidate.id))
  if (!boundaryIds.has(wallId)) {
    return walls.map((candidate) => (candidate.id === wallId ? { ...candidate, end: newEnd } : candidate))
  }

  return walls.map((w, i) => {
    if (i < index) return w
    if (i === index) return { ...w, end: newEnd }
    if (!boundaryIds.has(w.id)) return w
    return {
      ...w,
      start: { x: w.start.x + dx, y: w.start.y + dy },
      end: { x: w.end.x + dx, y: w.end.y + dy },
    }
  })
}
