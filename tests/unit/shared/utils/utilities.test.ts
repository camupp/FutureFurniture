import { describe, expect, it } from 'vitest'
import {
  moveUtilityToPoint,
  normalizeUtility,
  utilityPoint,
  wallUtilityFrame,
} from '../../../../src/shared/utils/utilities'
import { makeRoom, makeUtility } from '../../../fixtures'

describe('wall utilities', () => {
  it('derives position from wall offset and inward normal', () => {
    const room = makeRoom()
    const utility = makeUtility('water', {
      height: 500,
      mount: { kind: 'wall', wallId: 'top', offset: 1200 },
    })
    expect(utilityPoint(utility, room)).toEqual({ x: 1200, y: 74 })
    expect(wallUtilityFrame(utility, room)?.inward.x).toBeCloseTo(0)
    expect(wallUtilityFrame(utility, room)?.inward.y).toBeCloseTo(1)
  })

  it('projects movement back onto the same wall', () => {
    const room = makeRoom()
    const utility = makeUtility('water', {
      height: 500,
      mount: { kind: 'wall', wallId: 'top', offset: 1200 },
    })
    const moved = moveUtilityToPoint(utility, { x: 2456, y: 900 }, room)
    expect(moved.mount).toEqual({ kind: 'wall', wallId: 'top', offset: 2456 })
    expect(utilityPoint(moved, room)).toEqual({ x: 2456, y: 74 })
  })

  it('clamps wall offset and height during normalization', () => {
    const room = makeRoom()
    const utility = makeUtility('gas', {
      height: 5000,
      mount: { kind: 'wall', wallId: 'top', offset: 9999 },
    })
    const normalized = normalizeUtility(utility, room)
    expect(normalized?.mount).toEqual({ kind: 'wall', wallId: 'top', offset: 3600 })
    expect(normalized?.height).toBe(2700)
  })

  it('drops a wall utility whose wall no longer exists', () => {
    const utility = makeUtility('water', { mount: { kind: 'wall', wallId: 'missing', offset: 500 } })
    expect(normalizeUtility(utility, makeRoom())).toBeNull()
  })
})

describe('floor utilities', () => {
  it('moves freely on the grid-ready plan and stays at floor level', () => {
    const room = makeRoom()
    const utility = makeUtility('sewer', { height: 300 })
    const moved = moveUtilityToPoint(utility, { x: 123.4, y: 567.8 }, room)
    expect(moved.point).toEqual({ x: 123, y: 568 })
    expect(normalizeUtility(moved, room)?.height).toBe(0)
  })
})
