import { describe, expect, it } from 'vitest'
import { blocksOverlap, footprintsOverlap } from '../../../../src/shared/utils/collision'
import { makeFurniture } from '../../../fixtures'

describe('footprintsOverlap', () => {
  it('detects overlap between convex polygons', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const triangle = [
      { x: 80, y: 20 },
      { x: 160, y: 50 },
      { x: 80, y: 80 },
    ]
    expect(footprintsOverlap(square, triangle)).toBe(true)
  })

  it('treats exact contact as non-overlap', () => {
    const left = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const right = left.map((point) => ({ x: point.x + 100, y: point.y }))
    expect(footprintsOverlap(left, right)).toBe(false)
  })
})

describe('blocksOverlap', () => {
  it('requires overlap both in plan and by height', () => {
    const lower = makeFurniture('cabinet', { id: 'lower' })
    const upper = makeFurniture('cabinet', { id: 'upper', elevation: 1200 })
    expect(blocksOverlap(lower, upper)).toBe(false)
    expect(blocksOverlap(lower, { ...upper, elevation: 700 })).toBe(true)
  })

  it('ignores built-in appliances', () => {
    const cabinet = makeFurniture('cabinet')
    const sink = makeFurniture('sink')
    expect(blocksOverlap(cabinet, sink)).toBe(false)
  })
})
