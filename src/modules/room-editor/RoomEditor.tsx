import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Circle, Label, Layer, Line, Stage, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { useAppStore } from '../../shared/store'
import type { FurnitureItem, Point } from '../../shared/types'
import { bounds, distance, orthoSnap, pointInPolygon, roomPolygon, snapPoint } from '../../shared/utils/geometry'
import { clampOffset, nearestWall } from '../../shared/utils/openings'
import { placeBlock } from '../../shared/utils/snapping'
import { useElementSize } from '../../shared/utils/useElementSize'
import { stagePointer, useStageViewport } from '../../shared/utils/useStageViewport'
import { utilityPoint, wallUtilityMount } from '../../shared/utils/utilities'
import {
  connectedUtilityIds,
  invalidItemIds,
  invalidOpeningIds,
  invalidUtilityIds,
  warningItemIds,
} from '../validation/rules'
import { FurnitureShape } from './components/FurnitureShape'
import { AddContextMenu, type AddContextTarget } from './components/AddContextMenu'
import { OpeningShape } from './components/OpeningShape'
import { UtilityShape } from './components/UtilityShape'
import { WallShape } from './components/WallShape'

const GRID_STEP = 10
const VERTEX_SNAP_PX = 14
/** Насколько далеко от стены можно кликнуть, чтобы поставить в неё проём. */
const WALL_PICK_MM = 600
const CONTEXT_WALL_PICK_PX = 22
const LONG_PRESS_MS = 550
const LONG_PRESS_MOVE_PX = 10

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}

export function RoomEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)
  const fittedRef = useRef(false)

  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const smartPlacement = useAppStore((s) => s.smartPlacement)
  const tool = useAppStore((s) => s.tool)
  const ortho = useAppStore((s) => s.orthoSnap)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const addWall = useAppStore((s) => s.addWall)
  const dropFurniture = useAppStore((s) => s.dropFurniture)
  const addOpening = useAppStore((s) => s.addOpening)
  const moveOpening = useAppStore((s) => s.moveOpening)
  const addUtility = useAppStore((s) => s.addUtility)
  const moveUtility = useAppStore((s) => s.moveUtility)
  const utilityType = useAppStore((s) => s.utilityType)
  const removeFurniture = useAppStore((s) => s.removeFurniture)
  const removeWall = useAppStore((s) => s.removeWall)
  const removeOpening = useAppStore((s) => s.removeOpening)
  const removeUtility = useAppStore((s) => s.removeUtility)

  const { view, fitTo, zoomBy, handleWheel, handleStageDragEnd, handleTouchMove, handleTouchEnd } = useStageViewport(
    width,
    height,
  )
  const [draft, setDraft] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [addMenu, setAddMenu] = useState<AddContextTarget | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const longPressStart = useRef<{ x: number; y: number } | null>(null)

  const polygon = useMemo(() => roomPolygon(room.walls), [room.walls])
  const invalid = useMemo(() => invalidItemIds(furniture, room), [furniture, room])
  const warnings = useMemo(() => warningItemIds(furniture, room), [furniture, room])
  const invalidOpenings = useMemo(() => invalidOpeningIds(room), [room])
  const invalidUtilities = useMemo(() => invalidUtilityIds(room), [room])
  const connectedUtilities = useMemo(() => connectedUtilityIds(furniture, room), [furniture, room])

  const fitPoints = useMemo(
    () =>
      polygon.length
        ? polygon
        : [
            { x: 0, y: 0 },
            { x: 4000, y: 3000 },
          ],
    [polygon],
  )
  const fitToContent = useCallback(() => fitTo(fitPoints), [fitTo, fitPoints])

  const roomCenter = useMemo(() => (polygon.length ? bounds(polygon).center : { x: 0, y: 0 }), [polygon])

  /** Живой предпросмотр привязки: считается на каждый кадр перетаскивания блока. */
  const resolvePlacement = useCallback(
    (item: FurnitureItem, position: Point) =>
      placeBlock(
        item,
        position,
        room,
        furniture.filter((other) => other.id !== item.id),
        roomCenter,
        smartPlacement,
      ),
    [room, furniture, roomCenter, smartPlacement],
  )

  useEffect(() => {
    if (fittedRef.current || !width || !height) return
    fittedRef.current = true
    fitToContent()
  }, [width, height, fitToContent])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Пока печатают в поле свойств, Delete стирает цифру, а не блок.
      if (isEditableTarget(e.target)) return
      if (e.key === 'Escape') {
        setDraft(null)
        setAddMenu(null)
        select(null)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const current = useAppStore.getState().selection
        if (!current) return
        if (current.kind === 'furniture') removeFurniture(current.id)
        else if (current.kind === 'wall') removeWall(current.id)
        else if (current.kind === 'opening') removeOpening(current.id)
        else removeUtility(current.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [select, removeFurniture, removeWall, removeOpening, removeUtility])

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

  const snapForWall = useCallback(
    (raw: Point): Point => {
      const threshold = VERTEX_SNAP_PX / view.scale
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
    [room.walls, draft, ortho, view.scale],
  )

  const handlePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    setAddMenu(null)
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
      const hit = nearestWall(raw, room, CONTEXT_WALL_PICK_PX / view.scale)

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
    [polygon, room, view.scale],
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

  const handlePointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== 'wall') {
      if (cursor) setCursor(null)
      return
    }
    const raw = stagePointer(e.target.getStage())
    if (raw) setCursor(snapForWall(raw))
  }

  const grid = useMemo<ReactNode>(() => {
    if (!width || !height) return null
    const left = -view.x / view.scale
    const top = -view.y / view.scale
    const right = left + width / view.scale
    const bottom = top + height / view.scale
    const step = (right - left) / 100 > 100 || view.scale * 100 < 6 ? 1000 : 100
    const lines: ReactNode[] = []

    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      const major = Math.abs(x % 1000) < 0.001
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, top, x, bottom]}
          stroke={major ? '#cbd5e1' : '#e8eef6'}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />,
      )
    }
    for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
      const major = Math.abs(y % 1000) < 0.001
      lines.push(
        <Line
          key={`h${y}`}
          points={[left, y, right, y]}
          stroke={major ? '#cbd5e1' : '#e8eef6'}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />,
      )
    }
    return lines
  }, [view, width, height])

  const draftLength = draft && cursor ? Math.round(distance(draft, cursor)) : 0

  return (
    <div ref={containerRef} data-testid="room-editor" className="relative min-w-0 flex-1 overflow-hidden bg-slate-50">
      {/* Konva не умеет рисовать в холст нулевого размера — ждём первый замер контейнера. */}
      {width > 0 && height > 0 && (
        <Stage
          width={width}
          height={height}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          draggable={tool === 'pan'}
          onDragEnd={handleStageDragEnd}
          onWheel={handleWheel}
          onMouseDown={handlePointerDown}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onMouseMove={handlePointerMove}
          onTouchMove={handleRoomTouchMove}
          onTouchEnd={handleRoomTouchEnd}
          onDblClick={() => setDraft(null)}
          style={{
            cursor: tool === 'pan' ? 'grab' : tool === 'wall' ? 'crosshair' : 'default',
          }}
        >
          <Layer listening={false}>{grid}</Layer>
          <Layer>
            {polygon.length > 2 && (
              <Line
                points={polygon.flatMap((p) => [p.x, p.y])}
                closed
                fill="#ffffff"
                opacity={0.85}
                listening={false}
              />
            )}

            {room.walls.map((wall) => (
              <WallShape
                key={wall.id}
                wall={wall}
                selected={selection?.kind === 'wall' && selection.id === wall.id}
                scale={view.scale}
                onSelect={() => tool === 'select' && select({ kind: 'wall', id: wall.id })}
              />
            ))}

            {room.openings.map((opening) => {
              const wall = room.walls.find((candidate) => candidate.id === opening.wallId)
              if (!wall) return null
              return (
                <OpeningShape
                  key={opening.id}
                  opening={opening}
                  wall={wall}
                  offset={clampOffset(opening, wall)}
                  selected={selection?.kind === 'opening' && selection.id === opening.id}
                  invalid={invalidOpenings.has(opening.id)}
                  draggable={tool === 'select'}
                  scale={view.scale}
                  inwardSign={
                    (roomCenter.x - (wall.start.x + wall.end.x) / 2) * -(wall.end.y - wall.start.y) +
                      (roomCenter.y - (wall.start.y + wall.end.y) / 2) * (wall.end.x - wall.start.x) >=
                    0
                      ? 1
                      : -1
                  }
                  onSelect={() => tool === 'select' && select({ kind: 'opening', id: opening.id })}
                  onMove={(offset) => moveOpening(opening.id, offset)}
                />
              )
            })}

            {furniture.map((item) => (
              <FurnitureShape
                key={item.id}
                item={item}
                selected={selection?.kind === 'furniture' && selection.id === item.id}
                invalid={invalid.has(item.id)}
                warning={warnings.has(item.id)}
                draggable={tool === 'select'}
                scale={view.scale}
                onSelect={() => tool === 'select' && select({ kind: 'furniture', id: item.id })}
                onMove={(position) => dropFurniture(item.id, position)}
                resolve={(position) => resolvePlacement(item, position)}
              />
            ))}

            {room.utilities.map((utility) => {
              const point = utilityPoint(utility, room)
              return (
                <UtilityShape
                  key={utility.id}
                  utility={utility}
                  point={point}
                  selected={selection?.kind === 'utility' && selection.id === utility.id}
                  invalid={invalidUtilities.has(utility.id)}
                  connected={connectedUtilities.has(utility.id)}
                  draggable={tool === 'select'}
                  scale={view.scale}
                  onSelect={() => tool === 'select' && select({ kind: 'utility', id: utility.id })}
                  onMove={(nextPoint) => moveUtility(utility.id, snapPoint(nextPoint, GRID_STEP))}
                />
              )
            })}

            {draft && <Circle x={draft.x} y={draft.y} radius={6 / view.scale} fill="#2563eb" listening={false} />}
            {draft && cursor && (
              <>
                <Line
                  points={[draft.x, draft.y, cursor.x, cursor.y]}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dash={[8, 6]}
                  strokeScaleEnabled={false}
                  listening={false}
                />
                <Label
                  x={cursor.x}
                  y={cursor.y}
                  scaleX={1 / view.scale}
                  scaleY={1 / view.scale}
                  offsetX={-12}
                  offsetY={26}
                  listening={false}
                >
                  <Tag fill="#2563eb" cornerRadius={4} />
                  <Text text={`${draftLength} мм`} fontSize={13} padding={5} fill="#ffffff" />
                </Label>
              </>
            )}
          </Layer>
        </Stage>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <span className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
          {tool === 'wall'
            ? draft
              ? 'Клик — следующая точка · Esc или двойной клик — завершить'
              : 'Клик — первая точка стены'
            : tool === 'window' || tool === 'door'
              ? 'Коснитесь стены, чтобы добавить проём'
              : tool === 'utility'
                ? 'Коснитесь плана, чтобы поставить вывод'
                : tool === 'pan'
                  ? 'Тяните холст для перемещения · щипок — масштаб'
                  : 'Вид сверху · ПКМ или долгое нажатие — добавить · щипок — масштаб'}
        </span>
        <div className="pointer-events-auto flex gap-1">
          <ViewButton onClick={() => zoomBy(1.25)} label="+" />
          <ViewButton onClick={() => zoomBy(0.8)} label="−" />
          <ViewButton onClick={fitToContent} label="По размеру" />
        </div>
      </div>

      {addMenu && (
        <AddContextMenu
          target={addMenu}
          containerWidth={width}
          containerHeight={height}
          onClose={() => setAddMenu(null)}
          onAddOpening={(type) => {
            if (addMenu.kind === 'wall') addOpening(addMenu.wallId, addMenu.offset, type)
            setAddMenu(null)
          }}
          onAddUtility={(type) => {
            if (addMenu.kind === 'wall') {
              addUtility(addMenu.point, type, wallUtilityMount(addMenu.wallId, addMenu.offset))
            } else {
              addUtility(addMenu.point, type, { kind: 'floor' })
            }
            setAddMenu(null)
          }}
        />
      )}
    </div>
  )
}

function ViewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-white"
    >
      {label}
    </button>
  )
}
