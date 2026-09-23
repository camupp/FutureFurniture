import { OPENING_LIMITS, projectSchema } from '@/domain/model'
import { syncAutoCountertops } from '@/domain/assemblies/countertops'
import { roomPolygon, wallLength } from '@/domain/geometry/geometry'
import { bounds } from '@/shared/lib/geometry2d'
import { normalizeOpening } from '@/domain/room/openings'
import { normalizeUtility, utilityPoint } from '@/domain/room/utilities'
import { inferWallAnchor, syncFurnitureToWalls } from '@/domain/placement/wallAnchors'
import type { AppState, ViewMode } from './types'

export const PROJECT_STORAGE_KEY = 'future-furniture-project'

export function partializeProject(state: AppState) {
  return {
    room: state.room,
    furniture: state.furniture,
    viewMode: state.viewMode,
    elevationWallId: state.elevationWallId,
  }
}

export function mergePersistedProject(persisted: unknown, current: AppState, newId: () => string): AppState {
  const parsed = projectSchema.safeParse(persisted)
  if (!parsed.success) return current
  const viewMode = (persisted as { viewMode?: ViewMode }).viewMode
  const room = parsed.data.room
  const openings = room.openings.flatMap((opening) => {
    const wall = room.walls.find((candidate) => candidate.id === opening.wallId)
    return wall && wallLength(wall) >= OPENING_LIMITS.width.min
      ? [normalizeOpening(opening, wall, room.wallHeight)]
      : []
  })
  const utilities = room.utilities.flatMap((utility) => {
    const normalized = normalizeUtility(utility, room)
    return normalized ? [{ ...normalized, point: utilityPoint(normalized, room) }] : []
  })
  const polygon = roomPolygon(room.walls)
  const roomCenter = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
  const furniture = syncFurnitureToWalls(
    parsed.data.furniture.map((item) => {
      const wallAnchor = item.wallAnchor ?? inferWallAnchor(item, room, roomCenter)
      return wallAnchor ? { ...item, wallAnchor } : item
    }),
    room.walls,
  )
  const persistedElevationWallId = (persisted as { elevationWallId?: string | null }).elevationWallId
  const elevationWallId = room.walls.some((wall) => wall.id === persistedElevationWallId)
    ? (persistedElevationWallId ?? null)
    : (room.walls[0]?.id ?? null)
  return {
    ...current,
    ...parsed.data,
    room: { ...room, openings, utilities },
    furniture: syncAutoCountertops(furniture, room, newId),
    viewMode: viewMode ?? current.viewMode,
    elevationWallId,
  }
}
