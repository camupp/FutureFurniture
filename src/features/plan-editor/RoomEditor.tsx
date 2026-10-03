import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, Group, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { useAppStore } from '@/application/project'
import type { FurnitureItem, Point } from '@/domain/model'
import { roomPolygon } from '@/domain/geometry/geometry'
import { furnitureInMarquee, translateFurniture, withHostedBuiltIns } from '@/domain/assemblies/furnitureGroups'
import { syncAutoCountertops } from '@/domain/assemblies/countertops'
import { bounds, distance, snapPoint } from '@/shared/lib/geometry2d'
import { cabinetFrontLayout } from '@/domain/assemblies/cabinetJoints'
import { clampOffset } from '@/domain/room/openings'
import { placeBlock, type Placement } from '@/domain/placement/snapping'
import { furnitureClearances } from '@/domain/placement/clearances'
import { alignmentGuides } from '@/domain/placement/guides'
import { useElementSize } from '@/shared/hooks/useElementSize'
import { stagePointer, useStageViewport } from '@/shared/canvas/useStageViewport'
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
import { GroupContextMenu } from './components/GroupContextMenu'
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

export function RoomEditor({ previewFurniture = [] }: { previewFurniture?: FurnitureItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(containerRef)
  const fittedRef = useRef(false)

  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const smartPlacement = useAppStore((s) => s.smartPlacement)
  const tool = useAppStore((s) => s.tool)
  const selection = useAppStore((s) => s.selection)
  const selectedFurnitureIds = useAppStore((s) => s.selectedFurnitureIds)
  const select = useAppStore((s) => s.select)
  const selectFurniture = useAppStore((s) => s.selectFurniture)
  const selectFurnitureInMarquee = useAppStore((s) => s.selectFurnitureInMarquee)
  const moveSelectedFurniture = useAppStore((s) => s.moveSelectedFurniture)
  const groupSelectedFurniture = useAppStore((s) => s.groupSelectedFurniture)
  const ungroupSelectedFurniture = useAppStore((s) => s.ungroupSelectedFurniture)
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
  const [multiDrag, setMultiDrag] = useState<{ leaderId: string; delta: Point } | null>(null)
  const [marquee, setMarquee] = useState<{ start: Point; end: Point; additive: boolean } | null>(null)
  const marqueeRef = useRef<typeof marquee>(null)
  const [groupMenu, setGroupMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const historyRevision = useAppStore((s) => s.historyRevision)
  useEffect(() => {
    setDragPreview(null)
    setMultiDrag(null)
    setMarquee(null)
    marqueeRef.current = null
    setGroupMenu(null)
  }, [historyRevision, tool])
  useEffect(() => {
    if (!groupMenu) return
    const dismiss = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest('[data-group-menu]')) setGroupMenu(null)
    }
    window.addEventListener('pointerdown', dismiss)
    return () => window.removeEventListener('pointerdown', dismiss)
  }, [groupMenu])
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
  const multiDragIds = useMemo(
    () => (multiDrag ? withHostedBuiltIns(furniture, selectedFurnitureIds) : []),
    [furniture, multiDrag, selectedFurnitureIds],
  )
  const displayedFurniture = useMemo(() => {
    if (!multiDrag) return furniture
    let previewId = 0
    return syncAutoCountertops(
      translateFurniture(furniture, multiDragIds, multiDrag.delta, room),
      room,
      () => `preview-group-${previewId++}`,
    )
  }, [furniture, multiDrag, multiDragIds, room])
  const multiPreviewInvalid = useMemo(
    () => (multiDrag ? invalidItemIds(displayedFurniture, room) : new Set<string>()),
    [displayedFurniture, multiDrag, room],
  )
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
    () => [
      ...displayedFurniture.filter((item) => item.autoCountertop),
      ...displayedFurniture.filter((item) => !item.autoCountertop),
    ],
    [displayedFurniture],
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
    handlePointerMove: handleToolPointerMove,
  } = usePlanTools(view.scale)
  const handlePointerDown = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    setAddMenu(null)
    setGroupMenu(null)
    const stage = event.target.getStage()
    if (tool === 'select' && stage && event.target === stage && 'button' in event.evt && event.evt.button === 0) {
      const start = stagePointer(stage)
      if (start) {
        const next = { start, end: start, additive: event.evt.shiftKey }
        marqueeRef.current = next
        setMarquee(next)
        return
      }
    }
    handleToolPointerDown(event)
  }
  const handlePointerMove = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const current = marqueeRef.current
    if (current) {
      const end = stagePointer(event.target.getStage())
      if (end) {
        const next = { ...current, end }
        marqueeRef.current = next
        setMarquee(next)
      }
      return
    }
    handleToolPointerMove(event)
  }
  const finishMarquee = (stage: Konva.Stage | null) => {
    const current = marqueeRef.current
    if (!current) return
    const end = stagePointer(stage) ?? current.end
    if (distance(current.start, end) * view.scale >= 5) {
      selectFurnitureInMarquee(furnitureInMarquee(furniture, current.start, end), current.additive)
    } else if (!current.additive) {
      select(null)
    }
    marqueeRef.current = null
    setMarquee(null)
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
    setGroupMenu(null)
    setMarquee(null)
    marqueeRef.current = null
    setMultiDrag(null)
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
          onMouseUp={(event) => finishMarquee(event.target.getStage())}
          onMouseLeave={(event) => finishMarquee(event.target.getStage())}
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

            {furnitureInDrawOrder.map((item) => {
              const source = furniture.find((candidate) => candidate.id === item.id) ?? item
              const movingTogether =
                selectedFurnitureIds.length > 1 && selectedFurnitureIds.includes(item.id) && !item.autoCountertop
              return (
                <FurnitureShape
                  key={item.id}
                  item={item}
                  selected={
                    selection?.kind === 'furniture' &&
                    (selection.id === item.id ||
                      selectedFurnitureIds.includes(item.id) ||
                      Boolean(selectedCountertopGroup && item.autoCountertop?.groupId === selectedCountertopGroup))
                  }
                  invalid={
                    multiDrag
                      ? multiPreviewInvalid.has(item.id)
                      : dragPreview?.id === item.id
                        ? previewIssues.length > 0
                        : invalid.has(item.id)
                  }
                  warning={warnings.has(item.id)}
                  showLabel={!item.autoCountertop && visibleFurnitureLabels.has(item.id)}
                  draggable={tool === 'select' && !item.autoCountertop}
                  scale={view.scale}
                  frontLayout={cabinetFrontLayouts.get(item.id)}
                  onSelect={(event) => {
                    if (tool !== 'select') return
                    if (item.autoCountertop) {
                      select({ kind: 'furniture', id: item.id })
                      return
                    }
                    selectFurniture(item.id, 'shiftKey' in event.evt && event.evt.shiftKey)
                  }}
                  onContextMenu={(event) => {
                    if (tool !== 'select' || item.autoCountertop) return
                    event.evt.preventDefault()
                    event.cancelBubble = true
                    if (!selectedFurnitureIds.includes(item.id)) selectFurniture(item.id)
                    const container = containerRef.current?.getBoundingClientRect()
                    if (!container) return
                    setAddMenu(null)
                    setGroupMenu({
                      id: item.id,
                      x: event.evt.clientX - container.left,
                      y: event.evt.clientY - container.top,
                    })
                  }}
                  onMove={(position) => {
                    if (item.autoCountertop) return
                    if (movingTogether) return moveSelectedFurniture(source.id, position) ? position : source.position
                    dropFurniture(source.id, position)
                  }}
                  onPreview={(placement) => {
                    if (movingTogether) {
                      setMultiDrag(
                        placement
                          ? {
                              leaderId: item.id,
                              delta: {
                                x: placement.position.x - source.position.x,
                                y: placement.position.y - source.position.y,
                              },
                            }
                          : null,
                      )
                    } else setDragPreview(placement ? { id: item.id, placement } : null)
                  }}
                  resolve={(position) =>
                    movingTogether
                      ? {
                          position: snapPoint(position, GRID_STEP),
                          rotation: source.rotation,
                          wallAnchor: source.wallAnchor,
                        }
                      : resolvePlacement(source, position)
                  }
                />
              )
            })}

            {previewFurniture.length > 0 && (
              <Group listening={false} opacity={0.62}>
                {previewFurniture.map((item) => (
                  <FurnitureShape
                    key={item.id}
                    item={item}
                    selected={false}
                    invalid={false}
                    warning={false}
                    showLabel={false}
                    draggable={false}
                    scale={view.scale}
                    onSelect={() => undefined}
                    onMove={() => undefined}
                    onPreview={() => undefined}
                    resolve={() => ({ position: item.position, rotation: item.rotation })}
                  />
                ))}
              </Group>
            )}

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
            {marquee && (
              <Rect
                x={Math.min(marquee.start.x, marquee.end.x)}
                y={Math.min(marquee.start.y, marquee.end.y)}
                width={Math.abs(marquee.end.x - marquee.start.x)}
                height={Math.abs(marquee.end.y - marquee.start.y)}
                fill="rgba(37, 99, 235, 0.12)"
                stroke="#2563eb"
                strokeWidth={1.5}
                strokeScaleEnabled={false}
                listening={false}
              />
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
                  : 'Вид сверху · протяните рамку для выбора · Shift+клик — добавить · ПКМ — действия'}
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
      {selectedFurnitureIds.length > 1 && !groupMenu && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 shadow-sm">
          Выбрано объектов: {selectedFurnitureIds.length} · перетащите любой для совместного перемещения · ПКМ для
          группировки
        </div>
      )}
      {groupMenu && (
        <GroupContextMenu
          x={groupMenu.x}
          y={groupMenu.y}
          containerWidth={width}
          containerHeight={height}
          canGroup={selectedFurnitureIds.length > 1}
          canUngroup={Boolean(furniture.find((item) => item.id === groupMenu.id)?.groupId)}
          onGroup={() => {
            groupSelectedFurniture()
            setGroupMenu(null)
          }}
          onUngroup={() => {
            ungroupSelectedFurniture()
            setGroupMenu(null)
          }}
        />
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
