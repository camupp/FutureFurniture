import { BLOCK_LIMITS, type FurnitureItem } from '@/domain/model'
import { footprintsOverlap, OVERLAP_TOLERANCE } from '@/domain/geometry/collision'
import { itemFootprint } from '@/domain/geometry/geometry'
import { bounds, rotatePoint } from '@/shared/lib/geometry2d'

export type CabinetFrontInterval = {
  /** Координаты вдоль фасада в локальной системе шкафа, от -width / 2. */
  start: number
  end: number
}

export type BlindCornerJoint = {
  hostId: string
  blockerId: string
  side: 'left' | 'right'
  /** Какой торец ширины блокирующей тумбы подходит к углу. */
  blockerSide: 'left' | 'right'
  blocked: CabinetFrontInterval
  open: CabinetFrontInterval
}

export type CabinetFrontLayout = {
  visible: CabinetFrontInterval[]
  blocked: CabinetFrontInterval[]
  /** Место стыка двух доступных фасадов в локальной системе шкафа. */
  innerSeams: Array<{ x: number; side: 'left' | 'right' }>
  /** Фактический отрезок цоколя вдоль локальной ширины шкафа. */
  plinth: CabinetFrontInterval
  /** Наружные боковые стыки корпуса, которые должны выглядеть как одна плоскость. */
  outerSeams: Array<'left' | 'right'>
}

export const CABINET_PLINTH_INSET = 50
export const CABINET_PLINTH_JOIN_OVERLAP = 1

const ANGLE_TOLERANCE = 1

function normalizedAngle(value: number): number {
  return ((value % 360) + 360) % 360
}

function angleDistance(a: number, b: number): number {
  const distance = Math.abs(normalizedAngle(a) - normalizedAngle(b))
  return Math.min(distance, 360 - distance)
}

function isFloorBase(item: FurnitureItem): boolean {
  return item.type === 'cabinet' && Math.abs(item.elevation) <= OVERLAP_TOLERANCE && item.params.height <= 1200
}

function cabinetTop(item: FurnitureItem): number {
  return item.elevation + item.params.height
}

function blindCornerJoint(host: FurnitureItem, blocker: FurnitureItem): BlindCornerJoint | null {
  if (!isFloorBase(host) || !isFloorBase(blocker) || host.id === blocker.id) return null
  if (Math.abs(cabinetTop(host) - cabinetTop(blocker)) > OVERLAP_TOLERANCE) return null
  if (Math.abs(angleDistance(host.rotation, blocker.rotation) - 90) > ANGLE_TOLERANCE) return null

  const hostFootprint = itemFootprint(host)
  const blockerFootprint = itemFootprint(blocker)
  // Угловые тумбы соприкасаются гранями, но не могут занимать один объём.
  if (footprintsOverlap(hostFootprint, blockerFootprint)) return null

  const localBlocker = bounds(
    blockerFootprint.map((point) => {
      const rotated = rotatePoint(point, host.position, -host.rotation)
      return { x: rotated.x - host.position.x, y: rotated.y - host.position.y }
    }),
  )
  const front = host.params.depth / 2

  // Боковая грань второго шкафа должна касаться фасадной плоскости первого,
  // а сам шкаф — продолжаться наружу от неё.
  if (Math.abs(localBlocker.minY - front) > OVERLAP_TOLERANCE || localBlocker.maxY <= front) return null

  const left = -host.params.width / 2
  const right = host.params.width / 2
  const start = Math.max(left, localBlocker.minX)
  const end = Math.min(right, localBlocker.maxX)
  if (end - start <= OVERLAP_TOLERANCE) return null

  const touchesLeft = Math.abs(start - left) <= OVERLAP_TOLERANCE
  const touchesRight = Math.abs(end - right) <= OVERLAP_TOLERANCE
  // Глухая часть допустима только с края. Шкаф посередине фасада — обычная
  // конфликтная расстановка, а не угловой модуль.
  if (touchesLeft === touchesRight) return null

  const side = touchesLeft ? 'left' : 'right'
  const blocked = { start, end }
  const open = side === 'left' ? { start: end, end: right } : { start: left, end: start }
  if (open.end - open.start < BLOCK_LIMITS.cabinet.width.min) return null

  const hostInBlockerFrame = rotatePoint(host.position, blocker.position, -blocker.rotation)
  const blockerSide = hostInBlockerFrame.x < blocker.position.x ? 'left' : 'right'

  return { hostId: host.id, blockerId: blocker.id, side, blockerSide, blocked, open }
}

/**
 * Находит глухие углы только по геометрии тумб. Стены и привязки намеренно не
 * учитываются: та же механика работает у острова и в открытой кухне.
 */
export function findBlindCornerJoints(furniture: FurnitureItem[]): BlindCornerJoint[] {
  const bases = [...new Map(furniture.filter(isFloorBase).map((item) => [item.id, item])).values()]
  const candidates = bases.flatMap((host) =>
    bases.flatMap((blocker) => {
      const joint = blindCornerJoint(host, blocker)
      return joint ? [joint] : []
    }),
  )
  const countByHost = new Map<string, number>()
  candidates.forEach((joint) => countByHost.set(joint.hostId, (countByHost.get(joint.hostId) ?? 0) + 1))
  // Два одновременных блокиратора дают неоднозначный U-образный модуль. Пока не
  // угадываем, какая сторона должна остаться доступной, и оставляем обычные фасады.
  return candidates
    .filter((joint) => countByHost.get(joint.hostId) === 1)
    .sort((a, b) => a.hostId.localeCompare(b.hostId) || a.blockerId.localeCompare(b.blockerId))
}

function mergeIntervals(intervals: CabinetFrontInterval[]): CabinetFrontInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: CabinetFrontInterval[] = []
  for (const interval of sorted) {
    const previous = merged[merged.length - 1]
    if (!previous || interval.start > previous.end + OVERLAP_TOLERANCE) {
      merged.push({ ...interval })
    } else {
      previous.end = Math.max(previous.end, interval.end)
    }
  }
  return merged
}

/** Готовая разбивка фасада и точный отрезок цоколя для чистого стыка 90°. */
export function cabinetFrontLayout(item: FurnitureItem, furniture: FurnitureItem[]): CabinetFrontLayout {
  const left = -item.params.width / 2
  const right = item.params.width / 2
  const allJoints = findBlindCornerJoints(furniture)
  const joints = allJoints.filter((joint) => joint.hostId === item.id)
  const incoming = allJoints.filter((joint) => joint.blockerId === item.id)
  const plinth = {
    start: left,
    end: right,
  }

  for (const joint of incoming) {
    if (joint.blockerSide === 'left') {
      plinth.start = Math.min(plinth.start, left - CABINET_PLINTH_INSET - CABINET_PLINTH_JOIN_OVERLAP)
    } else {
      plinth.end = Math.max(plinth.end, right + CABINET_PLINTH_INSET + CABINET_PLINTH_JOIN_OVERLAP)
    }
  }
  const outerSeams = joints.map((joint) => joint.side)
  const innerSeams = joints.map((joint) => ({
    x: joint.side === 'left' ? joint.blocked.end : joint.blocked.start,
    side: joint.side,
  }))

  const blocked = mergeIntervals(joints.map((joint) => joint.blocked))
  if (!isFloorBase(item) || blocked.length === 0) {
    return { visible: [{ start: left, end: right }], blocked: [], innerSeams, plinth, outerSeams }
  }

  const visible: CabinetFrontInterval[] = []
  let cursor = left
  for (const interval of blocked) {
    if (interval.start > cursor + OVERLAP_TOLERANCE) visible.push({ start: cursor, end: interval.start })
    cursor = Math.max(cursor, interval.end)
  }
  if (cursor < right - OVERLAP_TOLERANCE) visible.push({ start: cursor, end: right })

  return { visible, blocked, innerSeams, plinth, outerSeams }
}
