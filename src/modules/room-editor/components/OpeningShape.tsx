import { Arc, Group, Label, Line, Rect, Tag, Text } from 'react-konva'
import type Konva from 'konva'
import { OPENING_LABELS, type Opening, type Wall } from '../../../shared/types'
import { wallAngle, wallLength } from '../../../shared/utils/geometry'
import { DOOR_SWING_CLEARANCE } from '../../../shared/utils/openings'
import { clamp } from '../../../shared/utils/units'

type Props = {
  opening: Opening
  wall: Wall
  /** Смещение центра проёма от начала стены, уже зажатое по её длине. */
  offset: number
  selected: boolean
  invalid: boolean
  draggable: boolean
  scale: number
  /** Какая сторона локальной оси Y стены направлена внутрь комнаты. */
  inwardSign: 1 | -1
  onSelect: () => void
  onMove: (offset: number) => void
}

/**
 * Проём на плане рисуется по чертёжным обозначениям: разрыв в стене, створка,
 * у двери — полотно и дуга открывания.
 *
 * Внешняя группа стоит в начале стены и повёрнута по ней, поэтому позиция
 * внутренней группы по x — это и есть смещение вдоль стены, а y = 0 держит
 * проём в плоскости стены при перетаскивании.
 */
export function OpeningShape({
  opening,
  wall,
  offset,
  selected,
  invalid,
  draggable,
  scale,
  inwardSign,
  onSelect,
  onMove,
}: Props) {
  const angleDeg = (wallAngle(wall) * 180) / Math.PI
  const half = opening.width / 2
  const maxOffset = Math.max(half, wallLength(wall) - half)
  const stroke = invalid ? '#dc2626' : selected ? '#2563eb' : '#0f172a'
  const hingeX = opening.hinge === 'left' ? -half : half
  const arcRotation = inwardSign > 0 ? (opening.hinge === 'left' ? 0 : 90) : opening.hinge === 'left' ? -90 : 180

  const constrain = (node: Konva.Node) => {
    node.y(0)
    node.x(clamp(node.x(), half, maxOffset))
  }

  return (
    <Group x={wall.start.x} y={wall.start.y} rotation={angleDeg}>
      <Group
        x={offset}
        y={0}
        draggable={draggable}
        onMouseDown={onSelect}
        onTouchStart={onSelect}
        onDragMove={(e) => constrain(e.target)}
        onDragEnd={(e) => {
          constrain(e.target)
          onMove(e.target.x())
        }}
      >
        {/* Разрыв стены. */}
        <Rect
          x={-half}
          y={-wall.thickness / 2}
          width={opening.width}
          height={wall.thickness}
          fill={invalid ? '#fef2f2' : '#ffffff'}
          stroke={stroke}
          strokeWidth={selected ? 2.5 : 1.5}
          strokeScaleEnabled={false}
        />

        {opening.type === 'window' ? (
          <Line
            points={[-half, 0, half, 0]}
            stroke={stroke}
            strokeWidth={3}
            strokeScaleEnabled={false}
            listening={false}
          />
        ) : (
          <>
            <Arc
              x={hingeX}
              y={0}
              innerRadius={0}
              outerRadius={opening.width + DOOR_SWING_CLEARANCE}
              angle={90}
              rotation={arcRotation}
              fill={invalid ? '#fecaca' : '#f59e0b'}
              opacity={0.12}
              stroke={invalid ? '#dc2626' : '#f59e0b'}
              strokeWidth={1}
              dash={[10, 8]}
              strokeScaleEnabled={false}
              listening={false}
            />
            <Line
              points={[hingeX, 0, hingeX, opening.width * inwardSign]}
              stroke={stroke}
              strokeWidth={2.5}
              strokeScaleEnabled={false}
              listening={false}
            />
            <Arc
              x={hingeX}
              y={0}
              innerRadius={opening.width}
              outerRadius={opening.width}
              angle={90}
              rotation={arcRotation}
              stroke={stroke}
              strokeWidth={1}
              dash={[12, 8]}
              strokeScaleEnabled={false}
              listening={false}
            />
          </>
        )}

        <Label
          x={0}
          y={0}
          scaleX={1 / scale}
          scaleY={1 / scale}
          rotation={-angleDeg}
          offsetX={36}
          offsetY={-12}
          listening={false}
        >
          <Tag fill="#ffffff" opacity={0.9} cornerRadius={3} />
          <Text
            text={`${OPENING_LABELS[opening.type]} ${opening.width}`}
            fontSize={11}
            padding={3}
            width={72}
            align="center"
            fill="#0f172a"
          />
        </Label>
      </Group>
    </Group>
  )
}
