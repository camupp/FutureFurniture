import { describe, expect, it } from 'vitest'
import {
  expandFurnitureGroups,
  furnitureInMarquee,
  pruneFurnitureGroups,
  translateFurniture,
  withHostedBuiltIns,
} from '@/domain/assemblies/furnitureGroups'
import { makeFurniture, makeRoom } from '../../../fixtures'

describe('furniture groups', () => {
  it('selects rotated footprints touched by a marquee and ignores generated countertops', () => {
    const cabinet = makeFurniture('cabinet', { id: 'cabinet', position: { x: 1000, y: 1000 }, rotation: 90 })
    const top = makeFurniture('countertop', {
      id: 'top',
      position: { x: 1000, y: 1000 },
      autoCountertop: { groupId: 'top-group', supportIds: ['cabinet'], frontOverhang: 20 },
    })
    expect(furnitureInMarquee([cabinet, top], { x: 700, y: 900 }, { x: 740, y: 1100 })).toEqual(['cabinet'])
    expect(furnitureInMarquee([cabinet, top], { x: 1500, y: 1500 }, { x: 1600, y: 1600 })).toEqual([])
  })

  it('expands selection to the complete group and removes orphan group IDs', () => {
    const first = makeFurniture('cabinet', { id: 'first', groupId: 'joined' })
    const second = makeFurniture('cabinet', { id: 'second', groupId: 'joined' })
    expect(expandFurnitureGroups([first, second], ['first'])).toEqual(['first', 'second'])
    expect(pruneFurnitureGroups([first])[0]?.groupId).toBeUndefined()
  })

  it('moves a built-in appliance with its supporting cabinet', () => {
    const cabinet = makeFurniture('cabinet', { id: 'cabinet', position: { x: 1000, y: 1000 } })
    const sink = makeFurniture('sink', { id: 'sink', position: { x: 1000, y: 1000 } })
    expect(withHostedBuiltIns([cabinet, sink], ['cabinet'])).toEqual(['cabinet', 'sink'])
  })

  it('recognizes a hob resting on a countertop above its base, not the upper cabinet', () => {
    const lower = makeFurniture('cabinet', { id: 'lower', position: { x: 1000, y: 1000 } })
    const upper = makeFurniture('cabinet', { id: 'upper', position: lower.position, elevation: 1400 })
    const hob = makeFurniture('hob', { id: 'hob', position: lower.position, elevation: 820 })
    expect(withHostedBuiltIns([lower, upper, hob], ['lower'])).toEqual(['lower', 'hob'])
    expect(withHostedBuiltIns([lower, upper, hob], ['upper'])).toEqual(['upper'])
  })

  it('keeps a wall anchor on parallel translation and drops it on perpendicular translation', () => {
    const cabinet = makeFurniture('cabinet', {
      id: 'cabinet',
      position: { x: 1000, y: 330 },
      wallAnchor: { wallId: 'top', side: 'left', offset: 1000, distance: 0 },
    })
    const room = makeRoom()
    expect(translateFurniture([cabinet], ['cabinet'], { x: 200, y: 0 }, room)[0]).toMatchObject({
      position: { x: 1200, y: 330 },
      wallAnchor: { offset: 1200 },
    })
    expect(translateFurniture([cabinet], ['cabinet'], { x: 0, y: 200 }, room)[0]?.wallAnchor).toBeUndefined()
  })
})
