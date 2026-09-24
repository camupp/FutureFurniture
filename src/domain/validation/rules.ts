import type { FurnitureItem, Opening, Room, Utility } from '@/domain/model'
import { blocksOverlap, footprintsOverlap, isBuiltIn } from '@/domain/geometry/collision'
import { itemFootprint, roomPolygon, wallFootprint } from '@/domain/geometry/geometry'
import { bounds, pointInPolygon } from '@/shared/lib/geometry2d'
import { clampOffset, openingObstaclePolygons } from '@/domain/room/openings'
import { utilityPoint } from '@/domain/room/utilities'
import { wallAnchorIsValid } from '@/domain/placement/wallAnchors'
import { placementObstacles } from './obstacles'

/** Свободная зона вокруг вывода, необходимая для доступа и подключения. */
export const UTILITY_CLEARANCE = 150

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

/**
 * Возвращает единственную несущую базу для врезного блока. Совпадения только на плане
 * недостаточно: нижний и навесной шкаф могут иметь одинаковые X/Y. Поэтому кандидат
 * обязан пересекаться с техникой и по высоте, а из нескольких выбирается ближайший
 * к центру техники.
 */
function hostCabinet(builtIn: FurnitureItem, furniture: FurnitureItem[]): FurnitureItem | null {
  const builtInBottom = builtIn.elevation
  const builtInTop = builtIn.elevation + builtIn.params.height
  const candidates = furniture.filter((candidate) => {
    if (candidate.type !== 'cabinet') return false
    const cabinetTop = candidate.elevation + candidate.params.height
    const overlapsByHeight = candidate.elevation < builtInTop && builtInBottom < cabinetTop
    return overlapsByHeight && footprintsOverlap(itemFootprint(candidate), itemFootprint(builtIn))
  })

  return (
    candidates.sort((a, b) => {
      const aTopDistance = Math.abs(a.elevation + a.params.height - builtInTop)
      const bTopDistance = Math.abs(b.elevation + b.params.height - builtInTop)
      if (aTopDistance !== bTopDistance) return aTopDistance - bTopDistance
      const aDistance = Math.hypot(a.position.x - builtIn.position.x, a.position.y - builtIn.position.y)
      const bDistance = Math.hypot(b.position.x - builtIn.position.x, b.position.y - builtIn.position.y)
      return aDistance - bDistance
    })[0] ?? null
  )
}

function hostsBuiltIn(item: FurnitureItem, type: 'sink' | 'hob', furniture: FurnitureItem[]): boolean {
  if (item.type !== 'cabinet') return false
  return furniture.some((candidate) => candidate.type === type && hostCabinet(candidate, furniture)?.id === item.id)
}

export type UtilityAssessment = { connected: Utility[]; warnings: string[] }

/**
 * Инженерный вывод — точка подключения, а не препятствие. База с мойкой принимает
 * воду/канализацию, база с панелью — газ. Несвязанный или недостающий вывод даёт
 * предупреждение, но не превращает корректную геометрию мебели в красную ошибку.
 */
export function assessUtilities(item: FurnitureItem, furniture: FurnitureItem[], room: Room): UtilityAssessment {
  if (isBuiltIn(item)) return { connected: [], warnings: [] }

  const covered = room.utilities.filter((utility) => touchesUtility(item, utility, room))
  const hasSink = hostsBuiltIn(item, 'sink', furniture)
  const hasHob = hostsBuiltIn(item, 'hob', furniture)
  const connected: Utility[] = []
  const warnings: string[] = []

  for (const utility of covered) {
    if ((utility.type === 'water' || utility.type === 'sewer') && hasSink) {
      connected.push(utility)
    } else if (utility.type === 'gas' && hasHob) {
      connected.push(utility)
    } else if (utility.type === 'water') {
      warnings.push('Вывод воды находится в базе без мойки')
    } else if (utility.type === 'sewer') {
      warnings.push('Канализация находится в базе без мойки')
    } else if (utility.type === 'gas') {
      warnings.push('Газовый вывод находится в базе без варочной панели')
    } else if (utility.type === 'vent') {
      warnings.push('Блок перекрывает доступ к вентиляции')
    }
    // Розетка за мебелью сама по себе допустима: требования зависят от типа техники.
  }

  if (hasSink) {
    if (!covered.some((utility) => utility.type === 'water')) warnings.push('Для мойки не найден вывод воды')
    if (!covered.some((utility) => utility.type === 'sewer')) warnings.push('Для мойки не найдена канализация')
  }

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
  code: 'outside' | 'anchor' | 'wall' | 'furniture' | 'opening' | 'door-swing'
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
  return issues
}
