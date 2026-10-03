type Props = {
  x: number
  y: number
  containerWidth: number
  containerHeight: number
  canGroup: boolean
  canUngroup: boolean
  onGroup: () => void
  onUngroup: () => void
}

export function GroupContextMenu({
  x,
  y,
  containerWidth,
  containerHeight,
  canGroup,
  canUngroup,
  onGroup,
  onUngroup,
}: Props) {
  return (
    <div
      data-group-menu
      className="absolute z-30 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
      style={{
        left: Math.min(x, Math.max(0, containerWidth - 190)),
        top: Math.min(y, Math.max(0, containerHeight - 110)),
      }}
    >
      <button
        type="button"
        disabled={!canGroup}
        className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
        onClick={onGroup}
      >
        Группировать
      </button>
      <button
        type="button"
        disabled={!canUngroup}
        className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
        onClick={onUngroup}
      >
        Разгруппировать
      </button>
    </div>
  )
}
