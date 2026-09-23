import { Fragment, useEffect, useMemo, useRef } from 'react'
import { Circle, Group, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva'
import { useAppStore } from '@/application/project'
import { OPENING_LABELS, UTILITY_COLORS, UTILITY_LABELS } from '@/domain/model'
import { clamp } from '@/shared/lib/units'
import { useElementSize } from '@/shared/hooks/useElementSize'
import { useStageViewport } from '@/shared/canvas/useStageViewport'
import { displayToWallOffset, wallNormal, wallPointAtOffset } from '@/domain/placement/wallAnchors'
import { connectedUtilityIds, invalidItemIds, invalidUtilityIds, warningItemIds } from '@/domain/validation/rules'
import { useElevationModel } from './hooks/useElevationModel'
import { FurnitureElevationShape } from './components/FurnitureElevationShape'

const HEIGHT_GUIDE_STEP = 500

/** Фасад одной выбранной стены: горизонталь — расстояние вдоль стены, вертикаль — высота. */
export function ElevationEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)

  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const tool = useAppStore((s) => s.tool)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const smartPlacement = useAppStore((s) => s.smartPlacement)
  const elevationWallId = useAppStore((s) => s.elevationWallId)
  const setElevationWall = useAppStore((s) => s.setElevationWall)
  const dropInSection = useAppStore((s) => s.dropInSection)
  const moveUtility = useAppStore((s) => s.moveUtility)
  const updateUtility = useAppStore((s) => s.updateUtility)

  const { view, fitTo, zoomBy, handleWheel, handleStageDragEnd, handleTouchMove, handleTouchEnd } = useStageViewport(
    width,
    height,
  )

  const {
    activeWallIndex,
    activeWall,
    activeWallLength,
    activeSide,
    projected,
    projectedOpenings,
    projectedUtilities,
    resolvePlacement,
  } = useElevationModel(room, furniture, elevationWallId, smartPlacement)

  const invalid = useMemo(() => invalidItemIds(furniture, room), [furniture, room])
  const warnings = useMemo(() => warningItemIds(furniture, room), [furniture, room])
  const invalidUtilities = useMemo(() => invalidUtilityIds(room), [room])
  const connectedUtilities = useMemo(() => connectedUtilityIds(furniture, room), [furniture, room])

  const fitPoints = useMemo(
    () => [
      { x: 0, y: 0 },
      { x: Math.max(activeWallLength, 1000), y: -room.wallHeight },
    ],
    [activeWallLength, room.wallHeight],
  )

  useEffect(() => {
    if (!width || !height) return
    fitTo(fitPoints)
  }, [width, height, activeWall?.id, fitTo, fitPoints])

  const guides = useMemo(() => {
    const values: number[] = []
    for (let guide = 0; guide <= room.wallHeight; guide += HEIGHT_GUIDE_STEP) values.push(guide)
    return values
  }, [room.wallHeight])

  const showPreviousWall = () => {
    if (room.walls.length < 2) return
    setElevationWall(room.walls[(activeWallIndex - 1 + room.walls.length) % room.walls.length]!.id)
  }

  const showNextWall = () => {
    if (room.walls.length < 2) return
    setElevationWall(room.walls[(activeWallIndex + 1) % room.walls.length]!.id)
  }

  return (
    <div
      ref={containerRef}
      data-testid="elevation-editor"
      className="relative min-w-0 flex-1 overflow-hidden bg-slate-50"
    >
      {!activeWall && (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
          Нарисуйте стену, чтобы открыть её фасад
        </div>
      )}

      {width > 0 && height > 0 && activeWall && (
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
          onMouseDown={(event) => {
            if (tool === 'select' && event.target === event.target.getStage()) select(null)
          }}
          style={{ cursor: tool === 'pan' ? 'grab' : 'default' }}
        >
          <Layer listening={false}>
            <Rect
              x={0}
              y={-room.wallHeight}
              width={activeWallLength}
              height={room.wallHeight}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
            />
            {guides.map((guide) => (
              <Fragment key={guide}>
                <Line
                  points={[0, -guide, activeWallLength, -guide]}
                  stroke={guide === 0 ? '#94a3b8' : '#e2e8f0'}
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                />
                <Label x={0} y={-guide} scaleX={1 / view.scale} scaleY={1 / view.scale} offsetX={38} offsetY={8}>
                  <Tag fill="#ffffff" opacity={0.9} cornerRadius={3} />
                  <Text text={String(guide)} fontSize={11} padding={2} width={34} align="right" fill="#64748b" />
                </Label>
              </Fragment>
            ))}

            {projectedOpenings.map(({ opening, x }) => (
              <Fragment key={opening.id}>
                <Rect
                  x={x - opening.width / 2}
                  y={-(opening.sill + opening.height)}
                  width={opening.width}
                  height={opening.height}
                  fill="#eff6ff"
                  stroke="#0f172a"
                  strokeWidth={1.5}
                  dash={[14, 8]}
                  strokeScaleEnabled={false}
                />
                <Label
                  x={x}
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
            {projectedUtilities.map(({ utility, x, distanceFromWall }) => {
              const selected = selection?.kind === 'utility' && selection.id === utility.id
              const isInvalid = invalidUtilities.has(utility.id)
              const isConnected = connectedUtilities.has(utility.id)
              const color = UTILITY_COLORS[utility.type]

              return (
                <Group
                  key={utility.id}
                  x={x}
                  y={-utility.height}
                  draggable={tool === 'select'}
                  dragBoundFunc={(position) => ({
                    x: clamp(position.x, view.x, view.x + activeWallLength * view.scale),
                    y:
                      utility.mount.kind === 'floor'
                        ? view.y
                        : clamp(position.y, view.y - room.wallHeight * view.scale, view.y),
                  })}
                  onMouseDown={() => tool === 'select' && select({ kind: 'utility', id: utility.id })}
                  onTouchStart={() => tool === 'select' && select({ kind: 'utility', id: utility.id })}
                  onDragEnd={(event) => {
                    const displayOffset = Math.round(event.target.x())
                    const offset = displayToWallOffset(displayOffset, activeWall, activeSide)
                    if (utility.mount.kind === 'wall') {
                      updateUtility(utility.id, {
                        mount: { ...utility.mount, offset },
                        height: Math.round(clamp(-event.target.y(), 0, room.wallHeight)),
                      })
                    } else {
                      const wallPoint = wallPointAtOffset(activeWall, offset)
                      const inward = wallNormal(activeWall, activeSide)
                      moveUtility(utility.id, {
                        x: wallPoint.x + inward.x * distanceFromWall,
                        y: wallPoint.y + inward.y * distanceFromWall,
                      })
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

            {projected.map(({ item, x }) => {
              const selectedItem =
                selection?.kind === 'furniture'
                  ? furniture.find((candidate) => candidate.id === selection.id)
                  : undefined
              const selected =
                selection?.kind === 'furniture' &&
                (selection.id === item.id ||
                  Boolean(
                    selectedItem?.autoCountertop?.groupId &&
                    item.autoCountertop?.groupId === selectedItem.autoCountertop.groupId,
                  ))
              return (
                <FurnitureElevationShape
                  key={item.id}
                  item={item}
                  x={x}
                  view={view}
                  wallHeight={room.wallHeight}
                  wallLength={activeWallLength}
                  selected={selected}
                  isInvalid={invalid.has(item.id)}
                  hasWarning={warnings.has(item.id)}
                  draggable={tool === 'select' && !item.autoCountertop}
                  resolvePlacement={resolvePlacement}
                  onSelect={() => {
                    if (tool === 'select') select({ kind: 'furniture', id: item.id })
                  }}
                  onDrop={(x, elevation) => dropInSection(item.id, x, elevation)}
                />
              )
            })}
          </Layer>
        </Stage>
      )}

      {activeWall && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-md bg-white/95 p-1 shadow-sm ring-1 ring-slate-200">
            <ViewButton onClick={showPreviousWall} label="‹" />
            <span className="min-w-32 px-2 text-center text-xs font-medium text-slate-700">
              Стена {activeWallIndex + 1} из {room.walls.length} · {Math.round(activeWallLength)} мм
            </span>
            <ViewButton onClick={showNextWall} label="›" />
          </div>
          <div className="pointer-events-auto flex gap-1">
            <ViewButton onClick={() => zoomBy(1.25)} label="+" />
            <ViewButton onClick={() => zoomBy(0.8)} label="−" />
            <ViewButton onClick={() => fitTo(fitPoints)} label="По размеру" />
          </div>
        </div>
      )}

      {activeWall && projected.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-slate-500">
          На этой стене пока нет прикреплённой мебели
        </p>
      )}
    </div>
  )
}

function ViewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
    >
      {label}
    </button>
  )
}
