import { describe, expect, it } from 'vitest'
import type { FurnitureItem } from '@/domain/model'
import { cabinetFrontLayout, findBlindCornerJoints } from '@/domain/assemblies/cabinetJoints'
import { makeFurniture } from '../../../fixtures'

function host(patch: Partial<FurnitureItem> = {}): FurnitureItem {
  return makeFurniture('cabinet', {
    id: 'host',
    position: { x: 600, y: 280 },
    params: { ...makeFurniture().params, width: 1200 },
    ...patch,
  })
}

function rightBlocker(patch: Partial<FurnitureItem> = {}): FurnitureItem {
  return makeFurniture('cabinet', {
    id: 'blocker',
    position: { x: 920, y: 860 },
    rotation: 90,
    ...patch,
  })
}

describe('blind cabinet corners', () => {
  it('turns the covered end into a blank panel without relying on walls', () => {
    const first = host()
    const second = rightBlocker()

    expect(findBlindCornerJoints([first, second])).toEqual([
      {
        hostId: 'host',
        blockerId: 'blocker',
        side: 'right',
        blockerSide: 'left',
        blocked: { start: 40, end: 600 },
        open: { start: -600, end: 40 },
      },
    ])
    expect(cabinetFrontLayout(first, [first, second])).toEqual({
      visible: [{ start: -600, end: 40 }],
      blocked: [{ start: 40, end: 600 }],
      innerSeams: [{ x: 40, side: 'right' }],
      plinth: { start: -600, end: 600 },
      outerSeams: ['right'],
    })
    expect(cabinetFrontLayout(second, [first, second])).toMatchObject({
      blocked: [],
      innerSeams: [],
      plinth: { start: -351, end: 300 },
      outerSeams: [],
    })
    expect(findBlindCornerJoints([first, first, second])).toHaveLength(1)
  })

  it('supports a mirrored left corner', () => {
    const first = host()
    const second = rightBlocker({ position: { x: 280, y: 860 }, rotation: 270 })
    expect(findBlindCornerJoints([first, second])).toEqual([
      expect.objectContaining({
        hostId: 'host',
        blockerId: 'blocker',
        side: 'left',
        blockerSide: 'right',
        blocked: { start: -600, end: -40 },
        open: { start: -40, end: 600 },
      }),
    ])
    expect(cabinetFrontLayout(first, [first, second]).plinth).toEqual({ start: -600, end: 600 })
    expect(cabinetFrontLayout(first, [first, second]).outerSeams).toEqual(['left'])
    expect(cabinetFrontLayout(first, [first, second]).innerSeams).toEqual([{ x: -40, side: 'left' }])
    expect(cabinetFrontLayout(second, [first, second]).plinth).toEqual({ start: -300, end: 351 })
  })

  it('restores the ordinary facade after the blocker is moved or removed', () => {
    const first = host()
    const moved = rightBlocker({ position: { x: 920, y: 900 } })
    expect(cabinetFrontLayout(first, [first, moved]).blocked).toEqual([])
    expect(cabinetFrontLayout(first, [first])).toEqual({
      visible: [{ start: -600, end: 600 }],
      blocked: [],
      innerSeams: [],
      plinth: { start: -600, end: 600 },
      outerSeams: [],
    })
  })

  it('rejects overlap, non-perpendicular contact, uneven tops and middle blockage', () => {
    const first = host()
    const variants = [
      rightBlocker({ position: { x: 920, y: 850 } }),
      rightBlocker({ rotation: 80 }),
      rightBlocker({ params: { ...makeFurniture().params, height: 900 } }),
      rightBlocker({ position: { x: 600, y: 860 } }),
    ]
    for (const second of variants) expect(findBlindCornerJoints([first, second])).toEqual([])
  })

  it('does not create an unusably narrow accessible facade', () => {
    const first = host({ params: { ...makeFurniture().params, width: 800 } })
    const second = rightBlocker({ position: { x: 520, y: 860 } })
    expect(findBlindCornerJoints([first, second])).toEqual([])
  })

  it('does not guess a facade when both ends are blocked', () => {
    const first = host()
    const right = rightBlocker({ id: 'right' })
    const left = rightBlocker({ id: 'left', position: { x: 280, y: 860 }, rotation: 270 })
    expect(findBlindCornerJoints([first, right, left]).filter((joint) => joint.hostId === first.id)).toEqual([])
  })
})
