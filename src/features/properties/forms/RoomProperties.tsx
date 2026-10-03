import { useAppStore } from '@/application/project'
import { POWER_REACH_DEFAULT, POWER_REACH_LIMITS, WALL_LIMITS } from '@/domain/model'
import { HistoryNumberField as NumberField } from '../HistoryNumberField'

export function RoomProperties() {
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const setWallHeight = useAppStore((s) => s.setWallHeight)
  const setPowerReach = useAppStore((s) => s.setPowerReach)

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
      <NumberField
        label="Досягаемость розетки, мм"
        value={room.powerReachMm ?? POWER_REACH_DEFAULT}
        min={POWER_REACH_LIMITS.min}
        max={POWER_REACH_LIMITS.max}
        step={POWER_REACH_LIMITS.step}
        onChange={setPowerReach}
      />
      <p className="-mt-3 text-xs text-slate-500">
        Эскизная оценка от задней части техники. Длину кабеля и нагрузку нужно проверить на объекте.
      </p>
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
