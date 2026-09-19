import { useAppStore } from '../../shared/store'
import { DEFAULT_CABINET } from '../../shared/types'

export function LibraryPanel() {
  const addCabinet = useAppStore((s) => s.addCabinet)

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Библиотека</h2>
      <button
        type="button"
        onClick={addCabinet}
        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400 hover:shadow-sm"
      >
        <div className="mb-2 flex h-16 items-end justify-center rounded bg-slate-50">
          <div
            className="h-10 w-14 rounded-t border border-slate-300"
            style={{ backgroundColor: DEFAULT_CABINET.facadeColor }}
          />
        </div>
        <div className="text-sm font-medium text-slate-800">Шкаф напольный</div>
        <div className="text-xs text-slate-500">
          {DEFAULT_CABINET.width}×{DEFAULT_CABINET.height}×{DEFAULT_CABINET.depth} мм
        </div>
      </button>
    </section>
  )
}
