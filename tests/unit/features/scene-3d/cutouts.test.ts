import { expect, it } from 'vitest'
import { calculateCutouts } from '@/features/scene-3d/geometry/cutouts'
import { makeFurniture } from '../../../fixtures'

it('calculates the same cutout in local coordinates after rotating the assembly', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const countertop = makeFurniture('countertop', { rotation, elevation: 820 })
    const sink = makeFurniture('sink', { rotation })
    const [hole] = calculateCutouts(countertop, [sink])
    expect(hole.x).toBeCloseTo(0)
    expect(hole.z).toBeCloseTo(0)
    expect(hole.width).toBeCloseTo(530)
    expect(hole.depth).toBeCloseTo(430)
  }
})

it('does not cut unrelated objects or equipment outside the support', () => {
  const cabinet = makeFurniture()
  const farSink = makeFurniture('sink', { position: { x: 5000, y: 5000 } })
  expect(calculateCutouts(cabinet, [farSink, makeFurniture()])).toEqual([])
  expect(calculateCutouts(makeFurniture('sink'), [makeFurniture('hob')])).toEqual([])
})

it('does not cut an upper cabinet or a countertop at another height', () => {
  const sink = makeFurniture('sink')
  const upper = makeFurniture('cabinet', { elevation: 1400 })
  const wrongTop = makeFurniture('countertop', { elevation: 1100 })
  expect(calculateCutouts(upper, [sink])).toEqual([])
  expect(calculateCutouts(wrongTop, [sink])).toEqual([])
})
