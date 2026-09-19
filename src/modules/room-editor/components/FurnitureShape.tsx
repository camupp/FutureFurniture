import { Group, Label, Line, Rect, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import type { FurnitureItem, Point } from '../../../shared/types'

type Props = {
  item: FurnitureItem
  selected: boolean
  invalid: boolean
  draggable: boolean
  scale: number
  onSelect: () => void
  onMove: (position: Point) => void
}

export function FurnitureShape({ item, selected, invalid, draggable, scale, onSelect, onMove }: Props) {
  const { width, depth, facadeColor } = item.params
  const stroke = invalid ? '#dc2626' : selected ? '#2563eb' : '#334155'

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onMove({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })
  }

  return (
    <Group
      x={item.position.x}
      y={item.position.y}
      rotation={item.rotation}
      draggable={draggable}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDragEnd={handleDragEnd}
    >
      <Rect
        x={-width / 2}
        y={-depth / 2}
        width={width}
        height={depth}
        fill={invalid ? '#fee2e2' : facadeColor}
        opacity={0.9}
        stroke={stroke}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeScaleEnabled={false}
        // Навесной блок на плане принято показывать пунктиром.
        dash={item.elevation > 0 ? [10, 6] : undefined}
      />
      {/* Фасад блока — сторона +y в локальных координатах. */}
      <Line
        points={[-width / 2, depth / 2, width / 2, depth / 2]}
        stroke={stroke}
        strokeWidth={5}
        strokeScaleEnabled={false}
        listening={false}
      />
      <Label
        x={0}
        y={0}
        scaleX={1 / scale}
        scaleY={1 / scale}
        offsetX={36}
        offsetY={9}
        rotation={-item.rotation}
        listening={false}
      >
        <Tag fill="#ffffff" opacity={0.85} cornerRadius={3} />
        <Text
          text={item.elevation > 0 ? `${width} ↑${item.elevation}` : String(width)}
          fontSize={12}
          padding={3}
          width={72}
          align="center"
          fill="#0f172a"
        />
      </Label>
    </Group>
  )
}
