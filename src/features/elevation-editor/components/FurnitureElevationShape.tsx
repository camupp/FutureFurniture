import { Group, Label, Rect, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { type FurnitureItem } from '@/domain/model'
import { clamp } from '@/shared/lib/units'
import type { StageView } from '@/shared/canvas/useStageViewport'

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
  resolvePlacement,
  onSelect,
  onDrop,
}: Props) {
  const maxElevation = Math.max(0, wallHeight - item.params.height)

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
        fill={isInvalid ? '#fee2e2' : hasWarning ? '#fef3c7' : item.params.facadeColor}
        opacity={0.95}
        stroke={isInvalid ? '#dc2626' : hasWarning ? '#d97706' : selected ? '#2563eb' : '#334155'}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeScaleEnabled={false}
      />
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
