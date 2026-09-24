import { useState } from 'react'
import { useAppStore } from '@/application/project'
import type { FurnitureItem, Room } from '@/domain/model'
import { CLEARANCE_LABELS, furnitureClearances } from '@/domain/placement/clearances'
import { NumberField } from '@/shared/ui/NumberField'

export function ClearanceControls({
  item,
  room,
  furniture,
}: {
  item: FurnitureItem
  room: Room
  furniture: FurnitureItem[]
}) {
  const apply = useAppStore((state) => state.setFurnitureClearance)
  const [failure, setFailure] = useState<{ item: FurnitureItem; message: string } | null>(null)
  const gaps = furnitureClearances(item, room, furniture)
  if (item.autoCountertop || gaps.length === 0) return null
  return (
    <section aria-label="Точные зазоры" className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5">
      <h3 className="text-xs font-medium text-slate-700">Зазоры до препятствий</h3>
      <p className="text-xs text-slate-500">
        От грани корпуса, на высоте блока. Изменение зазора перемещает только выбранный блок.
      </p>
      {gaps.map((gap) => (
        <NumberField
          key={`${gap.side}:${gap.kind}:${gap.targetId}`}
          label={`${CLEARANCE_LABELS[gap.side]} · ${gap.label}`}
          value={Math.round(gap.distance)}
          min={0}
          max={50000}
          step={1}
          slider={false}
          onChange={(distance) => {
            const message = apply(item.id, gap, distance)
            setFailure(message ? { item, message } : null)
          }}
        />
      ))}
      {failure?.item === item && (
        <p role="alert" className="text-xs text-red-700">
          {failure.message}
        </p>
      )}
    </section>
  )
}
