import { useAppStore } from '../../shared/store'
import { BLOCK_PRESETS, PRESET_CATEGORIES } from './catalog'

export function LibraryPanel() {
  const addBlock = useAppStore((s) => s.addBlock)

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Библиотека</h2>
      {PRESET_CATEGORIES.map((category) => (
        <div key={category}>
          <h3 className="mb-1.5 text-xs text-slate-400">{category}</h3>
          <div className="flex flex-col gap-1.5">
            {BLOCK_PRESETS.filter((preset) => preset.category === category).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => addBlock(preset)}
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-blue-400 hover:shadow-sm"
              >
                <span
                  className="h-7 w-7 shrink-0 rounded border border-slate-300"
                  style={{ backgroundColor: preset.params.facadeColor }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{preset.label}</span>
                  <span className="block text-xs text-slate-500">
                    {preset.params.width}×{preset.params.depth} мм
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
