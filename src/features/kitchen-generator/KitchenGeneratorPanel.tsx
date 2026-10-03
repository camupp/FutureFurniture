import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/application/project'
import { HOB_CONNECTIONS, HOB_CONNECTION_LABELS, type FurnitureItem, type HobConnection } from '@/domain/model'
import { boundaryWalls, wallLength } from '@/domain/geometry/geometry'
import { generateStraightKitchen } from '@/domain/generation/straightKitchen'

type Props = {
  onPreview: (items: FurnitureItem[]) => void
  onClose: () => void
}

function cabinetName(item: FurnitureItem): string {
  const role = item.cabinetModule?.familyId === 'base-storage' ? item.cabinetModule.role : 'storage'
  if (role === 'sink') return 'База под мойку'
  if (role === 'hob') return 'База под плиту'
  if (role === 'oven') return 'База с духовкой'
  if (role === 'dishwasher') return 'Посудомойка'
  return item.cabinetModule?.facade === 'three-drawers' ? 'Рабочая база с ящиками' : 'База хранения'
}

export function KitchenGeneratorPanel({ onPreview, onClose }: Props) {
  const room = useAppStore((state) => state.room)
  const furniture = useAppStore((state) => state.furniture)
  const activeProjectId = useAppStore((state) => state.activeProjectId)
  const selection = useAppStore((state) => state.selection)
  const apply = useAppStore((state) => state.applyStraightKitchen)
  const walls = useMemo(() => boundaryWalls(room.walls), [room.walls])
  const [wallId, setWallId] = useState(() =>
    selection?.kind === 'wall' && walls.some((wall) => wall.id === selection.id) ? selection.id : (walls[0]?.id ?? ''),
  )
  const [includeSink, setIncludeSink] = useState(true)
  const [includeHob, setIncludeHob] = useState(true)
  const [hobConnection, setHobConnection] = useState<HobConnection>('unknown')
  const [includeOven, setIncludeOven] = useState(false)
  const [includeDishwasher, setIncludeDishwasher] = useState(false)
  const [includeFridge, setIncludeFridge] = useState(false)
  const [minPrepWidth, setMinPrepWidth] = useState<600 | 1200>(600)
  const [storagePreference, setStoragePreference] = useState<'balanced' | 'more-storage'>('balanced')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!walls.some((wall) => wall.id === wallId)) setWallId(walls[0]?.id ?? '')
  }, [walls, wallId])

  const result = useMemo(
    () =>
      generateStraightKitchen(room, furniture, {
        wallId,
        includeSink,
        includeHob,
        hobConnection,
        includeOven,
        includeDishwasher,
        includeFridge,
        minPrepWidth,
        storagePreference,
      }),
    [
      room,
      furniture,
      wallId,
      includeSink,
      includeHob,
      hobConnection,
      includeOven,
      includeDishwasher,
      includeFridge,
      minPrepWidth,
      storagePreference,
    ],
  )
  useEffect(() => {
    onPreview(result.proposal?.items ?? [])
    return () => onPreview([])
  }, [onPreview, result.proposal])

  const cabinets = result.proposal?.items.filter((item) => item.type === 'cabinet') ?? []

  const accept = () => {
    if (!result.proposal) return
    const issue = apply(result.proposal, activeProjectId)
    if (issue) {
      setError(issue)
      return
    }
    onPreview([])
    onClose()
  }

  return (
    <aside
      role="dialog"
      aria-label="Собрать прямую кухню"
      className="absolute top-16 right-4 z-20 flex max-h-[calc(100%-5rem)] w-[360px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Собрать прямую кухню</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Предпросмотр обновляется при изменении условий и не сохраняет проект
          </p>
        </div>
        <button
          type="button"
          aria-label="Закрыть генератор"
          className="text-slate-500 hover:text-slate-900"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto px-4 py-3 text-sm">
        <label className="block text-xs font-medium text-slate-600" htmlFor="generator-wall">
          Стена для ряда
        </label>
        <select
          id="generator-wall"
          value={wallId}
          onChange={(event) => {
            setError(null)
            setWallId(event.target.value)
          }}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
        >
          {walls.length === 0 && <option value="">Нет замкнутого контура</option>}
          {walls.map((wall) => (
            <option key={wall.id} value={wall.id}>
              Стена {room.walls.indexOf(wall) + 1} · {Math.round(wallLength(wall))} мм
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeSink}
            onChange={(event) => {
              setIncludeSink(event.target.checked)
              if (!event.target.checked) setIncludeDishwasher(false)
            }}
          />
          Мойка
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeHob} onChange={(event) => setIncludeHob(event.target.checked)} />
          Кухонная плита
        </label>
        {includeHob && (
          <label className="block text-xs font-medium text-slate-600" htmlFor="generator-hob-connection">
            Тип кухонной плиты
            <select
              id="generator-hob-connection"
              value={hobConnection}
              onChange={(event) => setHobConnection(event.target.value as HobConnection)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              {HOB_CONNECTIONS.map((connection) => (
                <option key={connection} value={connection}>
                  {HOB_CONNECTION_LABELS[connection]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeOven} onChange={(event) => setIncludeOven(event.target.checked)} />
          Духовка {includeHob ? 'под плитой' : 'под столешницей'}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeDishwasher}
            disabled={!includeSink}
            onChange={(event) => setIncludeDishwasher(event.target.checked)}
          />
          Посудомойка рядом с мойкой
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeFridge} onChange={(event) => setIncludeFridge(event.target.checked)} />
          Отдельный холодильник с края ряда
        </label>
        <label className="block text-xs font-medium text-slate-600" htmlFor="generator-prep">
          Рабочая поверхность между зонами
        </label>
        <select
          id="generator-prep"
          value={minPrepWidth}
          onChange={(event) => setMinPrepWidth(Number(event.target.value) as 600 | 1200)}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
        >
          <option value={600}>От 600 мм</option>
          <option value={1200}>От 1200 мм</option>
        </select>
        <label className="block text-xs font-medium text-slate-600" htmlFor="generator-storage">
          Приоритет хранения
        </label>
        <select
          id="generator-storage"
          value={storagePreference}
          onChange={(event) => setStoragePreference(event.target.value as 'balanced' | 'more-storage')}
          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
        >
          <option value="balanced">Баланс с коммуникациями</option>
          <option value="more-storage">Больше шкафов</option>
        </select>

        {result.proposal ? (
          <section aria-label="Предложенный ряд" className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="font-medium text-blue-900">
              {result.proposal.moduleCount} тумб{includeFridge ? ' + холодильник' : ''} · {result.proposal.rowWidth} мм
            </p>
            <ol className="mt-2 list-inside list-decimal space-y-0.5 text-xs text-blue-900">
              {cabinets.map((item) => (
                <li key={item.id}>
                  {cabinetName(item)} · {item.params.width} мм
                </li>
              ))}
            </ol>
            {includeFridge && <p className="mt-1 text-xs text-blue-900">Холодильник · 600 мм</p>}
            {result.proposal.utilityFit.marked > 0 && (
              <p className="mt-2 text-xs text-blue-900">
                Совпало с отмеченными выводами: {result.proposal.utilityFit.matched} из{' '}
                {result.proposal.utilityFit.marked} требований.
              </p>
            )}
            {result.proposal.utilityFit.unmarked > 0 && (
              <p className="mt-1 text-xs text-blue-800">
                Для {result.proposal.utilityFit.unmarked} требований вывод на плане не отмечен.
              </p>
            )}
            <p className="mt-2 text-xs text-blue-800">Столешница и выбранная техника добавятся вместе с рядом.</p>
          </section>
        ) : null}

        {result.diagnostics.map((diagnostic, index) => (
          <p
            key={`${diagnostic.code}-${index}`}
            role={diagnostic.severity === 'error' ? 'alert' : 'status'}
            className={`rounded-md px-2.5 py-2 text-xs ${
              diagnostic.severity === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'
            }`}
          >
            {diagnostic.message}
          </p>
        ))}
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-800">
            {error}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Это эскиз: реальные подключения, монтажные зазоры и спецификацию нужно проверить на объекте.
        </p>
      </div>

      <div className="flex gap-2 border-t border-slate-200 p-3">
        <button type="button" onClick={onClose} className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
          Отмена
        </button>
        <button
          type="button"
          disabled={!result.proposal}
          onClick={accept}
          className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Принять вариант
        </button>
      </div>
    </aside>
  )
}
