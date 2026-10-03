import type { FurnitureItem, HobConnection, Room, UtilityType, Wall } from '@/domain/model'
import { boundaryWalls, roomPolygon, wallLength } from '@/domain/geometry/geometry'
import { findCountertopRow, syncAutoCountertops } from '@/domain/assemblies/countertops'
import { wallFrame, wallInteriorSide, furnitureFromWallAnchor } from '@/domain/placement/wallAnchors'
import { utilityPoint } from '@/domain/room/utilities'
import { assessUtilities, itemPlacementIssues } from '@/domain/validation/rules'
import { bounds } from '@/shared/lib/geometry2d'
import { applianceUtilityTypes, cabinetAppliance, hobUtilityType } from '@/domain/appliances/profiles'
import { powerReachDistance } from '@/domain/validation/power'

const UNIT_WIDTH = 600
const BASE_HEIGHT = 820
const BASE_DEPTH = 560
const START_STEP = 50
const MAX_SIDE_STORAGE = 3
const MAX_MIDDLE_STORAGE = 3
const WORKTOP_HEIGHT = 38
const WORKTOP_DEPTH = 600

type Role = 'storage' | 'prep' | 'sink' | 'hob' | 'oven' | 'dishwasher' | 'fridge'
type ModuleSlot = { role: Role; width: number }

export type StraightKitchenRequirements = {
  wallId: string
  includeSink: boolean
  includeHob: boolean
  hobConnection?: HobConnection
  includeOven?: boolean
  includeDishwasher?: boolean
  includeFridge?: boolean
  minPrepWidth?: 600 | 1200
  storagePreference?: 'balanced' | 'more-storage'
}

export type GenerationDiagnostic = {
  code: 'no-boundary' | 'invalid-wall' | 'invalid-requirements' | 'short-wall' | 'no-space' | 'utility-warning'
  severity: 'error' | 'warning'
  message: string
}

export type StraightKitchenProposal = {
  /** Invalidates a preview when room or furniture changes before it is accepted. */
  sourceSignature: string
  wallId: string
  items: FurnitureItem[]
  moduleCount: number
  rowWidth: number
  utilityFit: { matched: number; marked: number; unmarked: number }
  diagnostics: GenerationDiagnostic[]
}

export type StraightKitchenResult = {
  proposal: StraightKitchenProposal | null
  diagnostics: GenerationDiagnostic[]
}

/** Document-only signature; editor modes and selection do not invalidate a proposal. */
export function straightKitchenSourceSignature(room: Room, furniture: FurnitureItem[]): string {
  return JSON.stringify({ room, furniture })
}

function coreSequences(
  {
    includeSink,
    includeHob,
    includeOven = false,
    includeDishwasher = false,
    minPrepWidth = 600,
  }: StraightKitchenRequirements,
  maxMiddleStorage = 0,
): Role[][] {
  const prep: Role[] = minPrepWidth === 1200 ? ['prep', 'prep'] : ['prep']
  const sinkClusters: Role[][] = !includeSink
    ? []
    : includeDishwasher
      ? [
          ['sink', 'dishwasher'],
          ['dishwasher', 'sink'],
        ]
      : [['sink']]
  const cooking: Role[] = includeHob ? ['hob'] : includeOven ? ['oven'] : []
  if (includeSink && cooking.length) {
    const sequences: Role[][] = []
    for (let middle = 0; middle <= maxMiddleStorage; middle++) {
      for (let beforePrep = 0; beforePrep <= middle; beforePrep++) {
        const gap: Role[] = [
          ...Array.from({ length: beforePrep }, (): Role => 'storage'),
          ...prep,
          ...Array.from({ length: middle - beforePrep }, (): Role => 'storage'),
        ]
        for (const sink of sinkClusters) {
          sequences.push([...sink, ...gap, ...cooking], [...cooking, ...gap, ...sink])
        }
      }
    }
    return sequences
  }
  if (includeSink) return sinkClusters.map((sink) => [...sink, ...prep])
  if (cooking.length) return [[...prep, ...cooking]]
  return [['storage', ...prep, 'storage']]
}

function previewPrefix(furniture: FurnitureItem[]): string {
  const ids = new Set(furniture.map((item) => item.id))
  let prefix = '__straight-kitchen-preview__'
  while ([...ids].some((id) => id.startsWith(prefix))) {
    prefix += '_'
  }
  return prefix
}

function baseAt(
  wall: Wall,
  side: 'left' | 'right',
  offset: number,
  role: Role,
  width: number,
  id: string,
  ovenUnderHob: boolean,
): FurnitureItem {
  const facade = role === 'prep' ? 'three-drawers' : 'single-door'
  const item: FurnitureItem = {
    id,
    type: 'cabinet',
    position: wall.start,
    elevation: 0,
    rotation: 0,
    params: { width, height: BASE_HEIGHT, depth: BASE_DEPTH, facadeColor: '#d3bb98' },
    cabinetModule: {
      familyId: 'base-storage',
      version: 1,
      facade,
      role:
        role === 'hob' && ovenUnderHob
          ? 'oven'
          : role === 'sink' || role === 'hob' || role === 'oven' || role === 'dishwasher'
            ? role
            : 'storage',
    },
    wallAnchor: { wallId: wall.id, side, offset, distance: 0 },
  }
  return furnitureFromWallAnchor(item, wall)
}

function builtInOn(base: FurnitureItem, role: 'sink' | 'hob', id: string, connection: HobConnection): FurnitureItem {
  const sink = role === 'sink'
  return {
    id,
    type: role,
    hobConnection: role === 'hob' ? connection : undefined,
    position: base.position,
    elevation: sink ? 690 : 818,
    rotation: base.rotation,
    params: {
      width: UNIT_WIDTH,
      height: sink ? 180 : 50,
      depth: sink ? 500 : 520,
      facadeColor: sink ? '#b6bbc2' : '#2b2f36',
    },
  }
}

function itemsForRow(
  room: Room,
  wall: Wall,
  side: 'left' | 'right',
  slots: ModuleSlot[],
  start: number,
  prefix: string,
  requirements: StraightKitchenRequirements,
): FurnitureItem[] {
  let cursor = start
  const placed = slots.map(({ role, width }, index) => {
    const offset = cursor + width / 2
    cursor += width
    if (role === 'fridge') {
      return furnitureFromWallAnchor(
        {
          id: `${prefix}fridge-${index}`,
          type: 'fridge',
          position: wall.start,
          elevation: 0,
          rotation: 0,
          params: { width, height: 2000, depth: 650, facadeColor: '#e8e4dd' },
          wallAnchor: { wallId: wall.id, side, offset, distance: 0 },
        },
        wall,
      )
    }
    return baseAt(wall, side, offset, role, width, `${prefix}base-${index}`, requirements.includeOven === true)
  })
  const bases = placed.filter((item) => item.type === 'cabinet')
  const builtIns = slots.flatMap(({ role }, index) =>
    role === 'sink' || role === 'hob'
      ? [builtInOn(placed[index]!, role, `${prefix}${role}`, requirements.hobConnection ?? 'unknown')]
      : [],
  )
  const countertop: FurnitureItem = {
    id: `${prefix}countertop`,
    type: 'countertop',
    position: bases[0]!.position,
    elevation: BASE_HEIGHT,
    rotation: bases[0]!.rotation,
    params: {
      width: UNIT_WIDTH,
      height: WORKTOP_HEIGHT,
      depth: WORKTOP_DEPTH,
      facadeColor: '#8f9299',
    },
    autoCountertop: { supportIds: bases.map((item) => item.id), frontOverhang: 40 },
  }
  // Use the exact same assembly function as a committed document.
  let piece = 0
  return syncAutoCountertops(
    [...placed, ...builtIns, countertop],
    room,
    () => `${prefix}countertop-piece-${piece++}`,
  ).filter((item) => item.id.startsWith(prefix))
}

/** One end storage module may absorb a non-standard remainder; appliances and prep stay 600 mm. */
function widthVariants(roles: Role[]): ModuleSlot[][] {
  const standard = roles.map((role) => ({ role, width: UNIT_WIDTH }))
  const variants = [standard]
  const storageIndices = [roles.indexOf('storage'), roles.lastIndexOf('storage')].filter((index) => index >= 0)
  for (const index of new Set(storageIndices)) {
    for (const width of [400, 450, 500, 550]) {
      variants.push(standard.map((slot, slotIndex) => (slotIndex === index ? { ...slot, width } : slot)))
    }
  }
  return variants
}

function candidateWarnings(items: FurnitureItem[], existing: FurnitureItem[], room: Room): string[] {
  const all = [...existing, ...items]
  return [
    ...new Set(
      items
        .filter((item) => item.type === 'cabinet' || item.type === 'fridge')
        .flatMap((item) => assessUtilities(item, all, room).warnings),
    ),
  ]
}

type UtilityFit = StraightKitchenProposal['utilityFit'] & { distance: number }

/** Count reachable marked outlets before comparing layout preferences. An unmarked outlet is unknown, not a conflict. */
function utilityFit(items: FurnitureItem[], existing: FurnitureItem[], room: Room): UtilityFit {
  const all = [...existing, ...items]
  const fit: UtilityFit = { matched: 0, marked: 0, unmarked: 0, distance: 0 }
  for (const item of items) {
    const appliance = item.type === 'fridge' ? 'fridge' : cabinetAppliance(item)
    const types: UtilityType[] =
      item.type === 'sink'
        ? ['water', 'sewer']
        : item.type === 'hob'
          ? [hobUtilityType(item.hobConnection ?? 'unknown')].filter((type) => type !== null)
          : appliance
            ? applianceUtilityTypes(appliance)
            : []
    if (!types.length) continue
    const host =
      item.type === 'sink' || item.type === 'hob'
        ? items.find(
            (candidate) =>
              candidate.type === 'cabinet' &&
              candidate.position.x === item.position.x &&
              candidate.position.y === item.position.y,
          )
        : undefined
    const target = item.type === 'sink' ? host : item
    const connected = target ? assessUtilities(target, all, room).connected : []
    for (const type of types) {
      const marked = room.utilities.filter((utility) => utility.type === type)
      if (!marked.length) {
        fit.unmarked++
        continue
      }
      fit.marked++
      const outlet = connected.find((utility) => utility.type === type)
      if (outlet) {
        fit.matched++
        const point = utilityPoint(outlet, room)
        fit.distance +=
          type === 'power'
            ? (powerReachDistance(host ?? item, outlet, room) ?? 0)
            : Math.hypot(point.x - item.position.x, point.y - item.position.y)
      } else {
        // Still prefer the nearest candidate when no layout can reach a marked outlet.
        fit.distance += Math.min(
          ...marked.map((utility) => {
            const point = utilityPoint(utility, room)
            return Math.hypot(point.x - item.position.x, point.y - item.position.y)
          }),
        )
      }
    }
  }
  return fit
}

function startingPositions(maxStart: number): number[] {
  const positions: number[] = []
  for (let start = 0; start <= maxStart; start += START_STEP) positions.push(start)
  positions.push(Math.round(maxStart / 10) * 10)
  return [...new Set(positions)].sort((a, b) => a - b)
}

/** Bounded, deterministic sketch generator. No React, storage or random IDs. */
export function generateStraightKitchen(
  room: Room,
  furniture: FurnitureItem[],
  requirements: StraightKitchenRequirements,
): StraightKitchenResult {
  if (requirements.includeDishwasher && !requirements.includeSink)
    return {
      proposal: null,
      diagnostics: [
        {
          code: 'invalid-requirements',
          severity: 'error',
          message: 'Посудомойка в этом шаблоне ставится рядом с мойкой.',
        },
      ],
    }
  const boundary = boundaryWalls(room.walls)
  if (!boundary.length)
    return {
      proposal: null,
      diagnostics: [{ code: 'no-boundary', severity: 'error', message: 'Сначала замкните внешний контур помещения.' }],
    }
  const wall = boundary.find((candidate) => candidate.id === requirements.wallId)
  if (!wall)
    return {
      proposal: null,
      diagnostics: [{ code: 'invalid-wall', severity: 'error', message: 'Выберите стену внешнего контура.' }],
    }

  const minimalCores = coreSequences(requirements)
  const minimumWidth =
    (Math.min(...minimalCores.map((core) => core.length)) + (requirements.includeFridge ? 1 : 0)) * UNIT_WIDTH
  const length = wallLength(wall)
  if (length < minimumWidth)
    return {
      proposal: null,
      diagnostics: [
        {
          code: 'short-wall',
          severity: 'error',
          message: `Для такого состава нужно хотя бы ${minimumWidth} мм прямой стены; сейчас ${Math.round(length)} мм.`,
        },
      ],
    }

  const center = bounds(roomPolygon(room.walls)).center
  const side = wallInteriorSide(wall, center)
  const prefix = previewPrefix(furniture)
  const frame = wallFrame(wall)
  const maxMiddleStorage = Math.min(MAX_MIDDLE_STORAGE, Math.floor((length - minimumWidth) / UNIT_WIDTH))
  const cores = coreSequences(requirements, maxMiddleStorage)
  let best: { items: FurnitureItem[]; width: number; score: number; warnings: string[]; fit: UtilityFit } | null = null
  const blockedBy = new Set<string>()

  for (const core of cores) {
    for (let left = 0; left <= MAX_SIDE_STORAGE; left++) {
      for (let right = 0; right <= MAX_SIDE_STORAGE; right++) {
        const roles: Role[] = [
          ...Array.from({ length: left }, (): Role => 'storage'),
          ...core,
          ...Array.from({ length: right }, (): Role => 'storage'),
          ...(requirements.includeFridge ? (['fridge'] as Role[]) : []),
        ]
        for (const slots of widthVariants(roles)) {
          const width = slots.reduce((sum, slot) => sum + slot.width, 0)
          if (width > length || width > 6000) continue
          const maxStart = Math.floor((length - width) / 10) * 10
          for (const start of startingPositions(maxStart)) {
            const items = itemsForRow(room, wall, side, slots, start, prefix, requirements)
            const all = [...furniture, ...items]
            const issues = items.flatMap((item) => itemPlacementIssues(item, all, room))
            if (issues.length) {
              issues.forEach((issue) => blockedBy.add(issue.code))
              continue
            }
            // A proposed automatic top must not silently absorb an existing base
            // when the document is synchronized at acceptance time.
            const proposalBases = new Set(items.filter((item) => item.type === 'cabinet').map((item) => item.id))
            if (
              findCountertopRow(items.find((item) => item.type === 'cabinet')!.id, all, room).some(
                (item) => !proposalBases.has(item.id),
              )
            ) {
              blockedBy.add('existing-row')
              continue
            }

            const warnings = candidateWarnings(items, furniture, room)
            const fit = utilityFit(items, furniture, room)
            const unused = length - width
            const centerOffset = Math.abs(start + width / 2 - frame.length / 2)
            const storageWeight = requirements.storagePreference === 'more-storage' ? 3 : 0.4
            const score = fit.distance + unused * storageWeight + centerOffset * 0.02 - roles.length * 10
            const missed = fit.marked - fit.matched
            const bestMissed = best ? best.fit.marked - best.fit.matched : Infinity
            if (
              !best ||
              missed < bestMissed ||
              (missed === bestMissed &&
                (warnings.length < best.warnings.length ||
                  (warnings.length === best.warnings.length && score < best.score)))
            )
              best = { items, width, score, warnings, fit }
          }
        }
      }
    }
  }

  if (!best)
    return {
      proposal: null,
      diagnostics: [
        {
          code: 'no-space',
          severity: 'error',
          message: `На этой стене нет непрерывного свободного участка для выбранного состава. ${[
            blockedBy.has('wall') || blockedBy.has('anchor') ? 'Мешают углы или перегородки.' : '',
            blockedBy.has('opening') || blockedBy.has('door-swing') ? 'Мешают проёмы или открывание двери.' : '',
            blockedBy.has('furniture') || blockedBy.has('existing-row') ? 'Мешает существующая мебель.' : '',
          ]
            .filter(Boolean)
            .join(' ')}`.trim(),
        },
      ],
    }

  const diagnostics: GenerationDiagnostic[] = best.warnings.map((message) => ({
    code: 'utility-warning',
    severity: 'warning',
    message,
  }))
  if (best.fit.marked > best.fit.matched)
    diagnostics.unshift({
      code: 'utility-warning',
      severity: 'warning',
      message: `Не все подключения удалось совместить с отмеченными выводами: ${best.fit.marked - best.fit.matched} без совпадения. Проверьте расположение или требования перед принятием эскиза.`,
    })
  return {
    proposal: {
      sourceSignature: straightKitchenSourceSignature(room, furniture),
      wallId: wall.id,
      items: best.items,
      moduleCount: best.items.filter((item) => item.type === 'cabinet').length,
      rowWidth: best.width,
      utilityFit: { matched: best.fit.matched, marked: best.fit.marked, unmarked: best.fit.unmarked },
      diagnostics,
    },
    diagnostics,
  }
}
