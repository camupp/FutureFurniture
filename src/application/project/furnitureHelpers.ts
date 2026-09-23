import { BLOCK_LIMITS, type BlockParams, type BlockType, type FurnitureItem, type Room } from '@/domain/model'
import { findCountertopRow } from '@/domain/assemblies/countertops'
import { clamp } from '@/shared/lib/units'

export function clampParams(type: BlockType, params: BlockParams): BlockParams {
  const limits = BLOCK_LIMITS[type]
  return {
    ...params,
    width: clamp(params.width, limits.width.min, limits.width.max),
    height: clamp(params.height, limits.height.min, limits.height.max),
    depth: clamp(params.depth, limits.depth.min, limits.depth.max),
  }
}

export function manualCountertop(item: FurnitureItem): FurnitureItem {
  const { autoCountertop: _removed, ...manual } = item
  return manual
}

/** Части длинного ряда управляются вместе: ручная правка не должна создавать дубль. */
export function autoCountertopRowIds(id: string, furniture: FurnitureItem[], room: Room): Set<string> {
  const item = furniture.find((candidate) => candidate.id === id)
  if (!item?.autoCountertop) return new Set()
  if (item.autoCountertop.groupId) {
    return new Set(
      furniture
        .filter((candidate) => candidate.autoCountertop?.groupId === item.autoCountertop?.groupId)
        .map((candidate) => candidate.id),
    )
  }
  const supportIds = new Set(
    item.autoCountertop.supportIds.flatMap((supportId) =>
      findCountertopRow(supportId, furniture, room).map((support) => support.id),
    ),
  )
  return new Set(
    furniture
      .filter((candidate) => candidate.autoCountertop?.supportIds.some((supportId) => supportIds.has(supportId)))
      .map((candidate) => candidate.id),
  )
}
