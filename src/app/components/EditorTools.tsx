import { useAppStore, type Tool } from '@/application/project'
import { UTILITY_COLORS, UTILITY_LABELS, UTILITY_TYPES } from '@/domain/model'

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'select', label: 'Выбрать' },
  { value: 'wall', label: 'Стена' },
  { value: 'window', label: 'Окно' },
  { value: 'door', label: 'Дверь' },
  { value: 'utility', label: 'Коммуникация' },
  { value: 'pan', label: 'Панорама' },
]

export function EditorTools() {
  const tool = useAppStore((s) => s.tool)
  const setTool = useAppStore((s) => s.setTool)
  const ortho = useAppStore((s) => s.orthoSnap)
  const setOrthoSnap = useAppStore((s) => s.setOrthoSnap)
  const smartPlacement = useAppStore((s) => s.smartPlacement)
  const setSmartPlacement = useAppStore((s) => s.setSmartPlacement)
  const utilityType = useAppStore((s) => s.utilityType)
  const setUtilityType = useAppStore((s) => s.setUtilityType)
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Инструменты</h2>
      <div className="flex flex-col gap-1.5">
        {TOOLS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTool(option.value)}
            className={`rounded-md border px-3 py-2 text-left text-sm font-medium ${
              tool === option.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {tool === 'utility' && (
        <div className="mt-2 flex flex-wrap gap-1">
          {UTILITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setUtilityType(type)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                utilityType === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: UTILITY_COLORS[type] }} />
              {UTILITY_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={ortho}
          onChange={(e) => setOrthoSnap(e.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
        Углы 90°
      </label>
      <label
        className="mt-1.5 flex items-center gap-2 text-sm text-slate-600"
        title="Привязка к стенам и соседям, автоматический обход мебели, окон и зоны открывания дверей"
      >
        <input
          type="checkbox"
          checked={smartPlacement}
          onChange={(e) => setSmartPlacement(e.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
        Умная расстановка
      </label>
    </section>
  )
}
