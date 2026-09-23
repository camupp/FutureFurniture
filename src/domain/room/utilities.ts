import type { Point, Room, Utility, UtilityMount, Wall } from '@/domain/model'
import { roomPolygon, wallAngle, wallLength } from '@/domain/geometry/geometry'
import { bounds } from '@/shared/lib/geometry2d'
import { inwardWallNormal, offsetAlongWall } from '@/domain/room/openings'
import { clamp } from '@/shared/lib/units'

/** Насколько центр настенного вывода вынесен внутрь от внутренней поверхности стены. */
export const WALL_UTILITY_OUTSET = 24

export type WallUtilityFrame = {
  wall: Wall
  point: Point
  axis: Point
  inward: Point
  offset: number
}

function roomCenter(room: Room): Point {
  const polygon = roomPolygon(room.walls)
  return polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
}

export function wallUtilityFrame(utility: Utility, room: Room): WallUtilityFrame | null {
  if (utility.mount.kind !== 'wall') return null
  const mount = utility.mount
  const wall = room.walls.find((candidate) => candidate.id === mount.wallId)
  if (!wall || wallLength(wall) < 1) return null

  const angle = wallAngle(wall)
  const axis = { x: Math.cos(angle), y: Math.sin(angle) }
  const inward = inwardWallNormal(wall, roomCenter(room))
  const offset = clamp(mount.offset, 0, wallLength(wall))
  const across = wall.thickness / 2 + WALL_UTILITY_OUTSET
  return {
    wall,
    axis,
    inward,
    offset,
    point: {
      x: wall.start.x + axis.x * offset + inward.x * across,
      y: wall.start.y + axis.y * offset + inward.y * across,
    },
  }
}

/** Фактическая координата вывода на плане. */
export function utilityPoint(utility: Utility, room: Room): Point {
  return wallUtilityFrame(utility, room)?.point ?? utility.point
}

/** Создаёт описание настенного крепления в точке клика по стене. */
export function wallUtilityMount(wallId: string, offset: number): UtilityMount {
  return { kind: 'wall', wallId, offset: Math.round(offset) }
}

/**
 * Перемещает вывод. Напольный следует за курсором свободно, настенный — только
 * вдоль своей стены; мировая точка обновляется как безопасный резерв для сохранения.
 */
export function moveUtilityToPoint(utility: Utility, point: Point, room: Room): Utility {
  if (utility.mount.kind === 'floor') {
    return { ...utility, point: { x: Math.round(point.x), y: Math.round(point.y) } }
  }

  const mount = utility.mount
  const wall = room.walls.find((candidate) => candidate.id === mount.wallId)
  if (!wall) return utility
  const offset = Math.round(clamp(offsetAlongWall(point, wall), 0, wallLength(wall)))
  const nextMount: UtilityMount = { ...mount, offset }
  const moved = { ...utility, mount: nextMount }
  return { ...moved, point: utilityPoint(moved, room) }
}

/** Нормализует вывод после загрузки или изменения стены. */
export function normalizeUtility(utility: Utility, room: Room): Utility | null {
  const height = utility.mount.kind === 'floor' ? 0 : clamp(utility.height, 0, room.wallHeight)
  if (utility.mount.kind === 'floor') return { ...utility, height }
  const currentMount = utility.mount
  const wall = room.walls.find((candidate) => candidate.id === currentMount.wallId)
  if (!wall) return null
  const mount: UtilityMount = {
    ...currentMount,
    offset: Math.round(clamp(currentMount.offset, 0, wallLength(wall))),
  }
  const normalized = { ...utility, height, mount }
  return { ...normalized, point: utilityPoint(normalized, room) }
}
