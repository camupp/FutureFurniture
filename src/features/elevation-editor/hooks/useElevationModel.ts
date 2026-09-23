import { useCallback, useMemo } from 'react'
import { type FurnitureItem } from '@/domain/model'
import { roomPolygon, wallLength } from '@/domain/geometry/geometry'
import { bounds } from '@/shared/lib/geometry2d'
import { offsetAlongWall } from '@/domain/room/openings'
import { placeBlockInSection } from '@/domain/placement/snapping'
import { utilityPoint } from '@/domain/room/utilities'
import {
  wallFrame,
  wallInteriorSide,
  wallNormal,
  wallOffsetToDisplay,
  wallPointAtOffset,
} from '@/domain/placement/wallAnchors'
import type { Room } from '@/domain/model'

const FLOOR_UTILITY_VIEW_DEPTH = 1000

export function useElevationModel(
  room: Room,
  furniture: FurnitureItem[],
  elevationWallId: string | null,
  smartPlacement: boolean,
) {
  const activeWallIndex = Math.max(
    0,
    room.walls.findIndex((wall) => wall.id === elevationWallId),
  )
  const activeWall = room.walls[activeWallIndex]
  const activeWallLength = activeWall ? wallLength(activeWall) : 1000
  const roomCenter = useMemo(() => {
    const polygon = roomPolygon(room.walls)
    return polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
  }, [room.walls])
  const activeSide = activeWall
    ? (furniture.find((item) => item.wallAnchor?.wallId === activeWall.id)?.wallAnchor?.side ??
      wallInteriorSide(activeWall, roomCenter))
    : 'left'

  const projected = useMemo(() => {
    if (!activeWall) return []
    return furniture.flatMap((item) => {
      const anchor = item.wallAnchor
      if (!anchor || anchor.wallId !== activeWall.id || anchor.side !== activeSide) return []
      return [{ item, x: wallOffsetToDisplay(anchor.offset, activeWall, anchor.side) }]
    })
  }, [activeWall, activeSide, furniture])

  const projectedOpenings = useMemo(() => {
    if (!activeWall) return []
    return room.openings
      .filter((opening) => opening.wallId === activeWall.id)
      .map((opening) => ({
        opening,
        x: wallOffsetToDisplay(opening.offset, activeWall, activeSide),
      }))
  }, [activeWall, activeSide, room.openings])

  const projectedUtilities = useMemo(() => {
    if (!activeWall) return []
    const frame = wallFrame(activeWall)
    const inward = wallNormal(activeWall, activeSide)

    return room.utilities.flatMap((utility) => {
      if (utility.mount.kind === 'wall') {
        if (utility.mount.wallId !== activeWall.id) return []
        return [
          {
            utility,
            x: wallOffsetToDisplay(utility.mount.offset, activeWall, activeSide),
            distanceFromWall: 0,
          },
        ]
      }

      const point = utilityPoint(utility, room)
      const offset = offsetAlongWall(point, activeWall)
      if (offset < 0 || offset > frame.length) return []
      const onWall = wallPointAtOffset(activeWall, offset)
      const distanceFromWall = (point.x - onWall.x) * inward.x + (point.y - onWall.y) * inward.y
      if (distanceFromWall < 0 || distanceFromWall > FLOOR_UTILITY_VIEW_DEPTH) return []
      return [{ utility, x: wallOffsetToDisplay(offset, activeWall, activeSide), distanceFromWall }]
    })
  }, [activeWall, activeSide, room])

  const resolvePlacement = useCallback(
    (item: FurnitureItem, x: number, elevation: number) => {
      if (!activeWall || item.autoCountertop) {
        return {
          position: item.position,
          rotation: item.rotation,
          elevation: item.elevation,
          wallAnchor: item.wallAnchor,
          displayX:
            activeWall && item.wallAnchor
              ? wallOffsetToDisplay(item.wallAnchor.offset, activeWall, item.wallAnchor.side)
              : x,
        }
      }
      const placement = placeBlockInSection(
        item,
        activeWall.id,
        x,
        elevation,
        room,
        furniture.filter((other) => other.id !== item.id && !other.autoCountertop?.supportIds.includes(item.id)),
        roomCenter,
        smartPlacement,
      )
      const displayX = placement.wallAnchor
        ? wallOffsetToDisplay(placement.wallAnchor.offset, activeWall, placement.wallAnchor.side)
        : x
      return { ...placement, displayX }
    },
    [activeWall, room, furniture, roomCenter, smartPlacement],
  )

  return {
    activeWallIndex,
    activeWall,
    activeWallLength,
    activeSide,
    projected,
    projectedOpenings,
    projectedUtilities,
    resolvePlacement,
  }
}
