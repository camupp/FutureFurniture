import { createInitialData } from './initialState'
import { normalizeProjectDocument, partializeProject, PROJECT_STORAGE_KEY } from './persistence'
import { IndexedDbProjectRepository, type ProjectRecord, type ProjectRepository } from './projectRepository'
import { useAppStore } from './store'

const BACKUP_FORMAT = 'future-furniture-project'
const BACKUP_VERSION = 1
const LEGACY_ID = 'imported-localstorage-project'
const SAVE_DELAY_MS = 250

export type ProjectSessionSnapshot = {
  phase: 'loading' | 'ready' | 'error'
  projects: ProjectRecord[]
  currentId: string | null
  busy: boolean
  saving: boolean
  error: string | null
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Неизвестная ошибка сохранения'
}

function nameOrThrow(name: string): string {
  const result = name.trim()
  if (!result) throw new Error('Введите название проекта')
  if (result.length > 80) throw new Error('Название должно быть не длиннее 80 символов')
  return result
}

export class ProjectSession {
  private readonly repository: ProjectRepository
  private readonly legacyStorage: Pick<Storage, 'getItem' | 'removeItem'>
  private readonly store: typeof useAppStore
  private snapshot: ProjectSessionSnapshot = {
    phase: 'loading',
    projects: [],
    currentId: null,
    busy: false,
    saving: false,
    error: null,
  }
  private listeners = new Set<() => void>()
  private initialPromise: Promise<void> | null = null
  private unsubscribeStore: (() => void) | null = null
  private current: ProjectRecord | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private savePromise: Promise<void> | null = null
  private dirty = false
  private loadingStore = false

  constructor(
    repository: ProjectRepository,
    legacyStorage: Pick<Storage, 'getItem' | 'removeItem'>,
    store = useAppStore,
  ) {
    this.repository = repository
    this.legacyStorage = legacyStorage
    this.store = store
  }

  getSnapshot = (): ProjectSessionSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  hasPendingChanges = () => this.dirty || this.savePromise !== null

  private publish(patch: Partial<ProjectSessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  private defaultRecord(name = 'Новый проект'): ProjectRecord {
    const now = Date.now()
    return {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      data: partializeProject({ ...this.store.getState(), ...createInitialData(() => crypto.randomUUID()) }),
    }
  }

  private loadIntoStore(record: ProjectRecord) {
    const current = this.store.getState()
    const normalized = normalizeProjectDocument(record.data, current, () => crypto.randomUUID())
    if (!normalized) throw new Error(`Проект «${record.name}» повреждён; его данные не были изменены`)
    this.loadingStore = true
    try {
      this.store.setState({ ...createInitialData(() => crypto.randomUUID()), ...normalized })
      this.current = { ...record, data: normalized }
    } finally {
      this.loadingStore = false
    }
  }

  private async migrateLegacy(): Promise<string | null> {
    const raw = this.legacyStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return null
    let persisted: unknown
    try {
      persisted = (JSON.parse(raw) as { state?: unknown }).state
    } catch {
      return 'Старое сохранение не удалось прочитать. Оно оставлено в браузере без изменений.'
    }
    const data = normalizeProjectDocument(persisted, this.store.getState(), () => crypto.randomUUID())
    if (!data) return 'Старое сохранение повреждено. Оно оставлено в браузере без изменений.'
    const existing = await this.repository.get(LEGACY_ID)
    if (!existing) {
      const now = Date.now()
      await this.repository.put({
        id: LEGACY_ID,
        name: 'Предыдущий проект',
        createdAt: now,
        updatedAt: now,
        data,
      })
    } else if (JSON.stringify(existing.data) !== JSON.stringify(data)) {
      // An older tab may have changed the localStorage project after its first import.
      // Preserve that revision as another project rather than dropping it.
      const alreadyImported = (await this.repository.list()).some(
        (project) =>
          project.name === 'Предыдущий проект (новая версия)' && JSON.stringify(project.data) === JSON.stringify(data),
      )
      if (!alreadyImported) {
        const now = Date.now()
        await this.repository.put({
          id: crypto.randomUUID(),
          name: 'Предыдущий проект (новая версия)',
          createdAt: now,
          updatedAt: now,
          data,
        })
      }
    }
    // Only after the IndexedDB transaction has committed. A failed migration can be retried.
    this.legacyStorage.removeItem(PROJECT_STORAGE_KEY)
    return null
  }

  initialize(): Promise<void> {
    if (this.initialPromise) return this.initialPromise
    this.initialPromise = this.initializeOnce().catch((error: unknown) => {
      this.publish({ phase: 'error', error: message(error) })
      this.initialPromise = null
      throw error
    })
    return this.initialPromise
  }

  private async initializeOnce() {
    const warning = await this.migrateLegacy()
    let projects = await this.repository.list()
    if (!projects.length) {
      const first = this.defaultRecord()
      await this.repository.put(first)
      projects = [first]
    }
    const savedId = await this.repository.currentId()
    const active = projects.find((project) => project.id === savedId) ?? projects[0]!
    this.loadIntoStore(active)
    await this.repository.setCurrentId(active.id)
    this.unsubscribeStore = this.store.subscribe((next, previous) => {
      if (this.loadingStore || !this.current) return
      if (
        next.room === previous.room &&
        next.furniture === previous.furniture &&
        next.viewMode === previous.viewMode &&
        next.elevationWallId === previous.elevationWallId
      )
        return
      this.dirty = true
      this.publish({ saving: true })
      if (this.saveTimer) clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => {
        void this.flush().catch(() => undefined)
      }, SAVE_DELAY_MS)
    })
    this.publish({ phase: 'ready', projects, currentId: active.id, error: warning })
  }

  async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (this.savePromise) {
      await this.savePromise
      if (this.dirty) await this.flush()
      return
    }
    if (!this.dirty || !this.current) return
    const record = { ...this.current, data: partializeProject(this.store.getState()), updatedAt: Date.now() }
    this.dirty = false
    this.savePromise = this.repository
      .put(record)
      .then(() => {
        this.current = record
        this.publish({
          projects: this.snapshot.projects.map((item) => (item.id === record.id ? record : item)),
          error: null,
          saving: this.dirty,
        })
      })
      .catch((error: unknown) => {
        this.dirty = true
        this.publish({ error: `Не удалось сохранить проект: ${message(error)}`, saving: true })
        throw error
      })
      .finally(() => {
        this.savePromise = null
      })
    await this.savePromise
    if (this.dirty) await this.flush()
  }

  private async operation<T>(action: () => Promise<T>): Promise<T> {
    if (this.snapshot.busy) throw new Error('Дождитесь завершения предыдущего действия')
    this.publish({ busy: true, error: null })
    try {
      await this.flush()
      return await action()
    } catch (error) {
      this.publish({ error: message(error) })
      throw error
    } finally {
      this.publish({ busy: false })
    }
  }

  private async activate(record: ProjectRecord) {
    const normalized = normalizeProjectDocument(record.data, this.store.getState(), () => crypto.randomUUID())
    if (!normalized) throw new Error(`Проект «${record.name}» повреждён`)
    await this.repository.setCurrentId(record.id)
    this.loadIntoStore(record)
    this.publish({ currentId: record.id, projects: await this.repository.list() })
  }

  open(id: string): Promise<void> {
    return this.operation(async () => {
      if (id === this.snapshot.currentId) return
      const record = await this.repository.get(id)
      if (!record) throw new Error('Проект не найден')
      await this.activate(record)
    })
  }

  create(name: string): Promise<void> {
    return this.operation(async () => {
      const record = this.defaultRecord(nameOrThrow(name))
      await this.repository.put(record)
      await this.activate(record)
    })
  }

  rename(id: string, name: string): Promise<void> {
    return this.operation(async () => {
      const record = await this.repository.get(id)
      if (!record) throw new Error('Проект не найден')
      const renamed = { ...record, name: nameOrThrow(name), updatedAt: Date.now() }
      await this.repository.put(renamed)
      if (this.current?.id === id) this.current = renamed
      this.publish({ projects: await this.repository.list() })
    })
  }

  duplicate(id: string): Promise<void> {
    return this.operation(async () => {
      const source = await this.repository.get(id)
      if (!source) throw new Error('Проект не найден')
      const now = Date.now()
      const copy = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} — копия`,
        createdAt: now,
        updatedAt: now,
      }
      await this.repository.put(copy)
      await this.activate(copy)
    })
  }

  remove(id: string): Promise<void> {
    return this.operation(async () => {
      await this.repository.remove(id)
      const projects = await this.repository.list()
      if (id === this.snapshot.currentId) {
        const next = projects[0]
        if (next) await this.activate(next)
        else {
          await this.repository.setCurrentId(null)
          this.current = null
          this.publish({ projects: [], currentId: null })
        }
      } else this.publish({ projects })
    })
  }

  exportCurrent(): Promise<{ name: string; json: string }> {
    return this.operation(async () => {
      if (!this.current) throw new Error('Нет открытого проекта')
      return {
        name: this.current.name,
        json: JSON.stringify(
          { format: BACKUP_FORMAT, version: BACKUP_VERSION, name: this.current.name, data: this.current.data },
          null,
          2,
        ),
      }
    })
  }

  importJson(json: string): Promise<void> {
    return this.operation(async () => {
      let value: unknown
      try {
        value = JSON.parse(json)
      } catch {
        throw new Error('Файл не является корректным JSON')
      }
      if (!value || typeof value !== 'object') throw new Error('Некорректный формат проекта')
      const backup = value as Record<string, unknown>
      if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || typeof backup.name !== 'string') {
        throw new Error('Неподдерживаемый формат или версия резервной копии')
      }
      const data = normalizeProjectDocument(backup.data, this.store.getState(), () => crypto.randomUUID())
      if (!data) throw new Error('Файл содержит повреждённый проект')
      const now = Date.now()
      const record: ProjectRecord = {
        id: crypto.randomUUID(),
        name: nameOrThrow(backup.name),
        createdAt: now,
        updatedAt: now,
        data,
      }
      await this.repository.put(record)
      await this.activate(record)
    })
  }

  dispose() {
    this.unsubscribeStore?.()
    this.unsubscribeStore = null
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
  }
}

export const projectSession = new ProjectSession(new IndexedDbProjectRepository(), localStorage)
