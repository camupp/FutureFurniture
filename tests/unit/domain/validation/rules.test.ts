import { describe, expect, it } from 'vitest'
import {
  assessUtilities,
  blocksOpening,
  blocksWall,
  connectedUtilityIds,
  invalidOpeningIds,
  invalidUtilityIds,
  itemPlacementIssues,
  warningItemIds,
} from '@/domain/validation/rules'
import { makeFurniture, makeOpening, makePartitionedRoom, makeRoom, makeUtility } from '../../../fixtures'

describe('wall collisions', () => {
  it('reports an unanchored cabinet crossing a partition', () => {
    const cabinet = makeFurniture('cabinet', { position: { x: 1700, y: 2200 } })
    expect(blocksWall(cabinet, makePartitionedRoom())).toBe(true)
  })

  it('does not report a cabinet beside a partition', () => {
    const cabinet = makeFurniture('cabinet', { position: { x: 1320, y: 2200 } })
    expect(blocksWall(cabinet, makePartitionedRoom())).toBe(false)
  })
})

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

  it('does not blame an adjacent storage base for a sink outlet at their boundary', () => {
    const storage = makeFurniture('cabinet', { id: 'storage', position: { x: 1200, y: 330 } })
    const sinkHost = makeFurniture('cabinet', { id: 'sink-host', position: { x: 1800, y: 330 } })
    const builtIn = makeFurniture('sink', { id: 'sink', position: sinkHost.position })
    const sharedWater = makeUtility('water', { point: { x: 1500, y: 330 }, height: 500 })
    const furniture = [storage, sinkHost, builtIn]
    expect(assessUtilities(storage, furniture, makeRoom({ utilities: [sharedWater] })).warnings).not.toContain(
      'Вывод воды находится в базе без мойки',
    )
    expect(assessUtilities(sinkHost, furniture, makeRoom({ utilities: [sharedWater] })).connected).toContain(
      sharedWater,
    )
  })

  it('connects gas to a cabinet hosting a hob', () => {
    const hob = makeFurniture('hob', { id: 'hob', hobConnection: 'gas' })
    const gas = makeUtility('gas')
    const furniture = [lower, hob]
    expect(assessUtilities(lower, furniture, makeRoom({ utilities: [gas] })).connected).toEqual([gas])
    expect(assessUtilities(hob, furniture, makeRoom({ utilities: [gas] })).connected).toEqual([gas])
  })

  it('allows a wall gas outlet above the base when it reaches the rear service zone', () => {
    const gas = makeUtility('gas', { mount: { kind: 'wall', wallId: 'top', offset: 1800 }, height: 900 })
    const hob = makeFurniture('hob', { id: 'hob', hobConnection: 'gas' })
    const furniture = [lower, hob]
    const room = makeRoom({ utilities: [gas] })
    expect(assessUtilities(hob, furniture, room).connected).toEqual([gas])
    expect(assessUtilities(lower, furniture, room).connected).toEqual([gas])
  })

  it('does not infer a gas connection for a panel with unknown fuel', () => {
    const hob = makeFurniture('hob', { id: 'hob' })
    const gas = makeUtility('gas')
    const result = assessUtilities(lower, [lower, hob], makeRoom({ utilities: [gas] }))
    expect(result.connected).toEqual([])
    expect(result.warnings).toContain('Тип подключения кухонной плиты не указан')
  })

  it('requires the matching output for gas and electric panels', () => {
    const gasHob = makeFurniture('hob', { hobConnection: 'gas' })
    const electricHob = makeFurniture('hob', { hobConnection: 'induction' })
    const power = makeUtility('power')
    expect(assessUtilities(lower, [lower, gasHob], makeRoom()).warnings).toContain(
      'Для газовой плиты не найден вывод газа',
    )
    expect(assessUtilities(lower, [lower, electricHob], makeRoom()).warnings).toContain(
      'Для электрической плиты не найден вывод питания',
    )
    expect(assessUtilities(lower, [lower, electricHob], makeRoom({ utilities: [power] })).connected).toContain(power)
  })

  it('checks oven, dishwasher and fridge outputs without calling them installation-certified', () => {
    const oven = makeFurniture('cabinet', {
      cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
    })
    const dishwasher = makeFurniture('cabinet', {
      cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'dishwasher' },
    })
    const fridge = makeFurniture('fridge')
    expect(assessUtilities(oven, [oven], makeRoom()).warnings).toContain(
      'Для духовки не найдена доступная розетка у задней части техники',
    )
    expect(assessUtilities(dishwasher, [dishwasher], makeRoom()).warnings).toEqual(
      expect.arrayContaining([
        'Для посудомойки не найден вывод воды поблизости',
        'Для посудомойки не найдена канализация поблизости',
        'Для посудомойки не найдена доступная розетка у задней части техники',
      ]),
    )
    expect(assessUtilities(fridge, [fridge], makeRoom()).warnings).toContain(
      'Для холодильника не найдена доступная розетка у задней части техники',
    )
  })

  it('matches a wall socket near the rear of an appliance even when it is above the cabinet', () => {
    const oven = makeFurniture('cabinet', {
      cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
    })
    const power = makeUtility('power', {
      mount: { kind: 'wall', wallId: 'top', offset: 1800 },
      height: 1100,
    })
    expect(assessUtilities(oven, [oven], makeRoom({ utilities: [power] })).connected).toEqual([power])
  })

  it('shares a double socket between two appliances but not a single socket', () => {
    const oven = (id: string, x: number) =>
      makeFurniture('cabinet', {
        id,
        position: { x, y: 330 },
        cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
      })
    const first = oven('oven-a', 1500)
    const second = oven('oven-b', 2100)
    const power = makeUtility('power', { mount: { kind: 'wall', wallId: 'top', offset: 1800 }, height: 1100 })
    const furniture = [first, second]
    const doubleRoom = makeRoom({ utilities: [power] })
    expect(assessUtilities(first, furniture, doubleRoom).connected).toContain(power)
    expect(assessUtilities(second, furniture, doubleRoom).connected).toContain(power)

    const singleRoom = makeRoom({ utilities: [{ ...power, socketCount: 1 }] })
    const assessments = furniture.map((item) => assessUtilities(item, furniture, singleRoom))
    expect(assessments.filter((result) => result.connected.length > 0)).toHaveLength(1)
    expect(assessments.filter((result) => result.warnings.some((warning) => warning.includes('розетка')))).toHaveLength(
      1,
    )
  })

  it('uses the project reach setting and never matches a socket across a partition', () => {
    const oven = makeFurniture('cabinet', {
      cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
    })
    const power = makeUtility('power', { mount: { kind: 'wall', wallId: 'top', offset: 900 }, height: 1100 })
    expect(assessUtilities(oven, [oven], makeRoom({ utilities: [power] })).connected).toContain(power)
    expect(assessUtilities(oven, [oven], makeRoom({ powerReachMm: 700, utilities: [power] })).connected).toEqual([])

    const onOtherSide = makeFurniture('cabinet', {
      id: 'partition-oven',
      position: { x: 1370, y: 2200 },
      rotation: 90,
      wallAnchor: { wallId: 'inner-vertical', side: 'right', offset: 800, distance: 0 },
      cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
    })
    const partitionPower = makeUtility('power', {
      mount: { kind: 'wall', wallId: 'inner-vertical', offset: 800 },
      height: 500,
    })
    const partitioned = makePartitionedRoom()
    partitioned.utilities = [partitionPower]
    expect(assessUtilities(onOtherSide, [onOtherSide], partitioned).connected).toEqual([])

    const onNearSide = {
      ...onOtherSide,
      id: 'near-side-oven',
      position: { x: 2030, y: 2200 },
      rotation: 270,
      wallAnchor: { wallId: 'inner-vertical', side: 'left' as const, offset: 800, distance: 0 },
    }
    expect(assessUtilities(onNearSide, [onNearSide], partitioned).connected).toContain(partitionPower)
    const floorPower = makeUtility('power', { point: { x: 1200, y: 2200 } })
    const acrossPartition = makePartitionedRoom()
    acrossPartition.utilities = [floorPower]
    expect(assessUtilities(onNearSide, [onNearSide], acrossPartition).connected).toEqual([])
  })

  it('accepts a nearby wall socket on every side of the room', () => {
    const placements = [
      { wallId: 'top', offset: 1800, position: { x: 1800, y: 330 }, rotation: 0 },
      { wallId: 'right', offset: 1500, position: { x: 3270, y: 1500 }, rotation: 90 },
      { wallId: 'bottom', offset: 1800, position: { x: 1800, y: 2670 }, rotation: 180 },
      { wallId: 'left', offset: 1500, position: { x: 330, y: 1500 }, rotation: 270 },
    ]
    for (const { wallId, offset, position, rotation } of placements) {
      const oven = makeFurniture('cabinet', {
        position,
        rotation,
        cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
      })
      const power = makeUtility('power', { mount: { kind: 'wall', wallId, offset }, height: 600 })
      expect(assessUtilities(oven, [oven], makeRoom({ utilities: [power] })).connected).toContain(power)
    }
  })

  it('does not mistake two sockets for verified oven and hob power circuits', () => {
    const oven = makeFurniture('cabinet', {
      cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
    })
    const hob = makeFurniture('hob', { hobConnection: 'induction' })
    const power = makeUtility('power', { mount: { kind: 'wall', wallId: 'top', offset: 1800 }, height: 1100 })
    const result = assessUtilities(oven, [oven, hob], makeRoom({ utilities: [power] }))
    expect(result.connected).toEqual([power])
    expect(result.warnings).toContain('Для духовки и плиты проверьте мощность и требования к отдельным линиям питания')
    expect(result.warnings).not.toContain('Для электрической плиты не найден вывод питания')
  })

  it('recognizes sink outputs behind a neighboring base for a dishwasher sketch', () => {
    const dishwasher = makeFurniture('cabinet', {
      position: { x: 2400, y: 330 },
      cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'dishwasher' },
    })
    const power = makeUtility('power', { point: { x: 2400, y: 330 } })
    const room = makeRoom({ utilities: [water, sewer, power] })
    const result = assessUtilities(dishwasher, [dishwasher], room)
    expect(result.warnings).toEqual([])
    expect(result.connected.map((utility) => utility.type)).toEqual(['water', 'sewer', 'power'])
  })

  it('warns when an appliance door has no usable space in front', () => {
    const fridge = makeFurniture('fridge', { position: { x: 1800, y: 900 } })
    const blocker = makeFurniture('cabinet', { position: { x: 1800, y: 1700 } })
    expect(assessUtilities(fridge, [fridge, blocker], makeRoom()).warnings).toContain(
      'Перед холодильником недостаточно свободного места для открывания',
    )
  })

  it('does not require a connection for a power outlet', () => {
    const power = makeUtility('power')
    expect(assessUtilities(lower, [lower], makeRoom({ utilities: [power] }))).toEqual({
      connected: [],
      warnings: [],
    })
  })
})

describe('built-in appliance fit', () => {
  it('requires a base and countertop at the same working surface', () => {
    const base = makeFurniture('cabinet')
    const hob = makeFurniture('hob', { elevation: 818 })
    const top = makeFurniture('countertop', {
      elevation: 820,
      params: { ...makeFurniture('countertop').params, width: 600 },
    })
    expect(itemPlacementIssues(hob, [hob], makeRoom()).map((issue) => issue.message)).toEqual(
      expect.arrayContaining(['Врезному прибору нужна опорная база', 'Врезному прибору нужна столешница']),
    )
    expect(itemPlacementIssues(hob, [base, hob, top], makeRoom())).toEqual([])
  })

  it('rejects a sink over an oven and overlapping sink/hob cutouts', () => {
    const oven = makeFurniture('cabinet', {
      cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
    })
    const sink = makeFurniture('sink')
    const hob = makeFurniture('hob', { elevation: 818 })
    const top = makeFurniture('countertop', {
      elevation: 820,
      params: { ...makeFurniture('countertop').params, width: 600 },
    })
    const issues = itemPlacementIssues(sink, [oven, sink, hob, top], makeRoom())
    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining(['Врезной прибор несовместим с назначением базы', 'Врезные приборы занимают одно место']),
    )
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
