import { describe, expect, it } from 'vitest'
import {
  assessUtilities,
  blocksOpening,
  connectedUtilityIds,
  invalidOpeningIds,
  invalidUtilityIds,
  warningItemIds,
} from '@/domain/validation/rules'
import { makeFurniture, makeOpening, makeRoom, makeUtility } from '../../../fixtures'

describe('opening validation', () => {
  it('checks plan and height together for a window', () => {
    const room = makeRoom({ openings: [makeOpening('window')] })
    const base = makeFurniture('cabinet')
    const tall = makeFurniture('cabinet', { params: { ...base.params, height: 2100 } })
    expect(blocksOpening(base, room)).toBe(false)
    expect(blocksOpening(tall, room)).toBe(true)
  })

  it('marks both overlapping openings on one wall', () => {
    const first = makeOpening('window', { id: 'first' })
    const second = makeOpening('window', { id: 'second', offset: 2000 })
    expect(invalidOpeningIds(makeRoom({ openings: [first, second] }))).toEqual(new Set(['first', 'second']))
  })
})

describe('utility compatibility', () => {
  const lower = makeFurniture('cabinet', { id: 'lower' })
  const upper = makeFurniture('cabinet', { id: 'upper', elevation: 1200 })
  const sink = makeFurniture('sink', { id: 'sink' })
  const water = makeUtility('water')
  const sewer = makeUtility('sewer')

  it('connects water and sewer only to the lower sink host', () => {
    const furniture = [lower, upper, sink]
    const room = makeRoom({ utilities: [water, sewer] })
    const lowerAssessment = assessUtilities(lower, furniture, room)
    const upperAssessment = assessUtilities(upper, furniture, room)

    expect(lowerAssessment.connected.map((utility) => utility.id)).toEqual(['water-1', 'sewer-1'])
    expect(lowerAssessment.warnings).toEqual([])
    expect(upperAssessment).toEqual({ connected: [], warnings: [] })
    expect(warningItemIds(furniture, room)).not.toContain('upper')
    expect(connectedUtilityIds(furniture, room)).toEqual(new Set(['water-1', 'sewer-1']))
  })

  it('warns the sink host about a missing sewer connection', () => {
    const furniture = [lower, sink]
    const result = assessUtilities(lower, furniture, makeRoom({ utilities: [water] }))
    expect(result.connected).toEqual([water])
    expect(result.warnings).toContain('Для мойки не найдена канализация')
  })

  it('warns when water is hidden in a cabinet without a sink', () => {
    const result = assessUtilities(lower, [lower], makeRoom({ utilities: [water] }))
    expect(result.warnings).toContain('Вывод воды находится в базе без мойки')
  })

  it('connects gas to a cabinet hosting a hob', () => {
    const hob = makeFurniture('hob', { id: 'hob' })
    const gas = makeUtility('gas')
    const furniture = [lower, hob]
    expect(assessUtilities(lower, furniture, makeRoom({ utilities: [gas] })).connected).toEqual([gas])
  })

  it('does not require a connection for a power outlet', () => {
    const power = makeUtility('power')
    expect(assessUtilities(lower, [lower], makeRoom({ utilities: [power] }))).toEqual({
      connected: [],
      warnings: [],
    })
  })
})

describe('utility bounds', () => {
  it('marks a floor utility outside the room', () => {
    const outside = makeUtility('sewer', { point: { x: -500, y: -500 } })
    expect(invalidUtilityIds(makeRoom({ utilities: [outside] }))).toEqual(new Set(['sewer-1']))
  })

  it('uses the derived wall position for bounds validation', () => {
    const wallUtility = makeUtility('water', {
      height: 500,
      mount: { kind: 'wall', wallId: 'top', offset: 1800 },
    })
    expect(invalidUtilityIds(makeRoom({ utilities: [wallUtility] }))).toEqual(new Set())
  })
})
