import type { FurnitureItem, Point, Room } from '@/domain/model'
import { footprintsOverlap, isBuiltIn } from '@/domain/geometry/collision'
import { itemFootprint } from '@/domain/geometry/geometry'
import { rotatePoint } from '@/shared/lib/geometry2d'
import { wallFrame, wallNormal } from '@/domain/placement/wallAnchors'
import { hostCabinet } from './hostedBuiltIns'

/** Generated countertops follow their supports and are not selected independently by a marquee. */
export function selectableFurniture(item: FurnitureItem): boolean {
  return !item.autoCountertop
}

export function expandFurnitureGroups(furniture: FurnitureItem[], ids: Iterable<string>): string[] {
  const selected = new Set(ids)
  const groups = new Set(furniture.filter((item) => selected.has(item.id) && item.groupId).map((item) => item.groupId))
  return furniture
    .filter(
      (item) => selectableFurniture(item) && (selected.has(item.id) || (item.groupId && groups.has(item.groupId))),
    )
    .map((item) => item.id)
}

/** Built-in sink/hob should travel with a selected supporting cabinet. */
export function withHostedBuiltIns(furniture: FurnitureItem[], ids: Iterable<string>): string[] {
  const selected = new Set(ids)
  for (const item of furniture) {
    if (!isBuiltIn(item) || selected.has(item.id)) continue
    const host = hostCabinet(item, furniture)
    if (host && selected.has(host.id)) selected.add(item.id)
  }
  return furniture.filter((item) => selected.has(item.id)).map((item) => item.id)
}

/** An unchanged built-in follows the cabinet that supported it before an edit. Direct built-in edits stay independent. */
export function followMovedHosts(previous: FurnitureItem[], next: FurnitureItem[]): FurnitureItem[] {
  const before = new Map(previous.map((item) => [item.id, item]))
  const after = new Map(next.map((item) => [item.id, item]))
  return next.map((item) => {
    const original = before.get(item.id)
    if (!isBuiltIn(item) || item !== original) return item
    const host = hostCabinet(item, previous)
    if (!host) return item
    const moved = after.get(host.id)
    if (!moved) return item
    const angle = moved.rotation - host.rotation
    const rotated = rotatePoint(item.position, host.position, angle)
    const heightChange = moved.elevation + moved.params.height - host.elevation - host.params.height
    if (
      moved.position.x === host.position.x &&
      moved.position.y === host.position.y &&
      angle === 0 &&
      heightChange === 0
    )
      return item
    return {
      ...item,
      position: {
        x: moved.position.x + rotated.x - host.position.x,
        y: moved.position.y + rotated.y - host.position.y,
      },
      rotation: (((item.rotation + angle) % 360) + 360) % 360,
      elevation: item.elevation + heightChange,
      wallAnchor: undefined,
    }
  })
}

export function furnitureInMarquee(furniture: FurnitureItem[], start: Point, end: Point): string[] {
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)
  const rectangle = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ]
  return furniture
    .filter((item) => selectableFurniture(item) && footprintsOverlap(itemFootprint(item), rectangle))
    .map((item) => item.id)
}

/** Rigid translation: keep a wall anchor only while moving along its wall. */
export function translateFurniture(
  furniture: FurnitureItem[],
  ids: Iterable<string>,
  delta: Point,
  room: Room,
): FurnitureItem[] {
  const moving = new Set(ids)
  return furniture.map((item) => {
    if (!moving.has(item.id) || item.autoCountertop) return item
    const position = { x: item.position.x + delta.x, y: item.position.y + delta.y }
    const anchor = item.wallAnchor
    if (!anchor) return { ...item, position }
    const wall = room.walls.find((candidate) => candidate.id === anchor.wallId)
    if (!wall) return { ...item, position, wallAnchor: undefined }
    const frame = wallFrame(wall)
    const normal = wallNormal(wall, anchor.side)
    const across = delta.x * normal.x + delta.y * normal.y
    if (Math.abs(across) > 1) return { ...item, position, wallAnchor: undefined }
    const along = delta.x * frame.axis.x + delta.y * frame.axis.y
    return { ...item, position, wallAnchor: { ...anchor, offset: anchor.offset + along } }
  })
}

export function pruneFurnitureGroups(furniture: FurnitureItem[]): FurnitureItem[] {
  const counts = new Map<string, number>()
  for (const item of furniture) if (item.groupId) counts.set(item.groupId, (counts.get(item.groupId) ?? 0) + 1)
  return furniture.map((item) =>
    item.groupId && (counts.get(item.groupId) ?? 0) < 2 ? { ...item, groupId: undefined } : item,
  )
}
