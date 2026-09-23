import {
  OPENING_LABELS,
  UTILITY_COLORS,
  UTILITY_LABELS,
  type OpeningType,
  type Point,
  type UtilityType,
} from '@/domain/model'

export type AddContextTarget =
  | { kind: 'wall'; wallId: string; offset: number; point: Point; x: number; y: number }
  | { kind: 'floor'; point: Point; x: number; y: number }

type Props = {
  target: AddContextTarget
  containerWidth: number
  containerHeight: number
  onAddOpening: (type: OpeningType) => void
  onAddUtility: (type: UtilityType) => void
  onClose: () => void
}

const WALL_UTILITIES: UtilityType[] = ['water', 'sewer', 'gas', 'power', 'vent']
const FLOOR_UTILITIES: UtilityType[] = ['sewer', 'water', 'power']

export function AddContextMenu({
  target,
  containerWidth,
  containerHeight,
  onAddOpening,
  onAddUtility,
  onClose,
}: Props) {
  const menuWidth = 224
  const estimatedHeight = target.kind === 'wall' ? 348 : 218
  const left = Math.max(8, Math.min(target.x, containerWidth - menuWidth - 8))
  const top = Math.max(8, Math.min(target.y, containerHeight - estimatedHeight - 8))
  const utilities = target.kind === 'wall' ? WALL_UTILITIES : FLOOR_UTILITIES

  return (
    <div
      data-context-menu
      className="absolute z-30 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      style={{ left, top }}
      role="menu"
      aria-label={target.kind === 'wall' ? 'Добавить на стену' : 'Добавить на пол'}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {target.kind === 'wall' ? 'Добавить на стену' : 'Добавить на пол'}
        </span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Закрыть меню"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {target.kind === 'wall' && (
        <div className="border-b border-slate-100 p-1.5">
          {(['window', 'door'] as OpeningType[]).map((type) => (
            <button
              key={type}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
              onClick={() => onAddOpening(type)}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-[10px] font-bold">
                {type === 'window' ? 'О' : 'Д'}
              </span>
              {OPENING_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      <div className="p-1.5">
        {utilities.map((type) => (
          <button
            key={type}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => onAddUtility(type)}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm"
              style={{ backgroundColor: UTILITY_COLORS[type] }}
            />
            {UTILITY_LABELS[type]}
            {target.kind === 'floor' && type === 'sewer' && (
              <span className="ml-auto text-[10px] text-slate-400">из пола</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
