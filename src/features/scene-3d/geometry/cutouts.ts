import type { FurnitureItem } from '@/domain/model'
import { isBuiltIn } from '@/domain/geometry/collision'
import { itemFootprint } from '@/domain/geometry/geometry'
import { bounds, rotatePoint } from '@/shared/lib/geometry2d'
import { type Cutout } from '../blocks/slab'

const CUTOUT_MARGIN = 35

/**
 * Вырезы в столешнице под врезную технику, стоящую над ней.
 * Считаются в локальной системе столешницы: x — вдоль ширины, z — вдоль глубины.
 */
export function calculateCutouts(item: FurnitureItem, others: FurnitureItem[]): Cutout[] {
  if (item.type !== 'countertop' && item.type !== 'cabinet') return []
  const halfWidth = item.params.width / 2
  const halfDepth = item.params.depth / 2

  return others.flatMap((other) => {
    if (!isBuiltIn(other)) return []
    const localCorners = itemFootprint(other).map((corner) => rotatePoint(corner, item.position, -item.rotation))
    const box = bounds(localCorners)
    const x = box.center.x - item.position.x
    const z = box.center.y - item.position.y
    const width = box.width - CUTOUT_MARGIN * 2
    const depth = box.height - CUTOUT_MARGIN * 2
    if (width <= 0 || depth <= 0) return []
    // Вырез имеет смысл только если техника действительно лежит на этой плите.
    if (Math.abs(x) + width / 2 > halfWidth || Math.abs(z) + depth / 2 > halfDepth) return []
    return [{ x, z, width, depth }]
  })
}
