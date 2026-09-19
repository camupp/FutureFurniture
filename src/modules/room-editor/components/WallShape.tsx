import { Circle, Label, Line, Tag, Text } from 'react-konva'
import type { Wall } from '../../../shared/types'
import { wallCenter, wallLength } from '../../../shared/utils/geometry'

type Props = {
  wall: Wall
  selected: boolean
  scale: number
  onSelect: () => void
}

export function WallShape({ wall, selected, scale, onSelect }: Props) {
  const center = wallCenter(wall)
  const length = Math.round(wallLength(wall))

  return (
    <>
      <Line
        points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
        stroke={selected ? '#2563eb' : '#64748b'}
        strokeWidth={wall.thickness}
        hitStrokeWidth={Math.max(wall.thickness, 24 / scale)}
        lineCap="butt"
        onMouseDown={onSelect}
        onTouchStart={onSelect}
      />
      <Circle
        x={wall.start.x}
        y={wall.start.y}
        radius={5 / scale}
        fill="#ffffff"
        stroke="#475569"
        strokeWidth={1}
        strokeScaleEnabled={false}
        listening={false}
      />
      <Label x={center.x} y={center.y} scaleX={1 / scale} scaleY={1 / scale} offsetX={20} offsetY={9} listening={false}>
        <Tag fill="#ffffff" opacity={0.92} cornerRadius={3} />
        <Text text={String(length)} fontSize={12} padding={3} width={40} align="center" fill="#0f172a" />
      </Label>
    </>
  )
}
