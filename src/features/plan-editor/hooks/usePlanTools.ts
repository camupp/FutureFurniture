import { useCallback, useState } from 'react'
import type Konva from 'konva'
import { useAppStore } from '@/application/project'
import type { Point } from '@/domain/model'
import { distance, orthoSnap, snapPoint } from '@/shared/lib/geometry2d'
import { nearestWall } from '@/domain/room/openings'
import { stagePointer } from '@/shared/canvas/useStageViewport'

const GRID_STEP = 10
const VERTEX_SNAP_PX = 14
const WALL_PICK_MM = 600

export function usePlanTools(scale: number) {
  const room = useAppStore((s) => s.room)
  const tool = useAppStore((s) => s.tool)
  const ortho = useAppStore((s) => s.orthoSnap)
  const select = useAppStore((s) => s.select)
  const addWall = useAppStore((s) => s.addWall)
  const addOpening = useAppStore((s) => s.addOpening)
  const addUtility = useAppStore((s) => s.addUtility)
  const utilityType = useAppStore((s) => s.utilityType)
  const [draft, setDraft] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const snapForWall = useCallback(
    (raw: Point): Point => {
      const threshold = VERTEX_SNAP_PX / scale
      let nearest: Point | null = null
      let nearestDistance = threshold
      for (const wall of room.walls) {
        for (const vertex of [wall.start, wall.end]) {
          const d = distance(vertex, raw)
          if (d < nearestDistance) {
            nearest = vertex
            nearestDistance = d
          }
        }
      }
      if (nearest) return nearest
      const aligned = draft && ortho ? orthoSnap(draft, raw) : raw
      return snapPoint(aligned, GRID_STEP)
    },
    [room.walls, draft, ortho, scale],
  )

  const handlePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage()
    if (tool === 'pan' || !stage) return

    if (tool === 'wall') {
      const raw = stagePointer(stage)
      if (!raw) return
      const point = snapForWall(raw)
      if (!draft) {
        setDraft(point)
        return
      }
      const firstVertex = room.walls[0]?.start
      if (distance(draft, point) >= 1) addWall(draft, point)
      const closesLoop = firstVertex !== undefined && distance(point, firstVertex) < 1
      setDraft(closesLoop ? null : point)
      return
    }

    if (tool === 'window' || tool === 'door') {
      const raw = stagePointer(stage)
      if (!raw) return
      const hit = nearestWall(raw, room, WALL_PICK_MM)
      if (hit) addOpening(hit.wall.id, hit.offset, tool)
      return
    }

    if (tool === 'utility') {
      const raw = stagePointer(stage)
      if (raw) addUtility(snapPoint(raw, GRID_STEP), utilityType)
      return
    }

    if (e.target === stage) select(null)
  }

  const handlePointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== 'wall') {
      if (cursor) setCursor(null)
      return
    }
    const raw = stagePointer(e.target.getStage())
    if (raw) setCursor(snapForWall(raw))
  }

  return { draft, setDraft, cursor, handlePointerDown, handlePointerMove }
}
