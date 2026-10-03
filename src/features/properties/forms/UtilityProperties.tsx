import { selectedUtility, useAppStore } from '@/application/project'
import { UTILITY_COLORS, UTILITY_LABELS, UTILITY_TYPES } from '@/domain/model'
import { roomPolygon } from '@/domain/geometry/geometry'
import { pointInPolygon } from '@/shared/lib/geometry2d'
import { utilityPoint } from '@/domain/room/utilities'
import { connectedUtilityIds } from '@/domain/validation/rules'
import { HistoryNumberField as NumberField } from '../HistoryNumberField'
import { DangerButton } from '@/shared/ui/DangerButton'

export function UtilityProperties() {
  const utility = useAppStore(selectedUtility)
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const updateUtility = useAppStore((s) => s.updateUtility)
  const moveUtility = useAppStore((s) => s.moveUtility)
  const removeUtility = useAppStore((s) => s.removeUtility)
  if (!utility) return null
  const polygon = roomPolygon(room.walls)
  const point = utilityPoint(utility, room)
  const wallMount = utility.mount.kind === 'wall' ? utility.mount : null
  const outside = polygon.length >= 3 && !pointInPolygon(point, polygon)
  const connected = connectedUtilityIds(furniture, room).has(utility.id)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-800">{UTILITY_LABELS[utility.type]}</p>
      <p className="-mt-3 text-xs text-slate-500">
        {utility.mount.kind === 'wall' ? 'Крепление: стена' : 'Крепление: пол'}
      </p>
      {outside && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Вывод находится за контуром стен</p>
      )}
      {connected ? (
        <p className="rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
          {utility.type === 'power'
            ? 'Розетка в пределах эскизной досягаемости техники (нагрузка не проверена)'
            : 'Вывод подходит установленной сборке'}
        </p>
      ) : utility.type !== 'power' && !outside ? (
        <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          Вывод пока не связан с совместимым оборудованием
        </p>
      ) : null}

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Тип</span>
        <div className="flex flex-wrap gap-1">
          {UTILITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateUtility(utility.id, { type })}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                utility.type === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: UTILITY_COLORS[type] }} />
              {UTILITY_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {utility.type === 'power' && (
        <label className="block text-xs font-medium text-slate-600">
          Гнёзд в розетке
          <select
            value={utility.socketCount ?? 2}
            onChange={(event) => updateUtility(utility.id, { socketCount: Number(event.target.value) as 1 | 2 })}
            className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800"
          >
            <option value={1}>Одно</option>
            <option value={2}>Два</option>
          </select>
        </label>
      )}

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Положение</span>
        {wallMount ? (
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField
              label="От угла"
              value={Math.round(wallMount.offset)}
              min={0}
              max={20000}
              step={10}
              slider={false}
              onChange={(offset) => updateUtility(utility.id, { mount: { ...wallMount, offset } })}
            />
            <NumberField
              label="Z"
              value={utility.height}
              min={0}
              max={room.wallHeight}
              step={10}
              slider={false}
              onChange={(height) => updateUtility(utility.id, { height })}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField
              label="X"
              value={Math.round(point.x)}
              min={-50000}
              max={50000}
              step={10}
              slider={false}
              onChange={(x) => moveUtility(utility.id, { ...point, x })}
            />
            <NumberField
              label="Y"
              value={Math.round(point.y)}
              min={-50000}
              max={50000}
              step={10}
              slider={false}
              onChange={(y) => moveUtility(utility.id, { ...point, y })}
            />
          </div>
        )}
      </div>

      <DangerButton onClick={() => removeUtility(utility.id)}>Удалить вывод</DangerButton>
    </div>
  )
}
