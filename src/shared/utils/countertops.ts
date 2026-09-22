import { BLOCK_LIMITS, type FurnitureItem, type Room } from '../types'
import { OVERLAP_TOLERANCE } from './collision'
import { furnitureFromWallAnchor, wallFrame } from './wallAnchors'

/** Только напольные тумбы поддерживают автоматическую столешницу. */
export function isCountertopSupport(item: FurnitureItem): boolean {
  return (
    item.type === 'cabinet' &&
    Math.abs(item.elevation) <= OVERLAP_TOLERANCE &&
    item.params.height <= 1200 &&
    item.wallAnchor !== undefined
  )
}

function leftEdge(item: FurnitureItem): number {
  return item.wallAnchor!.offset - item.params.width / 2
}

function rightEdge(item: FurnitureItem): number {
  return item.wallAnchor!.offset + item.params.width / 2
}

function top(item: FurnitureItem): number {
  return item.elevation + item.params.height
}

function supportRows(furniture: FurnitureItem[], room: Room): FurnitureItem[][] {
  const walls = new Set(room.walls.filter((wall) => wallFrame(wall).length > 0).map((wall) => wall.id))
  const remaining = furniture
    .filter((item) => isCountertopSupport(item) && walls.has(item.wallAnchor!.wallId))
    .sort((a, b) => {
      const wall = a.wallAnchor!.wallId.localeCompare(b.wallAnchor!.wallId)
      const side = a.wallAnchor!.side.localeCompare(b.wallAnchor!.side)
      return wall || side || leftEdge(a) - leftEdge(b) || a.id.localeCompare(b.id)
    })
  const rows: FurnitureItem[][] = []

  while (remaining.length > 0) {
    const first = remaining.shift()!
    const row = [first]
    let end = rightEdge(first)
    let minTop = top(first)
    let maxTop = minTop
    let minDistance = first.wallAnchor!.distance
    let maxDistance = minDistance

    while (true) {
      const nextIndex = remaining.findIndex((candidate) => {
        const anchor = candidate.wallAnchor!
        return (
          anchor.wallId === first.wallAnchor!.wallId &&
          anchor.side === first.wallAnchor!.side &&
          Math.abs(leftEdge(candidate) - end) <= OVERLAP_TOLERANCE &&
          Math.max(maxTop, top(candidate)) - Math.min(minTop, top(candidate)) <= OVERLAP_TOLERANCE &&
          Math.max(maxDistance, anchor.distance) - Math.min(minDistance, anchor.distance) <= OVERLAP_TOLERANCE
        )
      })
      if (nextIndex < 0) break
      const next = remaining.splice(nextIndex, 1)[0]!
      row.push(next)
      end = rightEdge(next)
      minTop = Math.min(minTop, top(next))
      maxTop = Math.max(maxTop, top(next))
      minDistance = Math.min(minDistance, next.wallAnchor!.distance)
      maxDistance = Math.max(maxDistance, next.wallAnchor!.distance)
    }

    rows.push(row)
  }

  return rows
}

/**
 * Ряд идёт вдоль одной стены, с общей задней гранью и высотой опор.
 * Допуск стыков тот же, что в проверке столкновений; большие зазоры и
 * пересечения разделяют ряд. Порядок исходного массива на результат не влияет.
 */
export function findCountertopRow(cabinetId: string, furniture: FurnitureItem[], room: Room): FurnitureItem[] {
  return supportRows(furniture, room).find((row) => row.some((item) => item.id === cabinetId)) ?? []
}

function splitRow(row: FurnitureItem[]): FurnitureItem[][] {
  const pieces: FurnitureItem[][] = []
  let piece: FurnitureItem[] = []
  for (const support of row) {
    if (piece.length > 0 && rightEdge(support) - leftEdge(piece[0]!) > BLOCK_LIMITS.countertop.width.max) {
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

/**
 * Автоматические столешницы принадлежат опорам, а не координатам. Из каждой
 * сохранившейся опоры снова находим ряд: новые соседи расширяют его, зазоры
 * разделяют, удаление всех опор убирает принадлежащую им столешницу.
 * Ряды длиннее стандартной детали делим по стыкам тумб, сохраняя полное покрытие.
 */
export function syncAutoCountertops(furniture: FurnitureItem[], room: Room, newId: () => string): FurnitureItem[] {
  const automatic = furniture.filter((item) => item.type === 'countertop' && item.autoCountertop)
  if (automatic.length === 0) return furniture

  const result = furniture.filter((item) => item.type !== 'countertop' || !item.autoCountertop)
  const usedIds = new Set<string>()

  for (const row of supportRows(furniture, room)) {
    const rowIds = new Set(row.map((support) => support.id))
    const owners = automatic.filter((item) => sharesSupports(item, rowIds))
    const template = owners[0]
    if (!template) continue

    for (const piece of splitRow(row)) {
      const supportIds = piece.map((support) => support.id)
      const pieceIds = new Set(supportIds)
      const owner =
        owners.find((item) => !usedIds.has(item.id) && sharesSupports(item, pieceIds)) ??
        owners.find((item) => !usedIds.has(item.id))
      const source = owner ?? template
      const id = owner?.id ?? newId()
      usedIds.add(id)
      const first = piece[0]!
      const start = leftEdge(first)
      const end = rightEdge(piece[piece.length - 1]!)
      const anchor = first.wallAnchor!
      const wall = room.walls.find((candidate) => candidate.id === anchor.wallId)!
      const frontOverhang = source.autoCountertop!.frontOverhang ?? 40
      const countertop: FurnitureItem = {
        ...source,
        id,
        elevation: Math.max(...piece.map(top)),
        params: {
          ...source.params,
          width: end - start,
          depth: Math.max(
            BLOCK_LIMITS.countertop.depth.min,
            ...piece.map((support) => support.params.depth + frontOverhang),
          ),
        },
        wallAnchor: {
          ...anchor,
          offset: (start + end) / 2,
        },
        autoCountertop: { supportIds, frontOverhang },
      }
      result.push(furnitureFromWallAnchor(countertop, wall))
    }
  }

  return result
}
