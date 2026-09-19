import { useAppStore, type EditorView, type Tool, type ViewMode } from '../shared/store'
import { ElevationEditor } from '../modules/elevation-editor/ElevationEditor'
import { LibraryPanel } from '../modules/furniture-library/LibraryPanel'
import { PropertiesPanel } from '../modules/properties/PropertiesPanel'
import { RoomEditor } from '../modules/room-editor/RoomEditor'
import { Scene3D } from '../modules/scene-3d/Scene3D'
import { downloadSceneScreenshot } from '../modules/scene-3d/screenshot'

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'select', label: 'Выбрать' },
  { value: 'wall', label: 'Стена' },
  { value: 'pan', label: 'Панорама' },
]

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: '2d', label: '2D' },
  { value: 'split', label: '2D + 3D' },
  { value: '3d', label: '3D' },
]

const EDITOR_VIEWS: { value: EditorView; label: string }[] = [
  { value: 'plan', label: 'План' },
  { value: 'elevation', label: 'По высоте' },
]

export function App() {
  const tool = useAppStore((s) => s.tool)
  const setTool = useAppStore((s) => s.setTool)
  const ortho = useAppStore((s) => s.orthoSnap)
  const setOrthoSnap = useAppStore((s) => s.setOrthoSnap)
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const editorView = useAppStore((s) => s.editorView)
  const setEditorView = useAppStore((s) => s.setEditorView)
  const clearRoom = useAppStore((s) => s.clearRoom)

  const handleClear = () => {
    if (confirm('Удалить все стены и блоки проекта?')) clearRoom()
  }

  return (
    <div className="flex h-full flex-col overflow-x-auto bg-slate-100 text-slate-900">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2.5">
        <h1 className="text-sm font-semibold">Замер кухни</h1>
        <div className="flex items-center gap-2">
          {viewMode !== '3d' && (
            <SegmentedControl options={EDITOR_VIEWS} value={editorView} onChange={setEditorView} />
          )}
          <SegmentedControl options={VIEW_MODES} value={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={downloadSceneScreenshot}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Скриншот
          </button>
        </div>
      </header>

      {/* Целевое устройство — планшет в альбомной ориентации; на узком экране
          раскладка не схлопывается, а прокручивается по горизонтали. */}
      <div className="flex min-h-0 min-w-[900px] flex-1">
        <nav className="flex w-52 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-4">
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
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={ortho}
                onChange={(e) => setOrthoSnap(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Углы 90°
            </label>
          </section>

          <LibraryPanel />

          <button
            type="button"
            onClick={handleClear}
            className="mt-auto rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Очистить проект
          </button>
        </nav>

        <main className="flex min-w-0 flex-1">
          {viewMode !== '3d' && (editorView === 'plan' ? <RoomEditor /> : <ElevationEditor />)}
          {viewMode === 'split' && <div className="w-px shrink-0 bg-slate-300" />}
          {viewMode !== '2d' && <Scene3D />}
        </main>

        <PropertiesPanel />
      </div>
    </div>
  )
}

type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex rounded-md border border-slate-200 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded px-2.5 py-1 text-sm font-medium ${
            value === option.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
