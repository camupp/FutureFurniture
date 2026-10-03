import { Circle, Group, Label, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { UTILITY_COLORS, UTILITY_LABELS, type Point, type Utility } from '@/domain/model'

const MARKER_RADIUS_PX = 11

type Props = {
  utility: Utility
  point: Point
  selected: boolean
  invalid: boolean
  connected: boolean
  draggable: boolean
  scale: number
  onSelect: () => void
  onMove: (point: Point) => void
}

/** Вывод коммуникаций: кружок с обозначением и отметкой высоты, как на инженерном плане. */
export function UtilityShape({
  utility,
  point,
  selected,
  invalid,
  connected,
  draggable,
  scale,
  onSelect,
  onMove,
}: Props) {
  const color = UTILITY_COLORS[utility.type]
  const radius = MARKER_RADIUS_PX / scale
  const symbol = { water: 'В', sewer: 'К', gas: 'Г', vent: 'Вн', power: 'Р' }[utility.type]

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onMove({ x: e.target.x(), y: e.target.y() })
  }

  return (
    <Group
      x={point.x}
      y={point.y}
      draggable={draggable}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDragEnd={handleDragEnd}
    >
      <Circle
        radius={radius}
        fill={invalid ? '#fef2f2' : '#ffffff'}
        stroke={invalid ? '#dc2626' : selected ? '#2563eb' : connected ? '#059669' : color}
        strokeWidth={selected ? 3 : 2}
        strokeScaleEnabled={false}
      />
      {utility.type === 'water' ? (
        <>
          <Circle x={-3.2 / scale} radius={2.6 / scale} fill="#2563eb" listening={false} />
          <Circle x={3.2 / scale} radius={2.6 / scale} fill="#dc2626" listening={false} />
        </>
      ) : (
        <Text
          x={-radius}
          y={-5 / scale}
          width={radius * 2}
          text={symbol}
          align="center"
          fontSize={10 / scale}
          fontStyle="bold"
          fill={color}
          listening={false}
        />
      )}
      <Label x={0} y={0} scaleX={1 / scale} scaleY={1 / scale} offsetX={-14} offsetY={8} listening={false}>
        <Tag fill="#ffffff" opacity={0.9} cornerRadius={3} />
        <Text
          text={`${UTILITY_LABELS[utility.type]}${utility.type === 'power' ? ` ×${utility.socketCount ?? 2}` : ''} · ${utility.mount.kind === 'wall' ? `↑${utility.height}` : 'пол'}`}
          fontSize={11}
          padding={3}
          fill="#0f172a"
        />
      </Label>
    </Group>
  )
}
