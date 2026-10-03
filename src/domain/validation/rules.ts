import { BUILT_IN_FLANGE, type FurnitureItem, type Opening, type Room, type Utility } from '@/domain/model'
import { blocksOverlap, footprintsOverlap, isBuiltIn } from '@/domain/geometry/collision'
import { itemFootprint, roomPolygon, wallFootprint } from '@/domain/geometry/geometry'
import { bounds, pointInPolygon, rotatePoint } from '@/shared/lib/geometry2d'
import { clampOffset, openingObstaclePolygons } from '@/domain/room/openings'
import { utilityPoint } from '@/domain/room/utilities'
import { wallAnchorIsValid } from '@/domain/placement/wallAnchors'
import { placementObstacles } from './obstacles'
import { applianceUtilityTypes, cabinetAppliance, hobConnectionFor, hobUtilityType } from '@/domain/appliances/profiles'
import { matchPowerOutlets, rearServiceDistance, type PowerDemand } from './power'
import { hostCabinet } from '@/domain/assemblies/hostedBuiltIns'

/** Свободная зона вокруг вывода, необходимая для доступа и подключения. */
export const UTILITY_CLEARANCE = 150
/** Только эскизный радиус до задней зоны плиты, не допустимая длина газового шланга. */
export const GAS_REACH_MM = 800

export function isItemInsideRoom(item: FurnitureItem, room: Room): boolean {
  const polygon = roomPolygon(room.walls)
  if (polygon.length < 3) return true
  return itemFootprint(item).every((corner) => pointInPolygon(corner, polygon))
}

export function collides(item: FurnitureItem, others: FurnitureItem[]): boolean {
  return others.some((other) => blocksOverlap(item, other))
}

/** Перегородка и внешний периметр одинаково физически препятствуют мебели. */
export function blocksWall(item: FurnitureItem, room: Room): boolean {
  if (isBuiltIn(item) || item.elevation >= room.wallHeight) return false
  const footprint = itemFootprint(item)
  return room.walls.some((wall) => footprintsOverlap(footprint, wallFootprint(wall)))
}

/**
 * Блок перекрывает проём, если он стоит перед ним и их высоты пересекаются.
 * Так одним правилом закрываются оба случая: пенал перед окном и тумба в дверях.
 * Напольная тумба под окном с подоконником 900 проверку проходит — и правильно.
 */
export function blocksOpening(item: FurnitureItem, room: Room): boolean {
  if (isBuiltIn(item)) return false
  const footprint = itemFootprint(item)
  const top = item.elevation + item.params.height
  const polygon = roomPolygon(room.walls)
  const roomCenter = bounds(polygon).center

  return room.openings.some((opening) => {
    const openingTop = opening.sill + opening.height
    if (item.elevation >= openingTop || opening.sill >= top) return false
    return openingObstaclePolygons(opening, room, roomCenter).some((area) => footprintsOverlap(footprint, area))
  })
}

function touchesUtility(item: FurnitureItem, utility: Utility, room: Room): boolean {
  const top = item.elevation + item.params.height
  if (utility.height < item.elevation || utility.height > top) return false
  const footprint = itemFootprint(item)
  const { x, y } = utilityPoint(utility, room)
  const clearance = UTILITY_CLEARANCE
  const area = [
    { x: x - clearance, y: y - clearance },
    { x: x + clearance, y: y - clearance },
    { x: x + clearance, y: y + clearance },
    { x: x - clearance, y: y + clearance },
  ]
  return footprintsOverlap(footprint, area)
}

function gasNearHost(item: FurnitureItem, utility: Utility, room: Room): boolean {
  if (utility.type !== 'gas') return false
  const distance = rearServiceDistance(item, utility, room)
  return distance !== null && distance <= GAS_REACH_MM
}

function hostsBuiltIn(item: FurnitureItem, type: 'sink' | 'hob', furniture: FurnitureItem[]): boolean {
  if (item.type !== 'cabinet') return false
  return furniture.some((candidate) => candidate.type === type && hostCabinet(candidate, furniture)?.id === item.id)
}

function utilityServesBuiltIn(utility: Utility, furniture: FurnitureItem[], room: Room): boolean {
  if (utility.type !== 'water' && utility.type !== 'sewer' && utility.type !== 'gas') return false
  return furniture.some((builtIn) => {
    if (builtIn.type === 'sink' && utility.type === 'gas') return false
    if (builtIn.type === 'hob' && (utility.type !== 'gas' || hobUtilityType(hobConnectionFor(builtIn)) !== 'gas'))
      return false
    if (builtIn.type !== 'sink' && builtIn.type !== 'hob') return false
    const host = hostCabinet(builtIn, furniture)
    return (
      host !== null && (utility.type === 'gas' ? gasNearHost(host, utility, room) : touchesUtility(host, utility, room))
    )
  })
}

function powerDemands(furniture: FurnitureItem[]): PowerDemand[] {
  const demands: PowerDemand[] = []
  for (const item of furniture) {
    if (item.type === 'hob' && hobUtilityType(hobConnectionFor(item)) === 'power') {
      const host = hostCabinet(item, furniture)
      if (host) demands.push({ key: `hob:${item.id}`, item: host })
    }
    const appliance = item.type === 'fridge' ? 'fridge' : cabinetAppliance(item)
    if (appliance && applianceUtilityTypes(appliance).includes('power')) {
      demands.push({ key: `appliance:${item.id}`, item })
    }
  }
  return demands
}

/** Схематическая зона перед открываемым прибором, не точная дуга конкретной дверцы. */
function applianceFrontZone(item: FurnitureItem, reach: number) {
  const halfWidth = Math.max(50, item.params.width / 2 - 30)
  const front = item.params.depth / 2 + 10
  return [
    { x: -halfWidth, y: front },
    { x: halfWidth, y: front },
    { x: halfWidth, y: front + reach },
    { x: -halfWidth, y: front + reach },
  ].map((local) =>
    rotatePoint({ x: item.position.x + local.x, y: item.position.y + local.y }, item.position, item.rotation),
  )
}

function applianceAccessWarning(item: FurnitureItem, furniture: FurnitureItem[], room: Room): string | null {
  const appliance = item.type === 'fridge' ? 'fridge' : cabinetAppliance(item)
  if (!appliance) return null
  const zone = applianceFrontZone(item, appliance === 'oven' ? 500 : 600)
  const polygon = roomPolygon(room.walls)
  const outside = polygon.length >= 3 && zone.some((corner) => !pointInPolygon(corner, polygon))
  const wall = room.walls.some((candidate) => footprintsOverlap(zone, wallFootprint(candidate)))
  const furnitureBlock = furniture.some(
    (candidate) =>
      candidate.id !== item.id &&
      !isBuiltIn(candidate) &&
      candidate.elevation < item.elevation + item.params.height &&
      item.elevation < candidate.elevation + candidate.params.height &&
      footprintsOverlap(zone, itemFootprint(candidate)),
  )
  if (!outside && !wall && !furnitureBlock) return null
  return appliance === 'fridge'
    ? 'Перед холодильником недостаточно свободного места для открывания'
    : appliance === 'dishwasher'
      ? 'Перед посудомойкой недостаточно свободного места для открывания'
      : 'Перед духовкой недостаточно свободного места для открывания'
}

export type UtilityAssessment = { connected: Utility[]; warnings: string[] }

/**
 * Вывод — точка на эскизе, а не сертификат возможности подключения. Совместимость
 * зависит от типа прибора. Отсутствие нужного вывода даёт предупреждение, но не
 * превращает корректную геометрию мебели в красную ошибку.
 */
export function assessUtilities(item: FurnitureItem, furniture: FurnitureItem[], room: Room): UtilityAssessment {
  const powerConnections = matchPowerOutlets(powerDemands(furniture), room)
  if (isBuiltIn(item)) {
    const host = hostCabinet(item, furniture)
    if (!host)
      return {
        connected: [],
        warnings: [
          item.type === 'sink' ? 'Для мойки не найдена опорная база' : 'Для кухонной плиты не найдена опорная база',
        ],
      }
    if (item.type === 'hob') {
      const required = hobUtilityType(hobConnectionFor(item))
      if (!required) return { connected: [], warnings: ['Тип подключения кухонной плиты не указан'] }
      const power = powerConnections.get(`hob:${item.id}`)
      if (required === 'power' && power) return { connected: [power], warnings: [] }
      const gas = room.utilities.find((utility) => gasNearHost(host, utility, room))
      if (required === 'gas' && gas) return { connected: [gas], warnings: [] }
      return {
        connected: [],
        warnings: [
          required === 'gas'
            ? 'Для газовой плиты не найден вывод газа'
            : 'Для электрической плиты не найден вывод питания',
        ],
      }
    }
    return { connected: [], warnings: [] }
  }

  const covered = room.utilities.filter((utility) => touchesUtility(item, utility, room))
  const hasSink = hostsBuiltIn(item, 'sink', furniture)
  const hasHob = hostsBuiltIn(item, 'hob', furniture)
  const hob = hasHob
    ? furniture.find((candidate) => candidate.type === 'hob' && hostCabinet(candidate, furniture)?.id === item.id)
    : undefined
  const hobConnection = hob ? hobConnectionFor(hob) : 'unknown'
  const hobRequiredUtility = hobUtilityType(hobConnection)
  const hobPower = hob ? powerConnections.get(`hob:${hob.id}`) : undefined
  const hobGas =
    hobRequiredUtility === 'gas' ? room.utilities.find((utility) => gasNearHost(item, utility, room)) : undefined
  const appliance = item.type === 'fridge' ? 'fridge' : cabinetAppliance(item)
  const connected: Utility[] = []
  const warnings: string[] = []

  // Вода и канализация посудомойки могут быть за соседней базой с мойкой.
  // Радиус означает лишь «вывод рядом»; реальную трассу нужно проверить на объекте.
  const nearby = (utility: Utility) => {
    if (touchesUtility(item, utility, room)) return true
    if (appliance !== 'dishwasher' || (utility.type !== 'water' && utility.type !== 'sewer')) return false
    if (utility.height > item.elevation + item.params.height) return false
    const point = utilityPoint(utility, room)
    return Math.hypot(point.x - item.position.x, point.y - item.position.y) <= 900
  }
  const usable = room.utilities.filter(nearby)

  for (const utility of covered) {
    if ((utility.type === 'water' || utility.type === 'sewer') && hasSink) {
      connected.push(utility)
    } else if (utility.type === 'gas' && hobRequiredUtility === 'gas' && utility.id === hobGas?.id) {
      connected.push(utility)
    } else if ((utility.type === 'water' || utility.type === 'sewer') && appliance === 'dishwasher') {
      connected.push(utility)
    } else if (utility.type === 'water') {
      if (!utilityServesBuiltIn(utility, furniture, room)) warnings.push('Вывод воды находится в базе без мойки')
    } else if (utility.type === 'sewer') {
      if (!utilityServesBuiltIn(utility, furniture, room)) warnings.push('Канализация находится в базе без мойки')
    } else if (utility.type === 'gas') {
      if (!utilityServesBuiltIn(utility, furniture, room))
        warnings.push('Газовый вывод находится в базе без кухонной плиты')
    } else if (utility.type === 'vent') {
      warnings.push('Блок перекрывает доступ к вентиляции')
    }
    // Розетка за мебелью сама по себе допустима: требования зависят от типа техники.
  }

  if (hasSink) {
    if (!covered.some((utility) => utility.type === 'water')) warnings.push('Для мойки не найден вывод воды')
    if (!covered.some((utility) => utility.type === 'sewer')) warnings.push('Для мойки не найдена канализация')
  }

  if (hasHob) {
    if (hobConnection === 'unknown') warnings.push('Тип подключения кухонной плиты не указан')
    else if (hobRequiredUtility === 'power' && hobPower) connected.push(hobPower)
    else if (hobRequiredUtility === 'gas' && hobGas && !connected.some((utility) => utility.id === hobGas.id))
      connected.push(hobGas)
    else if (hobRequiredUtility && (hobRequiredUtility === 'power' || !hobGas))
      warnings.push(
        hobRequiredUtility === 'gas'
          ? 'Для газовой плиты не найден вывод газа'
          : 'Для электрической плиты не найден вывод питания',
      )
  }

  if (appliance) {
    for (const type of applianceUtilityTypes(appliance)) {
      if (type === 'power') {
        const power = powerConnections.get(`appliance:${item.id}`)
        if (power && !connected.some((utility) => utility.id === power.id)) connected.push(power)
        else if (!power) {
          const name = appliance === 'oven' ? 'духовки' : appliance === 'dishwasher' ? 'посудомойки' : 'холодильника'
          warnings.push(`Для ${name} не найдена доступная розетка у задней части техники`)
        }
        continue
      }
      if (usable.some((utility) => utility.type === type)) {
        const adjacent = usable.find((utility) => utility.type === type)
        if (adjacent && !connected.some((utility) => utility.id === adjacent.id)) connected.push(adjacent)
      } else {
        const name = appliance === 'oven' ? 'духовки' : appliance === 'dishwasher' ? 'посудомойки' : 'холодильника'
        const nearbySuffix = appliance === 'dishwasher' ? ' поблизости' : ''
        if (type === 'sewer') warnings.push(`Для ${name} не найдена канализация${nearbySuffix}`)
        else warnings.push(`Для ${name} не найден вывод воды${nearbySuffix}`)
      }
    }
  }
  if (appliance === 'oven' && hasSink) warnings.push('Духовка и мойка не могут занимать одну базу')
  if (appliance === 'dishwasher' && hasSink) warnings.push('Посудомойка и мойка не могут занимать одну базу')
  if (appliance === 'dishwasher' && hasHob) warnings.push('Совместимость кухонной плиты над посудомойкой не проверена')
  if (appliance === 'oven' && hobRequiredUtility === 'power')
    warnings.push('Для духовки и плиты проверьте мощность и требования к отдельным линиям питания')
  const accessWarning = applianceAccessWarning(item, furniture, room)
  if (accessWarning) warnings.push(accessWarning)

  return { connected, warnings }
}

export function warningItemIds(furniture: FurnitureItem[], room: Room): Set<string> {
  return new Set(
    furniture.filter((item) => assessUtilities(item, furniture, room).warnings.length > 0).map((item) => item.id),
  )
}

export function connectedUtilityIds(furniture: FurnitureItem[], room: Room): Set<string> {
  const connected = new Set<string>()
  for (const item of furniture) {
    for (const utility of assessUtilities(item, furniture, room).connected) connected.add(utility.id)
  }
  return connected
}

/** Пересекаются ли два проёма на одной стене одновременно по ширине и высоте. */
export function openingsOverlap(a: Opening, b: Opening, room: Room): boolean {
  if (a.id === b.id || a.wallId !== b.wallId) return false
  const wall = room.walls.find((candidate) => candidate.id === a.wallId)
  if (!wall) return false
  const aOffset = clampOffset(a, wall)
  const bOffset = clampOffset(b, wall)
  const overlapAlongWall =
    aOffset - a.width / 2 < bOffset + b.width / 2 && bOffset - b.width / 2 < aOffset + a.width / 2
  const overlapByHeight = a.sill < b.sill + b.height && b.sill < a.sill + a.height
  return overlapAlongWall && overlapByHeight
}

export function invalidOpeningIds(room: Room): Set<string> {
  const invalid = new Set<string>()
  for (const opening of room.openings) {
    if (room.openings.some((other) => openingsOverlap(opening, other, room))) invalid.add(opening.id)
  }
  return invalid
}

export function invalidUtilityIds(room: Room): Set<string> {
  const polygon = roomPolygon(room.walls)
  if (polygon.length < 3) return new Set()
  return new Set(
    room.utilities
      .filter((utility: Utility) => !pointInPolygon(utilityPoint(utility, room), polygon))
      .map((utility) => utility.id),
  )
}

/** Блоки, нарушающие хотя бы одно правило расстановки. */
export function invalidItemIds(furniture: FurnitureItem[], room: Room): Set<string> {
  return new Set(
    furniture.filter((item) => itemPlacementIssues(item, furniture, room).length > 0).map((item) => item.id),
  )
}

export type PlacementIssue = {
  code: 'outside' | 'anchor' | 'wall' | 'furniture' | 'opening' | 'door-swing' | 'appliance'
  message: string
  targetId?: string
}

export function itemPlacementIssues(item: FurnitureItem, furniture: FurnitureItem[], room: Room): PlacementIssue[] {
  const footprint = itemFootprint(item)
  const issues: PlacementIssue[] = placementObstacles(item, room, furniture)
    .filter((obstacle) => footprintsOverlap(footprint, obstacle.polygon))
    .map((obstacle) => ({ code: obstacle.kind, message: obstacle.message, targetId: obstacle.id }))
  if (!isItemInsideRoom(item, room)) issues.push({ code: 'outside', message: 'Блок выходит за контур помещения' })
  if (!wallAnchorIsValid(item, room))
    issues.push({ code: 'anchor', message: 'Блок не помещается на свободном участке привязанной стены' })
  if (isBuiltIn(item)) {
    const host = hostCabinet(item, furniture)
    if (!host) issues.push({ code: 'appliance', message: 'Врезному прибору нужна опорная база' })
    const appliance = host ? cabinetAppliance(host) : null
    if (
      (item.type === 'sink' && appliance) ||
      (item.type === 'hob' && (appliance === 'dishwasher' || appliance === 'fridge'))
    )
      issues.push({ code: 'appliance', message: 'Врезной прибор несовместим с назначением базы', targetId: host?.id })
    const flange = BUILT_IN_FLANGE[item.type]
    const surface = item.elevation + item.params.height - flange
    if (
      !furniture.some(
        (candidate) =>
          candidate.type === 'countertop' &&
          Math.abs(candidate.elevation + candidate.params.height - surface) <= 15 &&
          footprintsOverlap(footprint, itemFootprint(candidate)),
      )
    )
      issues.push({ code: 'appliance', message: 'Врезному прибору нужна столешница' })
    if (
      furniture.some(
        (candidate) =>
          candidate.id !== item.id &&
          isBuiltIn(candidate) &&
          item.elevation < candidate.elevation + candidate.params.height &&
          candidate.elevation < item.elevation + item.params.height &&
          footprintsOverlap(footprint, itemFootprint(candidate)),
      )
    )
      issues.push({ code: 'appliance', message: 'Врезные приборы занимают одно место' })
  }
  return issues
}
