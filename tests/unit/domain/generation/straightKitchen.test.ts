import { describe, expect, it } from 'vitest'
import { generateStraightKitchen } from '@/domain/generation/straightKitchen'
import { itemPlacementIssues } from '@/domain/validation/rules'
import { makeFurniture, makeOpening, makeRoom, makeUtility } from '../../../fixtures'

const request = { wallId: 'top', includeSink: true, includeHob: true }

describe('straight kitchen generator', () => {
  it('makes a deterministic, valid sketch without mutating the measured room', () => {
    const room = makeRoom()
    const before = JSON.stringify(room)
    const first = generateStraightKitchen(room, [], request)
    const second = generateStraightKitchen(room, [], request)
    expect(first).toEqual(second)
    expect(first.proposal).not.toBeNull()
    expect(first.proposal!.items.filter((item) => item.type === 'sink')).toHaveLength(1)
    expect(first.proposal!.items.filter((item) => item.type === 'hob')).toHaveLength(1)
    expect(first.proposal!.items.some((item) => item.autoCountertop)).toBe(true)
    expect(first.proposal!.moduleCount).toBeGreaterThanOrEqual(3)
    expect(first.proposal!.items.flatMap((item) => itemPlacementIssues(item, first.proposal!.items, room))).toEqual([])
    expect(JSON.stringify(room)).toBe(before)
  })

  it('prefers placing the sink where water and sewer can serve its base', () => {
    const room = makeRoom({
      utilities: [
        makeUtility('water', { point: { x: 650, y: 330 }, height: 500 }),
        makeUtility('sewer', { point: { x: 650, y: 330 }, height: 300 }),
      ],
    })
    const result = generateStraightKitchen(room, [], request)
    expect(result.proposal).not.toBeNull()
    expect(result.diagnostics.map((item) => item.message).join(' ')).not.toContain('Для мойки не найден')
  })

  it('separates cooking and washing zones when marked gas and water are far apart', () => {
    const room = makeRoom({
      utilities: [
        makeUtility('gas', { mount: { kind: 'wall', wallId: 'top', offset: 450 }, height: 900 }),
        makeUtility('water', { point: { x: 3150, y: 330 }, height: 500 }),
        makeUtility('sewer', { point: { x: 3150, y: 330 }, height: 300 }),
      ],
    })
    const result = generateStraightKitchen(room, [], { ...request, hobConnection: 'gas' })
    const proposal = result.proposal!
    expect(proposal).not.toBeNull()
    expect(proposal.utilityFit).toEqual({ matched: 3, marked: 3, unmarked: 0 })
    const hob = proposal.items.find((item) => item.type === 'hob')!
    const sink = proposal.items.find((item) => item.type === 'sink')!
    expect(Math.abs(hob.position.x - 450)).toBeLessThanOrEqual(300)
    expect(Math.abs(sink.position.x - 3150)).toBeLessThanOrEqual(300)
    expect(Math.abs(hob.position.x - sink.position.x)).toBeGreaterThan(1200)
    expect(result.diagnostics.map((item) => item.message).join(' ')).not.toContain('не найден вывод газа')
  })

  it('states when a marked gas outlet on another wall cannot serve the chosen row', () => {
    const room = makeRoom({
      utilities: [
        makeUtility('gas', { mount: { kind: 'wall', wallId: 'right', offset: 1500 }, height: 900 }),
        makeUtility('water', { point: { x: 3000, y: 330 }, height: 500 }),
        makeUtility('sewer', { point: { x: 3000, y: 330 }, height: 300 }),
      ],
    })
    const result = generateStraightKitchen(room, [], { ...request, hobConnection: 'gas' })
    expect(result.proposal?.utilityFit).toEqual({ matched: 2, marked: 3, unmarked: 0 })
    expect(result.diagnostics.map((item) => item.message).join(' ')).toContain('Не все подключения удалось совместить')
  })

  it('counts socket capacity when a hob and oven share a base', () => {
    const power = makeUtility('power', { point: { x: 1800, y: 330 }, height: 500, socketCount: 2 })
    const requirements = { ...request, includeSink: false, includeOven: true, hobConnection: 'induction' as const }
    const double = generateStraightKitchen(makeRoom({ utilities: [power] }), [], requirements)
    expect(double.proposal?.utilityFit).toEqual({ matched: 2, marked: 2, unmarked: 0 })

    const single = generateStraightKitchen(makeRoom({ utilities: [{ ...power, socketCount: 1 }] }), [], requirements)
    expect(single.proposal?.utilityFit).toEqual({ matched: 1, marked: 2, unmarked: 0 })
    expect(single.diagnostics.map((item) => item.message).join(' ')).toContain('Не все подключения удалось совместить')
  })

  it('chooses the dishwasher side that reaches power while keeping it next to the sink', () => {
    const room = makeRoom({
      utilities: [
        makeUtility('water', { point: { x: 2900, y: 330 }, height: 500 }),
        makeUtility('sewer', { point: { x: 2900, y: 330 }, height: 300 }),
        makeUtility('power', { point: { x: 1850, y: 330 }, height: 500 }),
      ],
    })
    const result = generateStraightKitchen(room, [], {
      ...request,
      includeHob: false,
      includeDishwasher: true,
    })
    const proposal = result.proposal!
    expect(proposal).not.toBeNull()
    const sink = proposal.items.find((item) => item.type === 'sink')!
    const dishwasher = proposal.items.find(
      (item) =>
        item.type === 'cabinet' &&
        item.cabinetModule?.familyId === 'base-storage' &&
        item.cabinetModule.role === 'dishwasher',
    )!
    expect(dishwasher.position.x).toBeLessThan(sink.position.x)
    expect(Math.abs(dishwasher.position.x - sink.position.x)).toBe(600)
    expect(proposal.utilityFit).toEqual({ matched: 5, marked: 5, unmarked: 0 })
  })

  it('uses wall-local coordinates on each side of a rectangular room', () => {
    const room = makeRoom()
    for (const wallId of ['right', 'bottom', 'left']) {
      const result = generateStraightKitchen(room, [], { ...request, wallId })
      expect(result.proposal, wallId).not.toBeNull()
      expect(
        result
          .proposal!.items.filter((item) => item.type === 'cabinet')
          .every((item) => item.wallAnchor?.wallId === wallId),
      ).toBe(true)
      expect(result.proposal!.items.flatMap((item) => itemPlacementIssues(item, result.proposal!.items, room))).toEqual(
        [],
      )
    }
  })

  it('explains an impossible short wall and a blocked run', () => {
    const short = makeRoom()
    short.walls = short.walls.map((wall) => ({
      ...wall,
      start: { ...wall.start, x: wall.start.x === 3600 ? 1500 : wall.start.x },
      end: { ...wall.end, x: wall.end.x === 3600 ? 1500 : wall.end.x },
    }))
    expect(generateStraightKitchen(short, [], request).diagnostics[0]?.code).toBe('short-wall')

    const blocked = makeRoom({ openings: [makeOpening('door', { offset: 1800 })] })
    expect(generateStraightKitchen(blocked, [], request).diagnostics[0]?.code).toBe('no-space')
  })

  it('never overlaps existing furniture and reports no space when it splits the run', () => {
    const room = makeRoom()
    const existing = makeFurniture('cabinet', {
      wallAnchor: { wallId: 'top', side: 'left', offset: 1800, distance: 0 },
      position: { x: 1800, y: 330 },
    })
    expect(generateStraightKitchen(room, [existing], request).diagnostics[0]?.code).toBe('no-space')
  })

  it('treats the requested preparation width as a hard requirement', () => {
    const room = makeRoom()
    const result = generateStraightKitchen(room, [], { ...request, minPrepWidth: 1200 })
    expect(result.proposal).not.toBeNull()
    expect(result.proposal!.items.filter((item) => item.cabinetModule?.facade === 'three-drawers')).toHaveLength(2)
    const shorter = makeRoom()
    shorter.walls = shorter.walls.map((wall) => ({
      ...wall,
      start: { ...wall.start, x: wall.start.x === 3600 ? 2100 : wall.start.x },
      end: { ...wall.end, x: wall.end.x === 3600 ? 2100 : wall.end.x },
    }))
    expect(generateStraightKitchen(shorter, [], { ...request, minPrepWidth: 1200 }).diagnostics[0]?.code).toBe(
      'short-wall',
    )
  })

  it('places an oven under the hob, dishwasher beside sink and fridge outside the worktop', () => {
    const room = makeRoom()
    const result = generateStraightKitchen(room, [], {
      ...request,
      hobConnection: 'induction',
      includeOven: true,
      includeDishwasher: true,
      includeFridge: true,
    })
    expect(result.proposal).not.toBeNull()
    const items = result.proposal!.items
    const hob = items.find((item) => item.type === 'hob')!
    expect(hob.hobConnection).toBe('induction')
    expect(
      items.find((item) => item.type === 'cabinet' && item.position.x === hob.position.x)?.cabinetModule,
    ).toMatchObject({ role: 'oven' })
    const dishwasher = items.find(
      (item) =>
        item.cabinetModule?.familyId === 'base-storage' &&
        'role' in item.cabinetModule &&
        item.cabinetModule.role === 'dishwasher',
    )!
    const sink = items.find((item) => item.type === 'sink')!
    expect(Math.abs(dishwasher.position.x - sink.position.x)).toBe(600)
    const fridge = items.find((item) => item.type === 'fridge')!
    expect(
      items.filter((item) => item.autoCountertop).every((item) => !item.autoCountertop?.supportIds.includes(fridge.id)),
    ).toBe(true)
    expect(items.flatMap((item) => itemPlacementIssues(item, items, room))).toEqual([])
    expect(result.diagnostics.map((item) => item.message).join(' ')).not.toContain('места для открывания')
  })

  it('refuses a dishwasher without a sink in this template', () => {
    expect(
      generateStraightKitchen(makeRoom(), [], { ...request, includeSink: false, includeDishwasher: true })
        .diagnostics[0]?.code,
    ).toBe('invalid-requirements')
  })
})
