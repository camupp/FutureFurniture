import { useRef, useState, type ChangeEvent } from 'react'
import { projectSession } from '@/application/project'
import { useProjectSession } from '../useProjectSession'

function downloadJson(name: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 60) || 'project'}.json`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ProjectManager({ onClose }: { onClose: () => void }) {
  const { projects, currentId, busy, error } = useProjectSession()
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [uiError, setUiError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function run(action: () => Promise<unknown>, close = false) {
    setUiError(null)
    try {
      await action()
      if (close) onClose()
    } catch (failure) {
      setUiError(failure instanceof Error ? failure.message : 'Не удалось выполнить действие')
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setUiError('Файл проекта слишком большой (максимум 10 МБ)')
      return
    }
    await run(async () => projectSession.importJson(await file.text()), true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Проекты"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Проекты</h2>
          {currentId && (
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 hover:bg-slate-100"
              aria-label="Закрыть список проектов"
            >
              ✕
            </button>
          )}
        </div>
        {(uiError || error) && (
          <p role="alert" className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
            {uiError || error}
          </p>
        )}

        <form
          className="mb-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await projectSession.create(newName)
              setNewName('')
            }, true)
          }}
        >
          <input
            aria-label="Название нового проекта"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Название нового проекта"
            maxLength={80}
            className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          >
            Создать
          </button>
        </form>

        <div className="min-h-0 overflow-y-auto">
          {projects.length === 0 && (
            <p className="py-4 text-sm text-slate-500">Проектов пока нет. Создайте новый или импортируйте копию.</p>
          )}
          {projects.map((project) => (
            <div
              key={project.id}
              role="group"
              aria-label={`Проект ${project.name}`}
              className="border-t border-slate-200 py-3"
            >
              {renameId === project.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void run(async () => {
                      await projectSession.rename(project.id, renameValue)
                      setRenameId(null)
                    })
                  }}
                >
                  <input
                    aria-label="Новое название проекта"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    maxLength={80}
                    className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
                  />
                  <button type="submit" disabled={busy} className="text-blue-700">
                    Сохранить
                  </button>
                  <button type="button" onClick={() => setRenameId(null)}>
                    Отмена
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {project.name}
                      {project.id === currentId ? ' · открыт' : ''}
                    </div>
                    <div className="text-xs text-slate-500">
                      Изменён {new Date(project.updatedAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-sm">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => projectSession.open(project.id), true)}
                      className="text-blue-700 disabled:opacity-50"
                    >
                      Открыть
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRenameId(project.id)
                        setRenameValue(project.name)
                      }}
                      className="text-slate-600 disabled:opacity-50"
                    >
                      Переименовать
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => projectSession.duplicate(project.id), true)}
                      className="text-slate-600 disabled:opacity-50"
                    >
                      Дублировать
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Удалить проект «${project.name}»? Это действие нельзя отменить.`))
                          void run(() => projectSession.remove(project.id))
                      }}
                      className="text-red-600 disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 text-sm">
          <button
            type="button"
            disabled={busy || !currentId}
            onClick={() =>
              void run(async () => {
                const { name, json } = await projectSession.exportCurrent()
                downloadJson(name, json)
              })
            }
            className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
          >
            Экспорт JSON
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
          >
            Импорт JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            onChange={(event) => void importFile(event)}
            className="hidden"
            aria-label="Файл проекта JSON"
          />
        </div>
      </section>
    </div>
  )
}
