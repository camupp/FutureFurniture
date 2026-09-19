import { BUILT_IN_FLANGE, type FurnitureItem } from '../types'
import { footprintsOverlap, isBuiltIn } from './collision'
import { itemFootprint } from './geometry'

/** На сколько мм по высоте ловится уровень соседнего блока. */
const ELEVATION_GRAB = 200
/** Зазор под бортиком врезного блока: совпадающие плоскости мерцают. */
const FLUSH_GAP = 2

/**
 * Уровень, на который блок встаёт «сам собой»:
 * — врезной блок опирается бортиком на столешницу, под которой он стоит;
 * — обычный блок встаёт на верх того, над чем находится (столешница на тумбы);
 * — пол.
 * Врезной блок намеренно не притягивается к голой тумбе: без столешницы мойка
 * должна висеть на той же отметке, как если бы столешница была прозрачной.
 */
function elevationTargets(item: FurnitureItem, others: FurnitureItem[]): number[] {
  const footprint = itemFootprint(item)
  const targets = [0]

  for (const other of others) {
    if (other.id === item.id) continue
    if (!footprintsOverlap(footprint, itemFootprint(other))) continue
    const top = other.elevation + other.params.height

    if (isBuiltIn(item)) {
      if (other.type !== 'countertop') continue
      targets.push(top - (item.params.height - BUILT_IN_FLANGE[item.type]) + FLUSH_GAP)
    } else if (!isBuiltIn(other)) {
      targets.push(top)
    }
  }

  return targets
}

/** Притягивает высоту установки к ближайшему осмысленному уровню. */
export function snapElevation(item: FurnitureItem, elevation: number, others: FurnitureItem[]): number {
  let best = elevation
  let bestDelta = ELEVATION_GRAB

  for (const target of elevationTargets(item, others)) {
    const delta = Math.abs(target - elevation)
    if (delta < bestDelta) {
      best = target
      bestDelta = delta
    }
  }

  return Math.max(0, Math.round(best))
}
