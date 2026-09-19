import { BUILT_IN_TYPES, type FurnitureItem, type Point } from '../types'
import { itemFootprint } from './geometry'

/** Блоки, состыкованные вплотную, не считаются пересекающимися. */
export const OVERLAP_TOLERANCE = 2

export function projectExtent(points: Point[], axis: Point) {
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    const value = p.x * axis.x + p.y * axis.y
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  return { min, max }
}

function overlapsByHeight(a: FurnitureItem, b: FurnitureItem): boolean {
  return (
    a.elevation + OVERLAP_TOLERANCE < b.elevation + b.params.height &&
    b.elevation + OVERLAP_TOLERANCE < a.elevation + a.params.height
  )
}

/** Пересечение двух повёрнутых прямоугольников — теорема о разделяющей оси. */
export function footprintsOverlap(a: Point[], b: Point[]): boolean {
  for (const corners of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const edge = { x: corners[i + 1].x - corners[i].x, y: corners[i + 1].y - corners[i].y }
      const length = Math.hypot(edge.x, edge.y) || 1
      const axis = { x: -edge.y / length, y: edge.x / length }
      const extentA = projectExtent(a, axis)
      const extentB = projectExtent(b, axis)
      const overlap = Math.min(extentA.max, extentB.max) - Math.max(extentA.min, extentB.min)
      if (overlap <= OVERLAP_TOLERANCE) return false
    }
  }
  return true
}

/**
 * Встраиваемая техника живёт внутри других блоков (мойка в тумбе, панель в столешнице),
 * поэтому в пересечениях не участвует.
 */
export function isBuiltIn(item: FurnitureItem): boolean {
  return BUILT_IN_TYPES.includes(item.type)
}

/** Мешают ли два блока друг другу: пересекаются и по высоте, и в плане. */
export function blocksOverlap(a: FurnitureItem, b: FurnitureItem): boolean {
  if (a.id === b.id || isBuiltIn(a) || isBuiltIn(b)) return false
  if (!overlapsByHeight(a, b)) return false
  return footprintsOverlap(itemFootprint(a), itemFootprint(b))
}
