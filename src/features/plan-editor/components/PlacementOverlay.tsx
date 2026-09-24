import { Group, Label, Line, Tag, Text } from 'react-konva'
import type { FurnitureItem } from '@/domain/model'
import { itemFootprint } from '@/domain/geometry/geometry'
import type { Clearance } from '@/domain/placement/clearances'
import type { AlignmentGuide } from '@/domain/placement/guides'

export function PlacementOverlay({
  gaps,
  guides,
  furniture,
  scale,
}: {
  gaps: Clearance[]
  guides: AlignmentGuide[]
  furniture: FurnitureItem[]
  scale: number
}) {
  const targets = new Set(guides.map((guide) => guide.targetId))
  return (
    <Group listening={false}>
      {furniture
        .filter((item) => targets.has(item.id))
        .map((item) => (
          <Line
            key={`target:${item.id}`}
            points={itemFootprint(item).flatMap((point) => [point.x, point.y])}
            closed
            stroke="#059669"
            strokeWidth={3}
            strokeScaleEnabled={false}
          />
        ))}
      {guides.map((guide, index) => (
        <Line
          key={`guide:${index}`}
          points={[guide.start.x, guide.start.y, guide.end.x, guide.end.y]}
          stroke="#059669"
          strokeWidth={guide.kind === 'contact' ? 4 : 1.5}
          dash={guide.kind === 'contact' ? undefined : [7 / scale, 4 / scale]}
          strokeScaleEnabled={false}
        />
      ))}
      {gaps
        .filter((gap) => gap.distance >= 1)
        .map((gap) => {
          const tick = { x: (-gap.direction.y * 4) / scale, y: (gap.direction.x * 4) / scale }
          return (
            <Group key={gap.side}>
              <Line
                points={[gap.start.x, gap.start.y, gap.end.x, gap.end.y]}
                stroke="#2563eb"
                strokeWidth={1}
                dash={[4 / scale, 3 / scale]}
                strokeScaleEnabled={false}
              />
              {[gap.start, gap.end].map((point, index) => (
                <Line
                  key={index}
                  points={[point.x - tick.x, point.y - tick.y, point.x + tick.x, point.y + tick.y]}
                  stroke="#2563eb"
                  strokeWidth={1.5}
                  strokeScaleEnabled={false}
                />
              ))}
              <Label
                x={(gap.start.x + gap.end.x) / 2}
                y={(gap.start.y + gap.end.y) / 2}
                scaleX={1 / scale}
                scaleY={1 / scale}
                offsetX={32}
                offsetY={10}
              >
                <Tag fill="#eff6ff" opacity={0.95} cornerRadius={3} />
                <Text
                  text={`${Math.round(gap.distance)} мм`}
                  fontSize={11}
                  padding={4}
                  width={64}
                  align="center"
                  fill="#1d4ed8"
                />
              </Label>
            </Group>
          )
        })}
    </Group>
  )
}
