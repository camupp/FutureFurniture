import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react'
import { Circle, Group, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { useAppStore } from '../../shared/store'
import { OPENING_LABELS, UTILITY_COLORS, UTILITY_LABELS, type FurnitureItem } from '../../shared/types'
import { bounds, itemFootprint, roomPolygon } from '../../shared/utils/geometry'
import { openingFrame } from '../../shared/utils/openings'
import { placeBlockInSection } from '../../shared/utils/snapping'
import { clamp } from '../../shared/utils/units'
import { useElementSize } from '../../shared/utils/useElementSize'
import { useStageViewport } from '../../shared/utils/useStageViewport'
import { utilityPoint } from '../../shared/utils/utilities'
import { connectedUtilityIds, invalidItemIds, invalidUtilityIds, warningItemIds } from '../validation/rules'

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
  const smartPlacement = useAppStore((s) => s.smartPlacement)
  const dropInSection = useAppStore((s) => s.dropInSection)
  const moveUtility = useAppStore((s) => s.moveUtility)
  const updateUtility = useAppStore((s) => s.updateUtility)

  const { view, fitTo, zoomBy, handleWheel, handleStageDragEnd, handleTouchMove, handleTouchEnd } = useStageViewport(
    width,
    height,
  )

  const invalid = useMemo(() => invalidItemIds(furniture, room), [furniture, room])
  const warnings = useMemo(() => warningItemIds(furniture, room), [furniture, room])
  const invalidUtilities = useMemo(() => invalidUtilityIds(room), [room])
  const connectedUtilities = useMemo(() => connectedUtilityIds(furniture, room), [furniture, room])
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

  const resolvePlacement = useCallback(
    (item: FurnitureItem, x: number, elevation: number) =>
      placeBlockInSection(
        item,
        x,
        elevation,
        room,
        furniture.filter((other) => other.id !== item.id),
        roomBox.center,
        smartPlacement,
      ),
    [room, furniture, roomBox.center, smartPlacement],
  )

  /**
   * Проёмы фронтальных стен — тех, что вытянуты вдоль оси X. Боковые стены этот вид
   * не представляет, их проёмы показывать бессмысленно: они лягут поперёк картинки.
   */
  const projectedOpenings = useMemo(
    () =>
      room.openings.flatMap((opening) => {
        const frame = openingFrame(opening, room)
        if (!frame || Math.abs(frame.axis.y) > 0.3) return []
        const minX = Math.min(frame.start.x, frame.end.x)
        const maxX = Math.max(frame.start.x, frame.end.x)
        return [{ opening, minX, maxX }]
      }),
    [room],
  )

  const guides = useMemo(() => {
    const values: number[] = []
    for (let h = 0; h <= room.wallHeight; h += HEIGHT_GUIDE_STEP) values.push(h)
    return values
  }, [room.wallHeight])

  return (
    <div
      ref={containerRef}
      data-testid="elevation-editor"
      className="relative min-w-0 flex-1 overflow-hidden bg-slate-50"
    >
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
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
                <Label x={roomBox.minX} y={-h} scaleX={1 / view.scale} scaleY={1 / view.scale} offsetX={38} offsetY={8}>
                  <Tag fill="#ffffff" opacity={0.9} cornerRadius={3} />
                  <Text text={String(h)} fontSize={11} padding={2} width={34} align="right" fill="#64748b" />
                </Label>
              </Fragment>
            ))}

            {projectedOpenings.map(({ opening, minX, maxX }) => (
              <Fragment key={opening.id}>
                <Rect
                  x={minX}
                  y={-(opening.sill + opening.height)}
                  width={maxX - minX}
                  height={opening.height}
                  fill="#eff6ff"
                  stroke="#0f172a"
                  strokeWidth={1.5}
                  dash={[14, 8]}
                  strokeScaleEnabled={false}
                />
                <Label
                  x={(minX + maxX) / 2}
                  y={-(opening.sill + opening.height)}
                  scaleX={1 / view.scale}
                  scaleY={1 / view.scale}
                  offsetX={30}
                  offsetY={16}
                >
                  <Tag fill="#ffffff" opacity={0.9} cornerRadius={3} />
                  <Text
                    text={OPENING_LABELS[opening.type]}
                    fontSize={11}
                    padding={3}
                    width={60}
                    align="center"
                    fill="#0f172a"
                  />
                </Label>
              </Fragment>
            ))}
          </Layer>

          <Layer>
            {room.utilities.map((utility) => {
              const point = utilityPoint(utility, room)
              const selected = selection?.kind === 'utility' && selection.id === utility.id
              const isInvalid = invalidUtilities.has(utility.id)
              const isConnected = connectedUtilities.has(utility.id)
              const color = UTILITY_COLORS[utility.type]

              return (
                <Group
                  key={utility.id}
                  x={point.x}
                  y={-utility.height}
                  draggable={tool === 'select'}
                  dragBoundFunc={(pos) => ({
                    x: pos.x,
                    y:
                      utility.mount.kind === 'floor'
                        ? view.y
                        : clamp(pos.y, view.y - room.wallHeight * view.scale, view.y),
                  })}
                  onMouseDown={() => tool === 'select' && select({ kind: 'utility', id: utility.id })}
                  onTouchStart={() => tool === 'select' && select({ kind: 'utility', id: utility.id })}
                  onDragEnd={(e) => {
                    moveUtility(utility.id, { ...point, x: Math.round(e.target.x()) })
                    if (utility.mount.kind === 'wall') {
                      updateUtility(utility.id, { height: Math.round(clamp(-e.target.y(), 0, room.wallHeight)) })
                    }
                  }}
                >
                  <Circle
                    radius={10 / view.scale}
                    fill={isInvalid ? '#fee2e2' : '#ffffff'}
                    stroke={isInvalid ? '#dc2626' : selected ? '#2563eb' : isConnected ? '#059669' : color}
                    strokeWidth={selected ? 3 : 2}
                    strokeScaleEnabled={false}
                  />
                  <Circle radius={4 / view.scale} fill={color} listening={false} />
                  <Label
                    x={0}
                    y={0}
                    scaleX={1 / view.scale}
                    scaleY={1 / view.scale}
                    offsetX={-14}
                    offsetY={10}
                    listening={false}
                  >
                    <Tag fill="#ffffff" opacity={0.9} cornerRadius={3} />
                    <Text text={UTILITY_LABELS[utility.type]} fontSize={11} padding={3} fill="#0f172a" />
                  </Label>
                </Group>
              )
            })}

            {projected.map(({ item, extent }) => {
              const selected = selection?.kind === 'furniture' && selection.id === item.id
              const isInvalid = invalid.has(item.id)
              const hasWarning = warnings.has(item.id)
              const blockHeight = item.params.height
              const maxElevation = Math.max(0, room.wallHeight - blockHeight)

              /**
               * Живой магнит, как на виде сверху: блок притягивается к соседям и
               * по горизонтали, и по высоте прямо во время перетаскивания.
               */
              const applyPlacement = (node: Konva.Node) => {
                const placement = resolvePlacement(item, node.x(), -node.y())
                node.position({ x: placement.position.x, y: -placement.elevation })
                return placement
              }

              const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
                const placement = applyPlacement(e.target)
                dropInSection(item.id, placement.position.x, placement.elevation)
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
                  onDragMove={(e) => applyPlacement(e.target)}
                  onDragEnd={handleDragEnd}
                >
                  <Rect
                    x={-extent / 2}
                    y={-blockHeight}
                    width={extent}
                    height={blockHeight}
                    fill={isInvalid ? '#fee2e2' : hasWarning ? '#fef3c7' : item.params.facadeColor}
                    opacity={0.95}
                    stroke={isInvalid ? '#dc2626' : hasWarning ? '#d97706' : selected ? '#2563eb' : '#334155'}
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
            ? 'Тяните холст для перемещения · щипок — масштаб'
            : 'Вид спереди · тяните блоки и выводы по высоте · щипок — масштаб'}
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
