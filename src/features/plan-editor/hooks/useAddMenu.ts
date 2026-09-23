import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import { useAppStore } from '@/application/project'
import { roomPolygon } from '@/domain/geometry/geometry'
import { pointInPolygon, snapPoint } from '@/shared/lib/geometry2d'
import { nearestWall } from '@/domain/room/openings'
import { stagePointer } from '@/shared/canvas/useStageViewport'
import { type AddContextTarget } from '../components/AddContextMenu'
import type { RefObject } from 'react'

const GRID_STEP = 10
const CONTEXT_WALL_PICK_PX = 22
const LONG_PRESS_MS = 550
const LONG_PRESS_MOVE_PX = 10

type MenuOptions = {
  containerRef: RefObject<HTMLDivElement | null>
  scale: number
  handlePointerDown: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  handlePointerMove: (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  handleTouchMove: (event: Konva.KonvaEventObject<TouchEvent>) => void
  handleTouchEnd: () => void
}
export function useAddMenu({
  containerRef,
  scale,
  handlePointerDown,
  handlePointerMove,
  handleTouchMove,
  handleTouchEnd,
}: MenuOptions) {
  const room = useAppStore((s) => s.room)
  const tool = useAppStore((s) => s.tool)
  const polygon = useMemo(() => roomPolygon(room.walls), [room.walls])
  const [addMenu, setAddMenu] = useState<AddContextTarget | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const longPressStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!addMenu) return
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[data-context-menu]')) setAddMenu(null)
    }
    window.addEventListener('pointerdown', dismiss)
    return () => window.removeEventListener('pointerdown', dismiss)
  }, [addMenu])

  useEffect(() => setAddMenu(null), [tool])

  const clearLongPress = () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
    longPressTimer.current = null
    longPressStart.current = null
  }

  const openAddMenu = useCallback(
    (stage: Konva.Stage, clientX: number, clientY: number) => {
      const raw = stagePointer(stage)
      const container = containerRef.current
      if (!raw || !container) return
      const rect = container.getBoundingClientRect()
      const position = { x: clientX - rect.left, y: clientY - rect.top }
      const hit = nearestWall(raw, room, CONTEXT_WALL_PICK_PX / scale)

      if (hit) {
        setAddMenu({
          kind: 'wall',
          wallId: hit.wall.id,
          offset: hit.offset,
          point: raw,
          ...position,
        })
      } else if (polygon.length < 3 || pointInPolygon(raw, polygon)) {
        setAddMenu({ kind: 'floor', point: snapPoint(raw, GRID_STEP), ...position })
      }
    },
    [polygon, room, scale, containerRef],
  )

  const handleContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    if (tool !== 'select') return
    const stage = e.target.getStage()
    if (!stage || (e.target !== stage && e.target.name() !== 'room-wall')) return
    openAddMenu(stage, e.evt.clientX, e.evt.clientY)
  }

  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    handlePointerDown(e)
    clearLongPress()
    const touch = e.evt.touches[0]
    const stage = e.target.getStage()
    if (
      tool !== 'select' ||
      e.evt.touches.length !== 1 ||
      !touch ||
      !stage ||
      (e.target !== stage && e.target.name() !== 'room-wall')
    ) {
      return
    }

    const start = { x: touch.clientX, y: touch.clientY }
    longPressStart.current = start
    longPressTimer.current = window.setTimeout(() => {
      stage.stopDrag()
      openAddMenu(stage, start.x, start.y)
      clearLongPress()
    }, LONG_PRESS_MS)
  }

  const handleRoomTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touch = e.evt.touches[0]
    const start = longPressStart.current
    if (
      e.evt.touches.length !== 1 ||
      !touch ||
      (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > LONG_PRESS_MOVE_PX)
    ) {
      clearLongPress()
    }
    handleTouchMove(e)
    if (e.evt.touches.length < 2) handlePointerMove(e)
  }

  const handleRoomTouchEnd = () => {
    clearLongPress()
    handleTouchEnd()
  }

  useEffect(
    () => () => {
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
    },
    [],
  )
  return { addMenu, setAddMenu, handleContextMenu, handleTouchStart, handleRoomTouchMove, handleRoomTouchEnd }
}
