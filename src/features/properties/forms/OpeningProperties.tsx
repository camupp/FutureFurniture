import { selectedOpening, useAppStore } from '@/application/project'
import { OPENING_LABELS, OPENING_LIMITS } from '@/domain/model'
import { wallLength } from '@/domain/geometry/geometry'
import { openingsOverlap } from '@/domain/validation/rules'
import { NumberField } from '@/shared/ui/NumberField'
import { DangerButton } from '@/shared/ui/DangerButton'

export function OpeningProperties() {
  const opening = useAppStore(selectedOpening)
  const room = useAppStore((s) => s.room)
  const updateOpening = useAppStore((s) => s.updateOpening)
  const moveOpening = useAppStore((s) => s.moveOpening)
  const removeOpening = useAppStore((s) => s.removeOpening)
  if (!opening) return null

  const wall = room.walls.find((candidate) => candidate.id === opening.wallId)
  const wallSize = wall ? wallLength(wall) : OPENING_LIMITS.width.max
  const maxWidth = Math.min(OPENING_LIMITS.width.max, wallSize)
  const minOffset = opening.width / 2
  const maxOffset = Math.max(minOffset, wallSize - opening.width / 2)
  const overlaps = room.openings.some((other) => openingsOverlap(opening, other, room))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-800">{OPENING_LABELS[opening.type]}</p>
      {overlaps && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Проём пересекается с другим проёмом</p>
      )}

      <NumberField
        label="Ширина"
        value={opening.width}
        min={OPENING_LIMITS.width.min}
        max={maxWidth}
        step={OPENING_LIMITS.width.step}
        onChange={(width) => updateOpening(opening.id, { width })}
      />
      <NumberField
        label="Высота"
        value={opening.height}
        min={OPENING_LIMITS.height.min}
        max={Math.min(OPENING_LIMITS.height.max, room.wallHeight - opening.sill)}
        step={OPENING_LIMITS.height.step}
        onChange={(height) => updateOpening(opening.id, { height })}
      />
      <NumberField
        label="Низ от пола"
        value={opening.sill}
        min={OPENING_LIMITS.sill.min}
        max={opening.type === 'door' ? 0 : Math.min(OPENING_LIMITS.sill.max, room.wallHeight - opening.height)}
        step={OPENING_LIMITS.sill.step}
        onChange={(sill) => updateOpening(opening.id, { sill })}
      />
      <NumberField
        label="Центр от начала стены"
        value={Math.round(opening.offset)}
        min={minOffset}
        max={maxOffset}
        step={10}
        slider={false}
        onChange={(offset) => moveOpening(opening.id, offset)}
      />

      {opening.type === 'door' && (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Петли</span>
          <div className="flex gap-1.5">
            {(['left', 'right'] as const).map((hinge) => (
              <button
                key={hinge}
                type="button"
                onClick={() => updateOpening(opening.id, { hinge })}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  opening.hinge === hinge
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {hinge === 'left' ? 'Слева' : 'Справа'}
              </button>
            ))}
          </div>
        </div>
      )}

      <DangerButton onClick={() => removeOpening(opening.id)}>
        Удалить {OPENING_LABELS[opening.type].toLowerCase()}
      </DangerButton>
    </div>
  )
}
