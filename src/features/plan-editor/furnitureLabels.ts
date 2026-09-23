import type { BlockType, FurnitureItem } from '@/domain/model'
import { footprintsOverlap } from '@/domain/geometry/collision'
import { itemFootprint } from '@/domain/geometry/geometry'

const TYPE_PRIORITY: Record<BlockType, number> = {
  cabinet: 3,
  countertop: 2,
  sink: 1,
  hob: 1,
}

function labelPriority(
  item: FurnitureItem,
  index: number,
  selectedId: string | undefined,
): [selected: number, type: number, elevation: number, order: number] {
  return [item.id === selectedId ? 1 : 0, TYPE_PRIORITY[item.type], -item.elevation, -index]
}

function hasHigherPriority(a: ReturnType<typeof labelPriority>, b: ReturnType<typeof labelPriority>): boolean {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index]! > b[index]!
  }
  return false
}

/**
 * Оставляет одну подпись в каждой фактически наложенной паре блоков.
 * Попарная проверка намеренна: столешница может накрывать две соседние тумбы,
 * но подписи обеих тумб при этом должны остаться видимыми.
 */
export function visibleFurnitureLabelIds(items: FurnitureItem[], selectedId?: string): Set<string> {
  const footprints = items.map(itemFootprint)
  const priorities = items.map((item, index) => labelPriority(item, index, selectedId))

  return new Set(
    items.flatMap((item, index) => {
      const obscured = items.some(
        (_other, otherIndex) =>
          otherIndex !== index &&
          footprintsOverlap(footprints[index]!, footprints[otherIndex]!) &&
          hasHigherPriority(priorities[otherIndex]!, priorities[index]!),
      )
      return obscured ? [] : [item.id]
    }),
  )
}
