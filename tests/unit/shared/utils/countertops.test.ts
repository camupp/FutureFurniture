import { describe, expect, it, vi } from 'vitest'
import type { FurnitureItem, Room } from '../../../../src/shared/types'
import { findCountertopRow, isCountertopSupport, syncAutoCountertops } from '../../../../src/shared/utils/countertops'
import { makeFurniture, makeRoom } from '../../../fixtures'

function cabinet(id: string, offset: number, patch: Partial<FurnitureItem> = {}): FurnitureItem {
  return makeFurniture('cabinet', {
    id,
    wallAnchor: { wallId: 'top', side: 'left', offset, distance: 0 },
    ...patch,
  })
}

function automatic(id: string, supportIds: string[], patch: Partial<FurnitureItem> = {}): FurnitureItem {
  return makeFurniture('countertop', { id, autoCountertop: { supportIds, frontOverhang: 40 }, ...patch })
}

function tops(items: FurnitureItem[]): FurnitureItem[] {
  return items.filter((item) => item.type === 'countertop')
}

describe('countertop rows', () => {
  it('accepts floor bases but not upper cabinets, tall units, appliances or detached blocks', () => {
    expect(isCountertopSupport(cabinet('base', 350))).toBe(true)
    expect(isCountertopSupport(cabinet('upper', 350, { elevation: 1400 }))).toBe(false)
    expect(isCountertopSupport(cabinet('tall', 350, { params: { ...makeFurniture().params, height: 2100 } }))).toBe(
      false,
    )
    expect(isCountertopSupport(cabinet('hob', 350, { type: 'hob' }))).toBe(false)
    expect(isCountertopSupport(makeFurniture())).toBe(false)
  })

  it('finds a touching row in wall order regardless of array order or the chosen cabinet', () => {
    const a = cabinet('a', 350)
    const b = cabinet('b', 950)
    const c = cabinet('c', 1550)
    for (const id of ['a', 'b', 'c']) {
      expect(findCountertopRow(id, [c, a, b], makeRoom()).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    }
  })

  it('allows the placement tolerance but does not bridge a real gap or an overlap', () => {
    const a = cabinet('a', 350)
    expect(findCountertopRow('a', [a, cabinet('b', 952)], makeRoom())).toHaveLength(2)
    expect(findCountertopRow('a', [a, cabinet('b', 948)], makeRoom())).toHaveLength(2)
    expect(findCountertopRow('a', [a, cabinet('b', 953)], makeRoom()).map((item) => item.id)).toEqual(['a'])
    expect(findCountertopRow('a', [a, cabinet('b', 947)], makeRoom()).map((item) => item.id)).toEqual(['a'])
  })

  it('does not connect contained or duplicate cabinets', () => {
    const wide = cabinet('wide', 650, { params: { ...makeFurniture().params, width: 1200 } })
    const inside = cabinet('inside', 650)
    const duplicate = cabinet('duplicate', 650)
    const items = [wide, inside, duplicate]
    expect(findCountertopRow('wide', items, makeRoom())).toEqual([wide])
    expect(findCountertopRow('inside', items, makeRoom())).toEqual([inside])
    expect(findCountertopRow('duplicate', items, makeRoom())).toEqual([duplicate])
  })

  it('separates walls, sides, back offsets and different support levels', () => {
    const a = cabinet('a', 350)
    const variants = [
      cabinet('other-wall', 950, { wallAnchor: { wallId: 'bottom', side: 'left', offset: 950, distance: 0 } }),
      cabinet('other-side', 950, { wallAnchor: { wallId: 'top', side: 'right', offset: 950, distance: 0 } }),
      cabinet('forward', 950, { wallAnchor: { wallId: 'top', side: 'left', offset: 950, distance: 20 } }),
      cabinet('higher', 950, { params: { ...a.params, height: 900 } }),
    ]
    for (const other of variants) {
      expect(findCountertopRow('a', [a, other], makeRoom())).toEqual([a])
    }
  })

  it('does not accumulate level tolerance along an increasingly uneven row', () => {
    const a = cabinet('a', 350)
    const b = cabinet('b', 950, { params: { ...a.params, height: 822 } })
    const c = cabinet('c', 1550, { params: { ...a.params, height: 824 } })
    expect(findCountertopRow('a', [a, b, c], makeRoom()).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('requires an existing nonzero wall and eligible selected support', () => {
    const a = cabinet('a', 350)
    expect(findCountertopRow('a', [a], makeRoom({ walls: [] }))).toEqual([])
    expect(findCountertopRow('missing', [a], makeRoom())).toEqual([])
    const emptyWallRoom = makeRoom({
      walls: [{ id: 'top', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, thickness: 100 }],
    })
    expect(findCountertopRow('a', [a], emptyWallRoom)).toEqual([])
  })
})

describe('automatic countertops', () => {
  it('expands to new adjacent bases and fits the full row with front overhang', () => {
    const a = cabinet('a', 350)
    const b = cabinet('b', 950)
    const upper = cabinet('upper', 350, { elevation: 1400 })
    const existing = automatic('top-1', ['a'])
    const newId = vi.fn(() => 'unused')
    const result = syncAutoCountertops([a, b, upper, existing], makeRoom(), newId)
    expect(tops(result)).toHaveLength(1)
    expect(tops(result)[0]).toMatchObject({
      id: 'top-1',
      elevation: 820,
      rotation: 0,
      position: { x: 650, y: 350 },
      params: { width: 1200, height: 38, depth: 600 },
      wallAnchor: { wallId: 'top', side: 'left', offset: 650, distance: 0 },
      autoCountertop: { supportIds: ['a', 'b'], frontOverhang: 40 },
    })
    expect(newId).not.toHaveBeenCalled()
    expect(result).toContain(upper)
  })

  it('splits a gap and preserves the pieces without ID churn on subsequent syncs', () => {
    const a = cabinet('a', 350)
    const b = cabinet('b', 1300)
    const newId = vi.fn(() => 'top-2')
    const result = syncAutoCountertops([a, b, automatic('top-1', ['a', 'b'])], makeRoom(), newId)
    expect(tops(result).map((item) => [item.id, item.params.width, item.autoCountertop!.supportIds])).toEqual([
      ['top-1', 600, ['a']],
      ['top-2', 600, ['b']],
    ])
    expect(syncAutoCountertops(result, makeRoom(), newId)).toEqual(result)
    expect(newId).toHaveBeenCalledTimes(1)
  })

  it('merges auto tops when rows meet, using the first existing finish and thickness', () => {
    const a = cabinet('a', 350)
    const b = cabinet('b', 950)
    const first = automatic('top-1', ['a'], {
      params: { ...makeFurniture('countertop').params, height: 50, facadeColor: '#123456' },
    })
    const second = automatic('top-2', ['b'])
    const newId = vi.fn(() => 'unused')
    const result = syncAutoCountertops([a, b, first, second], makeRoom(), newId)
    expect(tops(result)).toHaveLength(1)
    expect(tops(result)[0]).toMatchObject({
      id: 'top-1',
      params: { width: 1200, height: 50, facadeColor: '#123456' },
      autoCountertop: { supportIds: ['a', 'b'] },
    })
    expect(newId).not.toHaveBeenCalled()
  })

  it('shrinks after deleting one support and removes the top once all supports are gone', () => {
    const b = cabinet('b', 950)
    const existing = automatic('top-1', ['a', 'b'])
    const result = syncAutoCountertops([b, existing], makeRoom(), () => 'unused')
    expect(tops(result)[0]).toMatchObject({
      id: 'top-1',
      params: { width: 600 },
      wallAnchor: { offset: 950 },
      autoCountertop: { supportIds: ['b'] },
    })
    expect(syncAutoCountertops([existing], makeRoom(), () => 'unused')).toEqual([])
  })

  it('keeps ownership when a support moves to another wall and follows reversed wall coordinates', () => {
    const room = makeRoom({
      walls: [{ id: 'reversed', start: { x: 3600, y: 0 }, end: { x: 0, y: 0 }, thickness: 100 }],
    })
    const a = cabinet('a', 1000, {
      wallAnchor: { wallId: 'reversed', side: 'right', offset: 1000, distance: 20 },
    })
    const b = cabinet('b', 1600, {
      wallAnchor: { wallId: 'reversed', side: 'right', offset: 1600, distance: 20 },
    })
    const [result] = tops(syncAutoCountertops([a, b, automatic('top-1', ['a'])], room, () => 'unused'))
    expect(result!.position.x).toBeCloseTo(2300)
    expect(result!.position.y).toBeCloseTo(370)
    expect(result!.rotation).toBe(0)
    expect(result!.wallAnchor).toEqual({ wallId: 'reversed', side: 'right', offset: 1300, distance: 20 })
  })

  it('uses the deepest support and respects the minimum countertop depth', () => {
    const a = cabinet('a', 350, { params: { ...makeFurniture().params, depth: 600 } })
    const b = cabinet('b', 950, { params: { ...makeFurniture().params, depth: 700 } })
    const result = tops(syncAutoCountertops([a, b, automatic('top-1', ['a'])], makeRoom(), () => 'unused'))[0]!
    expect(result.params.depth).toBe(740)
    expect(result.position.y).toBe(420)

    const shallow = cabinet('shallow', 350, { params: { ...a.params, depth: 300 } })
    const shallowTop = tops(
      syncAutoCountertops([shallow, automatic('top-2', ['shallow'])], makeRoom(), () => 'unused'),
    )[0]!
    expect(shallowTop.params.depth).toBe(400)
  })

  it('splits a long row at cabinet boundaries without truncating its coverage', () => {
    const room: Room = makeRoom({
      walls: [{ id: 'top', start: { x: 0, y: 0 }, end: { x: 7000, y: 0 }, thickness: 100 }],
    })
    const bases = Array.from({ length: 5 }, (_, index) =>
      cabinet(`base-${index}`, 650 + index * 1200, { params: { ...makeFurniture().params, width: 1200 } }),
    )
    const newId = vi.fn(() => 'top-2')
    const result = syncAutoCountertops([...bases, automatic('top-1', ['base-0'])], room, newId)
    expect(tops(result).map((item) => item.params.width)).toEqual([3600, 2400])
    expect(tops(result).map((item) => item.autoCountertop!.supportIds)).toEqual([
      ['base-0', 'base-1', 'base-2'],
      ['base-3', 'base-4'],
    ])
    expect(tops(result).reduce((total, item) => total + item.params.width, 0)).toBe(6000)
    expect(syncAutoCountertops(result, room, newId)).toEqual(result)
    expect(newId).toHaveBeenCalledTimes(1)
  })

  it('leaves manual countertops unchanged, including when an automatic one is removed', () => {
    const manual = makeFurniture('countertop', { id: 'manual' })
    const furniture = [manual]
    expect(syncAutoCountertops(furniture, makeRoom(), () => 'unused')).toBe(furniture)
    expect(syncAutoCountertops([manual, automatic('auto', ['deleted'])], makeRoom(), () => 'unused')).toEqual([manual])
  })

  it('preserves independent finish and thickness edits on segments of a long row', () => {
    const room = makeRoom({
      walls: [{ id: 'top', start: { x: 0, y: 0 }, end: { x: 7000, y: 0 }, thickness: 100 }],
    })
    const bases = Array.from({ length: 5 }, (_, index) =>
      cabinet(`base-${index}`, 650 + index * 1200, { params: { ...makeFurniture().params, width: 1200 } }),
    )
    const first = automatic('top-1', ['base-0', 'base-1', 'base-2'])
    const second = automatic('top-2', ['base-3', 'base-4'], {
      params: { ...makeFurniture('countertop').params, height: 50, facadeColor: '#123456' },
      autoCountertop: { supportIds: ['base-3', 'base-4'], frontOverhang: 60 },
    })
    const newId = vi.fn(() => 'unused')
    const result = syncAutoCountertops([...bases, first, second], room, newId)
    expect(tops(result)[1]).toMatchObject({
      id: 'top-2',
      params: { width: 2400, height: 50, facadeColor: '#123456', depth: 620 },
      autoCountertop: { frontOverhang: 60 },
    })
    expect(syncAutoCountertops(result, room, newId)).toEqual(result)
    expect(newId).not.toHaveBeenCalled()
  })

  it('does not mutate the supports or the original automatic countertop', () => {
    const bases = [cabinet('a', 350), cabinet('b', 950)]
    const existing = automatic('top-1', ['a'])
    const before = structuredClone([...bases, existing])
    syncAutoCountertops([...bases, existing], makeRoom(), () => 'unused')
    expect([...bases, existing]).toEqual(before)
  })
})
