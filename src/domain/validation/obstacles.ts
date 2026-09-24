import { BLOCK_LABELS, type FurnitureItem, type Point, type Room } from '@/domain/model'
import { isBuiltIn, OVERLAP_TOLERANCE } from '@/domain/geometry/collision'
import { boundaryWalls, itemFootprint, roomPolygon, wallFootprint } from '@/domain/geometry/geometry'
import { bounds } from '@/shared/lib/geometry2d'
import { doorSwingFootprint, openingFootprint } from '@/domain/room/openings'

export type PlacementObstacle = {
  kind: 'wall' | 'furniture' | 'opening' | 'door-swing'
  id: string
  label: string
  message: string
  polygon: Point[]
}

/** The same physical obstacles drive error explanations, measurements and exact movement. */
export function placementObstacles(item: FurnitureItem, room: Room, furniture: FurnitureItem[]): PlacementObstacle[] {
  if (isBuiltIn(item)) return []
  const obstacles: PlacementObstacle[] = []
  const boundaryIds = new Set(boundaryWalls(room.walls).map((wall) => wall.id))
  if (item.elevation < room.wallHeight) {
    room.walls.forEach((wall, index) => {
      const partition = wall.kind === 'partition' || (boundaryIds.size > 0 && !boundaryIds.has(wall.id))
      obstacles.push({
        kind: 'wall',
        id: wall.id,
        label: `${partition ? 'Перегородка' : 'Стена'} ${index + 1}`,
        message: `Пересекается ${partition ? 'с перегородкой' : 'со стеной'} №${index + 1}`,
        polygon: wallFootprint(wall),
      })
    })
  }
  furniture.forEach((other, index) => {
    if (other.id === item.id || isBuiltIn(other)) return
    if (item.autoCountertop?.groupId && item.autoCountertop.groupId === other.autoCountertop?.groupId) return
    if (
      item.elevation + OVERLAP_TOLERANCE >= other.elevation + other.params.height ||
      other.elevation + OVERLAP_TOLERANCE >= item.elevation + item.params.height
    )
      return
    const label = `${BLOCK_LABELS[other.type]} ${index + 1}`
    obstacles.push({
      kind: 'furniture',
      id: other.id,
      label,
      message: `Пересекается с блоком «${label}»`,
      polygon: itemFootprint(other),
    })
  })
  const center = bounds(roomPolygon(room.walls)).center
  room.openings.forEach((opening, index) => {
    if (item.elevation >= opening.sill + opening.height || opening.sill >= item.elevation + item.params.height) return
    const label = `${opening.type === 'door' ? 'Дверь' : 'Окно'} ${index + 1}`
    const polygon = openingFootprint(opening, room)
    if (polygon)
      obstacles.push({
        kind: 'opening',
        id: opening.id,
        label,
        message: `Перекрывает ${opening.type === 'door' ? 'дверной проём' : 'окно'} №${index + 1}`,
        polygon,
      })
    const swing = doorSwingFootprint(opening, room, center)
    if (swing)
      obstacles.push({
        kind: 'door-swing',
        id: opening.id,
        label,
        message: `Перекрывает открывание двери №${index + 1}`,
        polygon: swing,
      })
  })
  return obstacles
}
