import { useCallback, useEffect, useState } from 'react'
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
  const historyRevision = useAppStore((s) => s.historyRevision)
  useEffect(() => {
    setDraft(null)
    setCursor(null)
  }, [historyRevision])
  const snapForWall = useCallback(
    (raw: Point): Point => {
      const threshold = VERTEX_SNAP_PX / scale
      let nearest: Point | null = null
      let nearestDistance = threshold
      const aligned = draft && ortho ? orthoSnap(draft, raw) : raw
      for (const wall of room.walls) {
        for (const vertex of [wall.start, wall.end]) {
          const d = distance(vertex, aligned)
          if (d < nearestDistance) {
            nearest = vertex
            nearestDistance = d
          }
        }
      }
      if (nearest) return nearest
      // Т-стык должен попадать на ось существующей стены, а не рядом с ней по сетке.
      for (const wall of room.walls) {
        const dx = wall.end.x - wall.start.x
        const dy = wall.end.y - wall.start.y
        const lengthSq = dx * dx + dy * dy
        if (lengthSq < 1) continue
        const t = Math.max(
          0,
          Math.min(1, ((aligned.x - wall.start.x) * dx + (aligned.y - wall.start.y) * dy) / lengthSq),
        )
        const projected = { x: wall.start.x + dx * t, y: wall.start.y + dy * t }
        const d = distance(projected, aligned)
        if (d < nearestDistance) {
          const length = Math.sqrt(lengthSq)
          const offset = Math.max(0, Math.min(length, Math.round((t * length) / GRID_STEP) * GRID_STEP))
          nearest = { x: wall.start.x + (dx / length) * offset, y: wall.start.y + (dy / length) * offset }
          nearestDistance = d
        }
      }
      if (nearest) return nearest
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
