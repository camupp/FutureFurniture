import { useAppStore } from '@/application/project'
import { WALL_LIMITS } from '@/domain/model'
import { NumberField } from '@/shared/ui/NumberField'

export function RoomProperties() {
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const setWallHeight = useAppStore((s) => s.setWallHeight)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">Ничего не выбрано. Выберите объект на плане.</p>
      <NumberField
        label="Высота стен"
        value={room.wallHeight}
        min={WALL_LIMITS.height.min}
        max={WALL_LIMITS.height.max}
        step={WALL_LIMITS.height.step}
        onChange={setWallHeight}
      />
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-slate-500">Стен</dt>
        <dd className="text-right text-slate-800">{room.walls.length}</dd>
        <dt className="text-slate-500">Блоков</dt>
        <dd className="text-right text-slate-800">{furniture.length}</dd>
        <dt className="text-slate-500">Проёмов</dt>
        <dd className="text-right text-slate-800">{room.openings.length}</dd>
        <dt className="text-slate-500">Выводов</dt>
        <dd className="text-right text-slate-800">{room.utilities.length}</dd>
      </dl>
    </div>
  )
}
