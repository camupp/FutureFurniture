import { Circle, Group, Label, Rect, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { type FurnitureItem } from '@/domain/model'
import { clamp } from '@/shared/lib/units'
import type { StageView } from '@/shared/canvas/useStageViewport'
import type { CabinetFrontLayout } from '@/domain/assemblies/cabinetJoints'
import { CABINET_PLINTH_HEIGHT, cabinetFacePanels } from '@/domain/assemblies/cabinetFaces'
import { cabinetModuleFor } from '@/domain/modules/cabinetFamilies'

type Props = {
  item: FurnitureItem
  x: number
  view: StageView
  wallHeight: number
  wallLength: number
  selected: boolean
  isInvalid: boolean
  hasWarning: boolean
  draggable: boolean
  frontLayout?: CabinetFrontLayout
  resolvePlacement: (item: FurnitureItem, x: number, elevation: number) => { displayX: number; elevation: number }
  onSelect: () => void
  onDrop: (x: number, elevation: number) => void
}
export function FurnitureElevationShape({
  item,
  x,
  view,
  wallHeight,
  wallLength,
  selected,
  isInvalid,
  hasWarning,
  draggable,
  frontLayout,
  resolvePlacement,
  onSelect,
  onDrop,
}: Props) {
  const maxElevation = Math.max(0, wallHeight - item.params.height)
  const module = cabinetModuleFor(item)
  const onFloor = item.elevation === 0 && module?.familyId !== 'wall-storage'
  const panels = module
    ? cabinetFacePanels(item.params.width, item.params.height, onFloor, frontLayout?.visible, module)
    : []
  const faceFill = isInvalid ? '#fee2e2' : hasWarning ? '#fef3c7' : item.params.facadeColor

  const applyPlacement = (node: Konva.Node) => {
    const placement = resolvePlacement(item, node.x(), -node.y())
    node.position({ x: placement.displayX, y: -placement.elevation })
    return placement
  }

  return (
    <Group
      key={item.id}
      x={x}
      y={-item.elevation}
      draggable={draggable}
      dragBoundFunc={(position) => ({
        x: clamp(position.x, view.x, view.x + wallLength * view.scale),
        y: clamp(position.y, view.y - maxElevation * view.scale, view.y),
      })}
      onMouseDown={() => onSelect()}
      onTouchStart={() => onSelect()}
      onDragMove={(event) => applyPlacement(event.target)}
      onDragEnd={(event) => {
        const placement = applyPlacement(event.target)
        if (!item.autoCountertop) onDrop(placement.displayX, placement.elevation)
      }}
    >
      <Rect
        x={-item.params.width / 2}
        y={-item.params.height}
        width={item.params.width}
        height={item.params.height}
        fill={module && !isInvalid && !hasWarning ? '#d9d5cf' : faceFill}
        opacity={0.95}
        stroke={isInvalid ? '#dc2626' : hasWarning ? '#d97706' : selected ? '#2563eb' : '#334155'}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeScaleEnabled={false}
      />
      {module && onFloor && (
        <Rect
          x={frontLayout?.plinth.start ?? -item.params.width / 2}
          y={-CABINET_PLINTH_HEIGHT}
          width={
            (frontLayout?.plinth.end ?? item.params.width / 2) - (frontLayout?.plinth.start ?? -item.params.width / 2)
          }
          height={CABINET_PLINTH_HEIGHT}
          fill="#334155"
          opacity={0.25}
          listening={false}
        />
      )}
      {panels.map((panel, index) => {
        return (
          <Group key={index} listening={false}>
            <Rect
              x={panel.left}
              y={-panel.top}
              width={panel.right - panel.left}
              height={panel.top - panel.bottom}
              fill={faceFill}
              stroke="#64748b"
              strokeWidth={1}
              strokeScaleEnabled={false}
            />
            {panel.handleStyle === 'knob' ? (
              <Circle x={panel.handleX} y={-panel.handleY} radius={panel.handleWidth / 2} fill="#475569" />
            ) : (
              <Rect
                x={panel.handleX - panel.handleWidth / 2}
                y={-panel.handleY - panel.handleHeight / 2}
                width={panel.handleWidth}
                height={panel.handleHeight}
                fill="#475569"
              />
            )}
          </Group>
        )
      })}
      <Label
        x={0}
        y={-item.params.height / 2}
        scaleX={1 / view.scale}
        scaleY={1 / view.scale}
        offsetX={30}
        offsetY={9}
        listening={false}
      >
        <Tag fill="#ffffff" opacity={0.85} cornerRadius={3} />
        <Text text={`↑${item.elevation}`} fontSize={12} padding={3} width={60} align="center" fill="#0f172a" />
      </Label>
    </Group>
  )
}
