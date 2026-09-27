import type { CabinetFrontLayout, CabinetFrontInterval } from '@/domain/assemblies/cabinetJoints'
import { CABINET_FACADE_GAP } from '@/domain/assemblies/cabinetFaces'

export { CABINET_FACADE_GAP }

/** Узкая вставка занимает только зазор между фасадами, не пересекая ни одну дверцу. */
export function innerFacadeSeamFootprint(
  seam: CabinetFrontLayout['innerSeams'][number],
  depth: number,
  facadeThickness: number,
): { x: CabinetFrontInterval; z: CabinetFrontInterval } {
  const front = depth / 2
  return {
    x:
      seam.side === 'right'
        ? { start: seam.x - CABINET_FACADE_GAP, end: seam.x }
        : { start: seam.x, end: seam.x + CABINET_FACADE_GAP },
    z: { start: front - facadeThickness, end: front + CABINET_FACADE_GAP },
  }
}
