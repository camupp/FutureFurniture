import { BLOCK_LIMITS, type FurnitureItem, type Point, type Room, type WallAnchor } from '@/domain/model'
import { findBlindCornerJoints } from '@/domain/assemblies/cabinetJoints'
import { OVERLAP_TOLERANCE } from '@/domain/geometry/collision'
import { anchorAtPosition, furnitureFromWallAnchor, wallFrame } from '@/domain/placement/wallAnchors'

/** Только напольные тумбы поддерживают автоматическую столешницу. */
export function isCountertopSupport(item: FurnitureItem): boolean {
  return item.type === 'cabinet' && Math.abs(item.elevation) <= OVERLAP_TOLERANCE && item.params.height <= 1200
}

function top(item: FurnitureItem): number {
  return item.elevation + item.params.height
}

function normalizedAngle(value: number): number {
  return ((value % 360) + 360) % 360
}

function angleDistance(a: number, b: number): number {
  const distance = Math.abs(normalizedAngle(a) - normalizedAngle(b))
  return Math.min(distance, 360 - distance)
}

function axes(rotation: number): { along: Point; front: Point } {
  const radians = (rotation * Math.PI) / 180
  return {
    along: { x: Math.cos(radians), y: Math.sin(radians) },
    front: { x: -Math.sin(radians), y: Math.cos(radians) },
  }
}

function projection(point: Point, axis: Point): number {
  return point.x * axis.x + point.y * axis.y
}

/**
 * Старые тестовые и сохранённые проекты могли хранить координату до синхронизации
 * с привязкой. Для геометрии берём привязку, только когда соответствующая стена
 * действительно существует; свободная мебель всегда использует мировую позицию.
 */
function placed(item: FurnitureItem, room: Room): FurnitureItem {
  if (!item.wallAnchor) return item
  const wall = room.walls.find((candidate) => candidate.id === item.wallAnchor?.wallId)
  return wall && wallFrame(wall).length > 0 ? furnitureFromWallAnchor(item, wall) : item
}

type RowEntry = {
  item: FurnitureItem
  placed: FurnitureItem
  start: number
  end: number
  back: number
  top: number
}

type SupportRow = {
  rotation: number
  entries: RowEntry[]
  start: number
  end: number
  minBack: number
  maxBack: number
  minTop: number
  maxTop: number
}

function rowEntry(item: FurnitureItem, room: Room): RowEntry {
  const resolved = placed(item, room)
  const frame = axes(resolved.rotation)
  const center = projection(resolved.position, frame.along)
  return {
    item,
    placed: resolved,
    start: center - resolved.params.width / 2,
    end: center + resolved.params.width / 2,
    back: projection(resolved.position, frame.front) - resolved.params.depth / 2,
    top: top(resolved),
  }
}

function touchesRow(entry: RowEntry, row: SupportRow): boolean {
  if (angleDistance(entry.placed.rotation, row.rotation) > 1) return false
  if (Math.max(row.maxTop, entry.top) - Math.min(row.minTop, entry.top) > OVERLAP_TOLERANCE) return false
  if (Math.max(row.maxBack, entry.back) - Math.min(row.minBack, entry.back) > OVERLAP_TOLERANCE) return false
  return Math.abs(entry.start - row.end) <= OVERLAP_TOLERANCE || Math.abs(entry.end - row.start) <= OVERLAP_TOLERANCE
}

function addToRow(entry: RowEntry, row: SupportRow) {
  row.entries.push(entry)
  row.entries.sort((a, b) => a.start - b.start || a.item.id.localeCompare(b.item.id))
  row.start = Math.min(row.start, entry.start)
  row.end = Math.max(row.end, entry.end)
  row.minBack = Math.min(row.minBack, entry.back)
  row.maxBack = Math.max(row.maxBack, entry.back)
  row.minTop = Math.min(row.minTop, entry.top)
  row.maxTop = Math.max(row.maxTop, entry.top)
}

/** Прямые непрерывные ряды по фактическим координатам, а не по стенам. */
function supportRows(furniture: FurnitureItem[], room: Room): SupportRow[] {
  const remaining = furniture
    .filter(isCountertopSupport)
    .map((item) => rowEntry(item, room))
    .sort(
      (a, b) =>
        normalizedAngle(a.placed.rotation) - normalizedAngle(b.placed.rotation) ||
        a.back - b.back ||
        a.start - b.start ||
        a.item.id.localeCompare(b.item.id),
    )
  const rows: SupportRow[] = []

  while (remaining.length > 0) {
    const first = remaining.shift()!
    const row: SupportRow = {
      rotation: first.placed.rotation,
      entries: [first],
      start: first.start,
      end: first.end,
      minBack: first.back,
      maxBack: first.back,
      minTop: first.top,
      maxTop: first.top,
    }

    while (true) {
      const nextIndex = remaining.findIndex((entry) => touchesRow(entry, row))
      if (nextIndex < 0) break
      addToRow(remaining.splice(nextIndex, 1)[0]!, row)
    }
    rows.push(row)
  }

  return rows.sort(
    (a, b) =>
      a.entries[0]!.item.id.localeCompare(b.entries[0]!.item.id) ||
      normalizedAngle(a.rotation) - normalizedAngle(b.rotation),
  )
}

/** Объединяет перпендикулярные ряды, только если между ними найден настоящий глухой угол. */
function supportGroups(furniture: FurnitureItem[], room: Room): SupportRow[][] {
  const rows = supportRows(furniture, room)
  const parents = rows.map((_, index) => index)
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]!]!
      index = parents[index]!
    }
    return index
  }
  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parents[Math.max(rootA, rootB)] = Math.min(rootA, rootB)
  }

  const rowBySupport = new Map<string, number>()
  rows.forEach((row, index) => row.entries.forEach((entry) => rowBySupport.set(entry.item.id, index)))
  const resolvedSupports = furniture.filter(isCountertopSupport).map((item) => placed(item, room))
  for (const joint of findBlindCornerJoints(resolvedSupports)) {
    const hostRow = rowBySupport.get(joint.hostId)
    const blockerRow = rowBySupport.get(joint.blockerId)
    if (hostRow !== undefined && blockerRow !== undefined) union(hostRow, blockerRow)
  }

  const groups = new Map<number, SupportRow[]>()
  rows.forEach((row, index) => {
    const root = find(index)
    groups.set(root, [...(groups.get(root) ?? []), row])
  })
  return [...groups.values()]
}

/**
 * Возвращает все тумбы одной непрерывной столешницы. Для обычной линии это один
 * ряд, для корректного глухого угла — обе перпендикулярные ветви.
 */
export function findCountertopRow(cabinetId: string, furniture: FurnitureItem[], room: Room): FurnitureItem[] {
  const group = supportGroups(furniture, room).find((rows) =>
    rows.some((row) => row.entries.some((entry) => entry.item.id === cabinetId)),
  )
  return group?.flatMap((row) => row.entries.map((entry) => entry.item)) ?? []
}

function splitRow(row: SupportRow): RowEntry[][] {
  const pieces: RowEntry[][] = []
  let piece: RowEntry[] = []
  for (const support of row.entries) {
    if (piece.length > 0 && support.end - piece[0]!.start > BLOCK_LIMITS.countertop.width.max) {
      pieces.push(piece)
      piece = []
    }
    piece.push(support)
  }
  if (piece.length > 0) pieces.push(piece)
  return pieces
}

function sharesSupports(item: FurnitureItem, supportIds: Set<string>): boolean {
  return item.autoCountertop!.supportIds.some((id) => supportIds.has(id))
}

function commonWallAnchor(entries: RowEntry[], room: Room, position: Point): WallAnchor | undefined {
  const first = entries[0]!.item.wallAnchor
  if (!first) return undefined
  if (
    !entries.every(
      ({ item }) =>
        item.wallAnchor?.wallId === first.wallId &&
        item.wallAnchor.side === first.side &&
        Math.abs(item.wallAnchor.distance - first.distance) <= OVERLAP_TOLERANCE,
    )
  ) {
    return undefined
  }
  const wall = room.walls.find((candidate) => candidate.id === first.wallId)
  if (!wall || wallFrame(wall).length <= 0) return undefined
  return anchorAtPosition(wall, first.side, position, first.distance)
}

function countertopFromPiece(
  entries: RowEntry[],
  source: FurnitureItem,
  id: string,
  room: Room,
  groupId?: string,
): FurnitureItem {
  const first = entries[0]!
  const frame = axes(first.placed.rotation)
  const start = Math.min(...entries.map((entry) => entry.start))
  const end = Math.max(...entries.map((entry) => entry.end))
  const back = Math.min(...entries.map((entry) => entry.back))
  const frontOverhang = source.autoCountertop!.frontOverhang ?? 40
  const depth = Math.max(
    BLOCK_LIMITS.countertop.depth.min,
    ...entries.map((entry) => entry.placed.params.depth + frontOverhang),
  )
  const along = (start + end) / 2
  const across = back + depth / 2
  const position = {
    x: frame.along.x * along + frame.front.x * across,
    y: frame.along.y * along + frame.front.y * across,
  }
  const wallAnchor = commonWallAnchor(entries, room, position)
  const { wallAnchor: _oldAnchor, ...sourceWithoutAnchor } = source
  const countertop: FurnitureItem = {
    ...sourceWithoutAnchor,
    id,
    position,
    rotation: first.placed.rotation,
    elevation: Math.max(...entries.map((entry) => entry.top)),
    params: { ...source.params, width: end - start, depth },
    ...(wallAnchor ? { wallAnchor } : {}),
    autoCountertop: {
      supportIds: entries.map((entry) => entry.item.id),
      frontOverhang,
      ...(groupId ? { groupId } : {}),
    },
  }
  if (!wallAnchor) return countertop
  const wall = room.walls.find((candidate) => candidate.id === wallAnchor.wallId)!
  return furnitureFromWallAnchor(countertop, wall)
}

/**
 * Автоматические столешницы принадлежат опорам, а не стенам. Прямой ряд даёт
 * одну или несколько деталей до 4 м; геометрически связанный угол — две ветви
 * с общим groupId, которые дальше управляются как одна L-образная столешница.
 */
export function syncAutoCountertops(furniture: FurnitureItem[], room: Room, newId: () => string): FurnitureItem[] {
  const automatic = furniture.filter((item) => item.type === 'countertop' && item.autoCountertop)
  if (automatic.length === 0) return furniture

  const result = furniture.filter((item) => item.type !== 'countertop' || !item.autoCountertop)
  const usedIds = new Set<string>()

  for (const rows of supportGroups(furniture, room)) {
    const groupSupportIds = new Set(rows.flatMap((row) => row.entries.map((entry) => entry.item.id)))
    const owners = automatic.filter((item) => sharesSupports(item, groupSupportIds))
    const template = owners[0]
    if (!template) continue
    const groupId =
      rows.length > 1
        ? (owners.find((owner) => owner.autoCountertop?.groupId)?.autoCountertop?.groupId ?? template.id)
        : undefined

    for (const row of rows) {
      for (const piece of splitRow(row)) {
        const pieceIds = new Set(piece.map((entry) => entry.item.id))
        const owner =
          owners.find((item) => !usedIds.has(item.id) && sharesSupports(item, pieceIds)) ??
          owners.find((item) => !usedIds.has(item.id))
        const source = owner ?? template
        const id = owner?.id ?? newId()
        usedIds.add(id)
        result.push(countertopFromPiece(piece, source, id, room, groupId))
      }
    }
  }

  return result
}
