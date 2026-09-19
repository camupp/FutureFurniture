import type { FurnitureItem, Room } from '../../shared/types'
import { blocksOverlap } from '../../shared/utils/collision'
import { itemFootprint, pointInPolygon, roomPolygon } from '../../shared/utils/geometry'

export function isItemInsideRoom(item: FurnitureItem, room: Room): boolean {
  const polygon = roomPolygon(room.walls)
  if (polygon.length < 3) return true
  return itemFootprint(item).every((corner) => pointInPolygon(corner, polygon))
}

export function collides(item: FurnitureItem, others: FurnitureItem[]): boolean {
  return others.some((other) => blocksOverlap(item, other))
}

/** Блоки, нарушающие хотя бы одно правило: вышли за стены или пересекаются друг с другом. */
export function invalidItemIds(furniture: FurnitureItem[], room: Room): Set<string> {
  const invalid = new Set<string>()
  for (const item of furniture) {
    if (!isItemInsideRoom(item, room) || collides(item, furniture)) invalid.add(item.id)
  }
  return invalid
}
