import { describe, expect, it } from 'vitest'
import { snapElevation } from '@/domain/placement/elevation'
import { makeFurniture } from '../../../fixtures'

describe('snapElevation', () => {
  it('puts a countertop on top of a base cabinet', () => {
    const base = makeFurniture('cabinet')
    const countertop = makeFurniture('countertop', { elevation: 760 })
    expect(snapElevation(countertop, 760, [base])).toBe(820)
  })

  it('fits a sink flange into a countertop', () => {
    const countertop = makeFurniture('countertop', { elevation: 820 })
    const sink = makeFurniture('sink', { elevation: 650 })
    expect(snapElevation(sink, 650, [countertop])).toBe(692)
  })

  it('does not snap a built-in sink to a bare cabinet', () => {
    const cabinet = makeFurniture('cabinet')
    const sink = makeFurniture('sink', { elevation: 650 })
    expect(snapElevation(sink, 650, [cabinet])).toBe(650)
  })
})
