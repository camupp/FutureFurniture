import { useEffect, useState } from 'react'
import { projectSession, useAppStore } from '@/application/project'
import { ElevationEditor } from '@/features/elevation-editor'
import { LibraryPanel } from '@/features/furniture-library'
import { PropertiesPanel } from '@/features/properties'
import { RoomEditor } from '@/features/plan-editor'
import { Scene3D } from '@/features/scene-3d'
import { EditorHeader } from './components/EditorHeader'
import { EditorTools } from './components/EditorTools'
import { ProjectManager } from './components/ProjectManager'
import { useProjectSession } from './useProjectSession'
import { useHistoryKeyboard } from './useHistoryKeyboard'

export function App() {
  const session = useProjectSession()
  const [projectsOpen, setProjectsOpen] = useState(false)
  useHistoryKeyboard(session.phase === 'ready' && Boolean(session.currentId) && !session.busy && !projectsOpen)
  useEffect(() => {
    void projectSession.initialize().catch(() => undefined)
    const protectPendingSave = (event: BeforeUnloadEvent) => {
      if (!projectSession.hasPendingChanges()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectPendingSave)
    return () => window.removeEventListener('beforeunload', protectPendingSave)
  }, [])
  const viewMode = useAppStore((s) => s.viewMode)
  const editorView = useAppStore((s) => s.editorView)
  const clearRoom = useAppStore((s) => s.clearRoom)

  const handleClear = () => {
    if (confirm('Удалить все стены, проёмы, выводы и блоки проекта?')) clearRoom()
  }

  if (session.phase === 'loading') return <div className="p-6">Загружаем проекты…</div>
  if (session.phase === 'error')
    return (
      <div className="p-6" role="alert">
        Не удалось открыть проекты: {session.error}{' '}
        <button type="button" onClick={() => void projectSession.initialize().catch(() => undefined)}>
          Повторить
        </button>
      </div>
    )
  if (!session.currentId) return <ProjectManager onClose={() => undefined} />
  const projectName = session.projects.find((project) => project.id === session.currentId)?.name ?? 'Проект'

  return (
    <div className="flex h-full flex-col overflow-x-auto bg-slate-100 text-slate-900">
      <EditorHeader
        projectName={projectName}
        saving={session.saving}
        onOpenProjects={() => setProjectsOpen(true)}
        historyDisabled={session.busy || projectsOpen}
      />
      {session.error && (
        <div role="alert" className="bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {session.error}
        </div>
      )}
      {projectsOpen && <ProjectManager onClose={() => setProjectsOpen(false)} />}

      {/* Целевое устройство — планшет в альбомной ориентации; на узком экране
          раскладка не схлопывается, а прокручивается по горизонтали. */}
      <div key={session.currentId} className="flex min-h-0 min-w-[900px] flex-1">
        <nav className="flex w-52 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-4">
          <EditorTools />

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
