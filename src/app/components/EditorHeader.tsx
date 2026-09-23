import { useAppStore, type EditorView, type ViewMode } from '@/application/project'
import { downloadSceneScreenshot } from '@/features/scene-3d'
import { SegmentedControl } from '@/shared/ui/SegmentedControl'

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: '2d', label: '2D' },
  { value: 'split', label: '2D + 3D' },
  { value: '3d', label: '3D' },
]

const EDITOR_VIEWS: { value: EditorView; label: string }[] = [
  { value: 'plan', label: 'Вид сверху' },
  { value: 'elevation', label: 'Фасад стены' },
]

export function EditorHeader({
  projectName,
  saving,
  onOpenProjects,
}: {
  projectName: string
  saving: boolean
  onOpenProjects: () => void
}) {
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const editorView = useAppStore((s) => s.editorView)
  const setEditorView = useAppStore((s) => s.setEditorView)
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2.5">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">Замер кухни</h1>
        <button
          type="button"
          onClick={onOpenProjects}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {projectName} ▾
        </button>
        <span role="status" className="text-xs text-slate-500">
          {saving ? 'Сохраняется…' : 'Сохранено'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {viewMode !== '3d' && <SegmentedControl options={EDITOR_VIEWS} value={editorView} onChange={setEditorView} />}
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
  )
}
