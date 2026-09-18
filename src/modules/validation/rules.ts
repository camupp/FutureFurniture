import type { FurnitureItem, Room } from '../../shared/types'
import { itemFootprint, pointInPolygon, roomPolygon } from '../../shared/utils/geometry'

/**
 * Итерация 1: единственное правило — блок не выходит за контур стен.
 * Пересечения блоков, проёмы и коммуникации появятся вместе с их редакторами.
 */
export function isItemInsideRoom(item: FurnitureItem, room: Room): boolean {
  const polygon = roomPolygon(room.walls)
  if (polygon.length < 3) return true
  return itemFootprint(item).every((corner) => pointInPolygon(corner, polygon))
}

export function invalidItemIds(furniture: FurnitureItem[], room: Room): Set<string> {
  return new Set(furniture.filter((item) => !isItemInsideRoom(item, room)).map((item) => item.id))
}
