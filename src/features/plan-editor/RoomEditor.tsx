import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Label, Layer, Line, Stage, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { useAppStore } from '@/application/project'
import type { FurnitureItem, Point } from '@/domain/model'
import { roomPolygon } from '@/domain/geometry/geometry'
import { bounds, distance, snapPoint } from '@/shared/lib/geometry2d'
import { cabinetFrontLayout } from '@/domain/assemblies/cabinetJoints'
import { clampOffset } from '@/domain/room/openings'
import { placeBlock, type Placement } from '@/domain/placement/snapping'
import { furnitureClearances } from '@/domain/placement/clearances'
import { alignmentGuides } from '@/domain/placement/guides'
import { useElementSize } from '@/shared/hooks/useElementSize'
import { useStageViewport } from '@/shared/canvas/useStageViewport'
import { utilityPoint, wallUtilityMount } from '@/domain/room/utilities'
import {
  connectedUtilityIds,
  invalidItemIds,
  itemPlacementIssues,
  invalidOpeningIds,
  invalidUtilityIds,
  warningItemIds,
} from '@/domain/validation/rules'
import { FurniturePlanLabel, FurnitureShape } from './components/FurnitureShape'
import { visibleFurnitureLabelIds } from './furnitureLabels'
import { AddContextMenu } from './components/AddContextMenu'
import { OpeningShape } from './components/OpeningShape'
import { UtilityShape } from './components/UtilityShape'
import { WallShape } from './components/WallShape'
import { usePlanTools } from './hooks/usePlanTools'
import { useAddMenu } from './hooks/useAddMenu'
import { usePlanKeyboard } from './hooks/usePlanKeyboard'
import { ViewportGrid } from '@/shared/canvas/ViewportGrid'
import { PlacementOverlay } from './components/PlacementOverlay'

const GRID_STEP = 10

export function RoomEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)
  const fittedRef = useRef(false)

  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const smartPlacement = useAppStore((s) => s.smartPlacement)
  const tool = useAppStore((s) => s.tool)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const dropFurniture = useAppStore((s) => s.dropFurniture)
  const addOpening = useAppStore((s) => s.addOpening)
  const moveOpening = useAppStore((s) => s.moveOpening)
  const addUtility = useAppStore((s) => s.addUtility)
  const moveUtility = useAppStore((s) => s.moveUtility)

  const { view, fitTo, zoomBy, handleWheel, handleStageDragEnd, handleTouchMove, handleTouchEnd } = useStageViewport(
    width,
    height,
  )
  const [dragPreview, setDragPreview] = useState<{ id: string; placement: Placement } | null>(null)
  const historyRevision = useAppStore((s) => s.historyRevision)
  useEffect(() => setDragPreview(null), [historyRevision, tool])
  const movingSource = dragPreview ? furniture.find((item) => item.id === dragPreview.id) : undefined
  const measuredItem =
    movingSource && dragPreview
      ? { ...movingSource, ...dragPreview.placement, wallAnchor: dragPreview.placement.wallAnchor }
      : selection?.kind === 'furniture'
        ? furniture.find((item) => item.id === selection.id)
        : undefined
  const gaps = measuredItem ? furnitureClearances(measuredItem, room, furniture) : []
  const previewIssues = measuredItem && dragPreview ? itemPlacementIssues(measuredItem, furniture, room) : []
  const guides =
    measuredItem && dragPreview && smartPlacement && previewIssues.length === 0
      ? alignmentGuides(measuredItem, furniture)
      : []
  const snapPreviewWallId = dragPreview?.placement.wallAnchor?.wallId

  const polygon = useMemo(() => roomPolygon(room.walls), [room.walls])
  const invalid = useMemo(() => invalidItemIds(furniture, room), [furniture, room])
  const warnings = useMemo(() => warningItemIds(furniture, room), [furniture, room])
  const invalidOpenings = useMemo(() => invalidOpeningIds(room), [room])
  const invalidUtilities = useMemo(() => invalidUtilityIds(room), [room])
  const connectedUtilities = useMemo(() => connectedUtilityIds(furniture, room), [furniture, room])
  const cabinetFrontLayouts = useMemo(
    () =>
      new Map(
        furniture
          .filter((item) => item.type === 'cabinet')
          .map((item) => [item.id, cabinetFrontLayout(item, furniture)] as const),
      ),
    [furniture],
  )
  const selectedFurnitureId = selection?.kind === 'furniture' ? selection.id : undefined
  const selectedCountertopGroup = furniture.find((item) => item.id === selectedFurnitureId)?.autoCountertop?.groupId
  const visibleFurnitureLabels = useMemo(
    () => visibleFurnitureLabelIds(furniture, selectedFurnitureId),
    [furniture, selectedFurnitureId],
  )
  // Тумбы остаются доступны для выбора; связанную столешницу можно выбрать за свес
  // или кнопкой в свойствах тумбы.
  const furnitureInDrawOrder = useMemo(
    () => [...furniture.filter((item) => item.autoCountertop), ...furniture.filter((item) => !item.autoCountertop)],
    [furniture],
  )

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
      item.autoCountertop
        ? { position: item.position, rotation: item.rotation, wallAnchor: item.wallAnchor }
        : placeBlock(
            item,
            position,
            room,
            furniture.filter((other) => other.id !== item.id && !other.autoCountertop?.supportIds.includes(item.id)),
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

  const {
    draft,
    setDraft,
    cursor,
    handlePointerDown: handleToolPointerDown,
    handlePointerMove,
  } = usePlanTools(view.scale)
  const handlePointerDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    setAddMenu(null)
    handleToolPointerDown(event)
  }
  const { addMenu, setAddMenu, handleContextMenu, handleTouchStart, handleRoomTouchMove, handleRoomTouchEnd } =
    useAddMenu({
      containerRef,
      scale: view.scale,
      handlePointerDown,
      handlePointerMove,
      handleTouchMove,
      handleTouchEnd,
    })
  const clearDraft = useCallback(() => {
    setDraft(null)
    setAddMenu(null)
  }, [setDraft, setAddMenu])
  usePlanKeyboard(clearDraft)
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
          <Layer listening={false}>
            <ViewportGrid view={view} width={width} height={height} />
          </Layer>
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
                highlighted={snapPreviewWallId === wall.id}
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

            {furnitureInDrawOrder.map((item) => (
              <FurnitureShape
                key={item.id}
                item={item}
                selected={
                  selection?.kind === 'furniture' &&
                  (selection.id === item.id ||
                    Boolean(selectedCountertopGroup && item.autoCountertop?.groupId === selectedCountertopGroup))
                }
                invalid={dragPreview?.id === item.id ? previewIssues.length > 0 : invalid.has(item.id)}
                warning={warnings.has(item.id)}
                showLabel={!item.autoCountertop && visibleFurnitureLabels.has(item.id)}
                draggable={tool === 'select' && !item.autoCountertop}
                scale={view.scale}
                frontLayout={cabinetFrontLayouts.get(item.id)}
                onSelect={() => tool === 'select' && select({ kind: 'furniture', id: item.id })}
                onMove={(position) => !item.autoCountertop && dropFurniture(item.id, position)}
                onPreview={(placement) => setDragPreview(placement ? { id: item.id, placement } : null)}
                resolve={(position) => resolvePlacement(item, position)}
              />
            ))}

            {furniture
              .filter((item) => item.autoCountertop && visibleFurnitureLabels.has(item.id))
              .map((item) => (
                <FurniturePlanLabel key={item.id} item={item} scale={view.scale} />
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
          <Layer listening={false}>
            <PlacementOverlay gaps={gaps} guides={guides} furniture={furniture} scale={view.scale} />
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

      {dragPreview && (previewIssues.length > 0 || guides.length > 0) && (
        <div
          aria-live="polite"
          className={`pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-md px-3 py-2 text-xs shadow-sm ${previewIssues.length ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}
        >
          {previewIssues[0]?.message ??
            (guides.some((guide) => guide.kind === 'front')
              ? 'Фасады выровнены · сосед подсвечен зелёным'
              : guides.some((guide) => guide.kind === 'contact')
                ? 'Стык с соседним блоком'
                : 'Торцы выровнены')}
        </div>
      )}
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
