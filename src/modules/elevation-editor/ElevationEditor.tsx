import { Fragment, useEffect, useMemo, useRef } from 'react'
import { Group, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { useAppStore } from '../../shared/store'
import { bounds, itemFootprint, roomPolygon, snap } from '../../shared/utils/geometry'
import { clamp } from '../../shared/utils/units'
import { useElementSize } from '../../shared/utils/useElementSize'
import { useStageViewport } from '../../shared/utils/useStageViewport'
import { invalidItemIds } from '../validation/rules'

const GRID_STEP = 10
const HEIGHT_GUIDE_STEP = 500

/**
 * Вид помещения по высоте (взгляд со стороны +y).
 * По горизонтали — ось X плана, по вертикали — высота над полом (вверх).
 * Konva рисует y вниз, поэтому высота h лежит на координате -h.
 */
export function ElevationEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)
  const fittedRef = useRef(false)

  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const tool = useAppStore((s) => s.tool)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const moveFurniture = useAppStore((s) => s.moveFurniture)
  const elevateFurniture = useAppStore((s) => s.elevateFurniture)

  const { view, fitTo, zoomBy, handleWheel, handleStageDragEnd } = useStageViewport(width, height)

  const invalid = useMemo(() => invalidItemIds(furniture, room), [furniture, room])
  const roomBox = useMemo(() => bounds(roomPolygon(room.walls)), [room.walls])

  const fitPoints = useMemo(
    () => [
      { x: roomBox.minX, y: 0 },
      { x: roomBox.maxX, y: -room.wallHeight },
    ],
    [roomBox.minX, roomBox.maxX, room.wallHeight],
  )

  useEffect(() => {
    if (fittedRef.current || !width || !height) return
    fittedRef.current = true
    fitTo(fitPoints)
  }, [width, height, fitTo, fitPoints])

  /** Блоки, спроецированные на плоскость X–высота; дальние рисуются первыми. */
  const projected = useMemo(
    () =>
      furniture
        .map((item) => {
          const box = bounds(itemFootprint(item))
          return { item, extent: box.width, depth: box.center.y }
        })
        .sort((a, b) => a.depth - b.depth),
    [furniture],
  )

  const guides = useMemo(() => {
    const values: number[] = []
    for (let h = 0; h <= room.wallHeight; h += HEIGHT_GUIDE_STEP) values.push(h)
    return values
  }, [room.wallHeight])

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
          onMouseDown={(e) => {
            if (tool === 'select' && e.target === e.target.getStage()) select(null)
          }}
          style={{ cursor: tool === 'pan' ? 'grab' : 'default' }}
        >
          <Layer listening={false}>
            <Rect
              x={roomBox.minX}
              y={-room.wallHeight}
              width={Math.max(roomBox.width, 1000)}
              height={room.wallHeight}
              fill="#ffffff"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
            />
            {guides.map((h) => (
              <Fragment key={h}>
                <Line
                  points={[roomBox.minX, -h, roomBox.maxX, -h]}
                  stroke={h === 0 ? '#94a3b8' : '#e2e8f0'}
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                />
                <Label
                  x={roomBox.minX}
                  y={-h}
                  scaleX={1 / view.scale}
                  scaleY={1 / view.scale}
                  offsetX={38}
                  offsetY={8}
                >
                  <Tag fill="#ffffff" opacity={0.9} cornerRadius={3} />
                  <Text text={String(h)} fontSize={11} padding={2} width={34} align="right" fill="#64748b" />
                </Label>
              </Fragment>
            ))}
          </Layer>

          <Layer>
            {projected.map(({ item, extent }) => {
              const selected = selection?.kind === 'furniture' && selection.id === item.id
              const isInvalid = invalid.has(item.id)
              const blockHeight = item.params.height
              const maxElevation = Math.max(0, room.wallHeight - blockHeight)

              const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
                moveFurniture(item.id, {
                  x: snap(e.target.x(), GRID_STEP),
                  y: item.position.y,
                })
                elevateFurniture(item.id, snap(-e.target.y(), GRID_STEP))
              }

              return (
                <Group
                  key={item.id}
                  x={item.position.x}
                  y={-item.elevation}
                  draggable={tool === 'select'}
                  dragBoundFunc={(pos) => ({
                    x: pos.x,
                    y: clamp(pos.y, view.y - maxElevation * view.scale, view.y),
                  })}
                  onMouseDown={() => tool === 'select' && select({ kind: 'furniture', id: item.id })}
                  onTouchStart={() => tool === 'select' && select({ kind: 'furniture', id: item.id })}
                  onDragEnd={handleDragEnd}
                >
                  <Rect
                    x={-extent / 2}
                    y={-blockHeight}
                    width={extent}
                    height={blockHeight}
                    fill={isInvalid ? '#fee2e2' : item.params.facadeColor}
                    opacity={0.95}
                    stroke={isInvalid ? '#dc2626' : selected ? '#2563eb' : '#334155'}
                    strokeWidth={selected ? 2.5 : 1.5}
                    strokeScaleEnabled={false}
                  />
                  <Label
                    x={0}
                    y={-blockHeight / 2}
                    scaleX={1 / view.scale}
                    scaleY={1 / view.scale}
                    offsetX={30}
                    offsetY={9}
                    listening={false}
                  >
                    <Tag fill="#ffffff" opacity={0.85} cornerRadius={3} />
                    <Text
                      text={`↑${item.elevation}`}
                      fontSize={12}
                      padding={3}
                      width={60}
                      align="center"
                      fill="#0f172a"
                    />
                  </Label>
                </Group>
              )
            })}
          </Layer>
        </Stage>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <span className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
          {tool === 'pan'
            ? 'Тяните холст для перемещения'
            : 'Вид по высоте · тяните блок вверх-вниз, чтобы поднять его над полом'}
        </span>
        <div className="pointer-events-auto flex gap-1">
          <ViewButton onClick={() => zoomBy(1.25)} label="+" />
          <ViewButton onClick={() => zoomBy(0.8)} label="−" />
          <ViewButton onClick={() => fitTo(fitPoints)} label="По размеру" />
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
