import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Circle, Label, Layer, Line, Stage, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { useAppStore } from '../../shared/store'
import type { Point } from '../../shared/types'
import { distance, orthoSnap, roomPolygon, snapPoint } from '../../shared/utils/geometry'
import { useElementSize } from '../../shared/utils/useElementSize'
import { stagePointer, useStageViewport } from '../../shared/utils/useStageViewport'
import { invalidItemIds } from '../validation/rules'
import { FurnitureShape } from './components/FurnitureShape'
import { WallShape } from './components/WallShape'

const GRID_STEP = 10
const VERTEX_SNAP_PX = 14

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
  const tool = useAppStore((s) => s.tool)
  const ortho = useAppStore((s) => s.orthoSnap)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const addWall = useAppStore((s) => s.addWall)
  const moveFurniture = useAppStore((s) => s.moveFurniture)
  const removeFurniture = useAppStore((s) => s.removeFurniture)
  const removeWall = useAppStore((s) => s.removeWall)

  const { view, fitTo, zoomBy, handleWheel, handleStageDragEnd } = useStageViewport(width, height)
  const [draft, setDraft] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)

  const polygon = useMemo(() => roomPolygon(room.walls), [room.walls])
  const invalid = useMemo(() => invalidItemIds(furniture, room), [furniture, room])

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
        select(null)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const current = useAppStore.getState().selection
        if (!current) return
        if (current.kind === 'furniture') removeFurniture(current.id)
        else removeWall(current.id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [select, removeFurniture, removeWall])

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
    <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden bg-slate-50">
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
          onTouchStart={handlePointerDown}
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
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

            {furniture.map((item) => (
              <FurnitureShape
                key={item.id}
                item={item}
                selected={selection?.kind === 'furniture' && selection.id === item.id}
                invalid={invalid.has(item.id)}
                draggable={tool === 'select'}
                scale={view.scale}
                onSelect={() => tool === 'select' && select({ kind: 'furniture', id: item.id })}
                onMove={(position) => moveFurniture(item.id, snapPoint(position, GRID_STEP))}
              />
            ))}

            {draft && (
              <Circle x={draft.x} y={draft.y} radius={6 / view.scale} fill="#2563eb" listening={false} />
            )}
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
            : tool === 'pan'
              ? 'Тяните холст для перемещения'
              : 'План · 1 клетка = 1000 мм'}
        </span>
        <div className="pointer-events-auto flex gap-1">
          <ViewButton onClick={() => zoomBy(1.25)} label="+" />
          <ViewButton onClick={() => zoomBy(0.8)} label="−" />
          <ViewButton onClick={fitToContent} label="По размеру" />
        </div>
      </div>
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
