import { expect, it } from 'vitest'
import { innerFacadeSeamFootprint } from '@/features/scene-3d/geometry/cabinetSeams'

it('fills the right inner seam without overlapping the facade', () => {
  expect(innerFacadeSeamFootprint({ x: 40, side: 'right' }, 560, 18)).toEqual({
    x: { start: 37, end: 40 },
    z: { start: 262, end: 283 },
  })
})

it('fills the left inner seam without overlapping the facade', () => {
  expect(innerFacadeSeamFootprint({ x: -40, side: 'left' }, 560, 18)).toEqual({
    x: { start: -40, end: -37 },
    z: { start: 262, end: 283 },
  })
})
