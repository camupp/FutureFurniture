import { BUILT_IN_FLANGE, type FurnitureItem } from '@/domain/model'
import { footprintsOverlap, isBuiltIn } from '@/domain/geometry/collision'
import { itemFootprint } from '@/domain/geometry/geometry'
import { isCountertopSupport } from './countertops'

/**
 * The cabinet ends below the countertop, so a correctly installed hob can
 * touch its top without overlapping its volume. Match the supporting surface,
 * not just the two 3D bounding boxes.
 */
export function supportsBuiltIn(cabinet: FurnitureItem, builtIn: FurnitureItem): boolean {
  if (!isBuiltIn(builtIn) || !isCountertopSupport(cabinet)) return false
  const cabinetTop = cabinet.elevation + cabinet.params.height
  const surface = builtIn.elevation + builtIn.params.height - BUILT_IN_FLANGE[builtIn.type]
  return (
    surface >= cabinetTop - 50 &&
    surface <= cabinetTop + 100 &&
    footprintsOverlap(itemFootprint(cabinet), itemFootprint(builtIn))
  )
}

export function hostCabinet(builtIn: FurnitureItem, furniture: FurnitureItem[]): FurnitureItem | null {
  if (!isBuiltIn(builtIn)) return null
  const surface = builtIn.elevation + builtIn.params.height - BUILT_IN_FLANGE[builtIn.type]
  return (
    furniture
      .filter((candidate) => supportsBuiltIn(candidate, builtIn))
      .sort(
        (a, b) =>
          Math.abs(a.elevation + a.params.height - surface) - Math.abs(b.elevation + b.params.height - surface) ||
          Math.hypot(a.position.x - builtIn.position.x, a.position.y - builtIn.position.y) -
            Math.hypot(b.position.x - builtIn.position.x, b.position.y - builtIn.position.y) ||
          a.id.localeCompare(b.id),
      )[0] ?? null
  )
}
