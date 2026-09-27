import { beforeEach, describe, expect, it } from 'vitest'
import { ProjectSession } from '@/application/project/projectSession'
import type { ProjectRecord, ProjectRepository } from '@/application/project/projectRepository'
import { canRedo, canUndo, useAppStore } from '@/application/project'
import { makeFurniture, makeRoom } from '../fixtures'
import { BLOCK_PRESETS } from '@/features/furniture-library/catalog'
import { partializeProject } from '@/application/project/persistence'

class MemoryRepository implements ProjectRepository {
  records = new Map<string, ProjectRecord>()
  selected: string | null = null
  failNextPut = false

  async list() {
    return [...this.records.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }
  async get(id: string) {
    return this.records.get(id)
  }
  async put(record: ProjectRecord) {
    if (this.failNextPut) {
      this.failNextPut = false
      throw new Error('disk failed')
    }
    this.records.set(record.id, structuredClone(record))
  }
  async remove(id: string) {
    this.records.delete(id)
  }
  async currentId() {
    return this.selected
  }
  async setCurrentId(id: string | null) {
    this.selected = id
  }
}

class MemoryLegacyStorage {
  value: string | null = null
  getItem() {
    return this.value
  }
  removeItem() {
    this.value = null
  }
}

beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom(), furniture: [] }, true)
})

describe('project session', () => {
  it('opens an older cabinet sketch with the new facade family without deleting its stored record', async () => {
    const repository = new MemoryRepository()
    repository.selected = 'old-sketch'
    repository.records.set('old-sketch', {
      id: 'old-sketch',
      name: 'Старый эскиз',
      createdAt: 1,
      updatedAt: 1,
      data: partializeProject({ ...useAppStore.getState(), furniture: [makeFurniture()] }),
    })
    const session = new ProjectSession(repository, new MemoryLegacyStorage(), useAppStore)
    await session.initialize()
    try {
      expect(useAppStore.getState().furniture).toHaveLength(1)
      expect(useAppStore.getState().furniture[0]?.cabinetModule).toEqual({
        familyId: 'base-storage',
        version: 1,
        facade: 'single-door',
      })
      expect(repository.records.has('old-sketch')).toBe(true)
    } finally {
      session.dispose()
    }
  })

  it('retains a configured base cabinet when reopening a project', async () => {
    const repository = new MemoryRepository()
    const session = new ProjectSession(repository, new MemoryLegacyStorage(), useAppStore)
    await session.initialize()
    try {
      const firstId = session.getSnapshot().currentId!
      useAppStore.getState().addBlock(BLOCK_PRESETS.find((preset) => preset.id === 'base-cabinet')!)
      const cabinetId = useAppStore.getState().furniture[0]!.id
      useAppStore.getState().setCabinetFacade(cabinetId, 'three-drawers')
      await session.create('Другой проект')
      expect(useAppStore.getState().furniture).toHaveLength(0)
      await session.open(firstId)
      expect(useAppStore.getState().furniture[0]?.cabinetModule).toEqual({
        familyId: 'base-storage',
        version: 1,
        facade: 'three-drawers',
      })
    } finally {
      session.dispose()
    }
  })

  it('saves an undo performed while an earlier IndexedDB write is still in flight', async () => {
    const repository = new MemoryRepository()
    const session = new ProjectSession(repository, new MemoryLegacyStorage(), useAppStore)
    await session.initialize()
    try {
      const id = session.getSnapshot().currentId!
      const put = repository.put.bind(repository)
      let pause = true
      let release!: () => void
      repository.put = async (record) => {
        if (pause) {
          pause = false
          await new Promise<void>((resolve) => {
            release = resolve
          })
        }
        await put(record)
      }
      useAppStore.getState().setWallHeight(2900)
      const saving = session.flush()
      useAppStore.getState().undo()
      release()
      await saving
      expect(repository.records.get(id)?.data.room.wallHeight).toBe(2700)
      expect(session.hasPendingChanges()).toBe(false)
    } finally {
      session.dispose()
    }
  })

  it('keeps undo and redo histories separate when switching between projects', async () => {
    const repository = new MemoryRepository()
    const session = new ProjectSession(repository, new MemoryLegacyStorage(), useAppStore)
    await session.initialize()
    try {
      const firstId = session.getSnapshot().currentId!
      useAppStore.getState().addUtility({ x: 1000, y: 1000 }, 'sewer')
      useAppStore.getState().undo()
      await session.create('Второй')
      const secondId = session.getSnapshot().currentId!
      expect(canUndo(useAppStore.getState())).toBe(false)
      expect(canRedo(useAppStore.getState())).toBe(false)
      useAppStore.getState().setWallHeight(3000)

      await session.open(firstId)
      expect(canRedo(useAppStore.getState())).toBe(true)
      useAppStore.getState().redo()
      expect(useAppStore.getState().room.utilities.map((item) => item.type)).toEqual(['sewer'])
      expect(useAppStore.getState().room.wallHeight).toBe(2700)
      await session.open(secondId)
      useAppStore.getState().undo()
      expect(useAppStore.getState().room.wallHeight).toBe(2700)
      expect(useAppStore.getState().room.utilities).toHaveLength(0)
      await session.flush()
      expect(repository.records.get(secondId)?.data.room.wallHeight).toBe(2700)
      expect(repository.records.get(firstId)?.data.room.utilities).toHaveLength(1)
    } finally {
      session.dispose()
    }
  })

  it('persists undo results but excludes history from backups and starts fresh after reload', async () => {
    const repository = new MemoryRepository()
    const legacy = new MemoryLegacyStorage()
    const session = new ProjectSession(repository, legacy, useAppStore)
    await session.initialize()
    useAppStore.getState().setWallHeight(2900)
    await session.flush()
    useAppStore.getState().undo()
    expect(session.hasPendingChanges()).toBe(true)
    const backup = JSON.parse((await session.exportCurrent()).json)
    expect(backup.data.room.wallHeight).toBe(2700)
    expect(backup.data).not.toHaveProperty('history')
    session.dispose()

    const reloaded = new ProjectSession(repository, legacy, useAppStore)
    await reloaded.initialize()
    try {
      expect(useAppStore.getState().room.wallHeight).toBe(2700)
      expect(canUndo(useAppStore.getState())).toBe(false)
      expect(canRedo(useAppStore.getState())).toBe(false)
    } finally {
      reloaded.dispose()
    }
  })

  it('starts copies and imports with an empty history and closes pending groups before switching', async () => {
    const session = new ProjectSession(new MemoryRepository(), new MemoryLegacyStorage(), useAppStore)
    await session.initialize()
    try {
      const firstId = session.getSnapshot().currentId!
      useAppStore.getState().beginHistoryGroup()
      useAppStore.getState().setWallHeight(2800)
      useAppStore.getState().setWallHeight(2900)
      await session.duplicate(firstId)
      expect(useAppStore.getState().room.wallHeight).toBe(2900)
      expect(canUndo(useAppStore.getState())).toBe(false)
      const copyId = session.getSnapshot().currentId!
      const backup = await session.exportCurrent()
      await session.remove(copyId)
      useAppStore.getState().undo()
      expect(useAppStore.getState().room.wallHeight).toBe(2700)
      await session.importJson(backup.json)
      expect(useAppStore.getState().room.wallHeight).toBe(2900)
      expect(canUndo(useAppStore.getState())).toBe(false)
    } finally {
      session.dispose()
    }
  })

  it('autosaves each project, switches without leaking state and reloads the active one', async () => {
    const repository = new MemoryRepository()
    const legacy = new MemoryLegacyStorage()
    const firstSession = new ProjectSession(repository, legacy, useAppStore)
    await firstSession.initialize()
    const firstId = firstSession.getSnapshot().currentId!
    useAppStore.getState().addUtility({ x: 1200, y: 1000 }, 'sewer')

    await firstSession.create('Кухня Анны')
    expect(useAppStore.getState().room.utilities).toHaveLength(0)
    const secondId = firstSession.getSnapshot().currentId!
    useAppStore.getState().addUtility({ x: 1600, y: 1000 }, 'gas')
    await firstSession.open(firstId)
    expect(useAppStore.getState().room.utilities.map((item) => item.type)).toEqual(['sewer'])
    expect(repository.records.get(secondId)?.data.room.utilities.map((item) => item.type)).toEqual(['gas'])

    firstSession.dispose()
    useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom(), furniture: [] }, true)
    const reloaded = new ProjectSession(repository, legacy, useAppStore)
    await reloaded.initialize()
    expect(reloaded.getSnapshot().currentId).toBe(firstId)
    expect(useAppStore.getState().room.utilities.map((item) => item.type)).toEqual(['sewer'])
    await reloaded.open(secondId)
    expect(useAppStore.getState().room.utilities.map((item) => item.type)).toEqual(['gas'])
    reloaded.dispose()
  })

  it('migrates the old Zustand payload once and removes it only after a committed write', async () => {
    const repository = new MemoryRepository()
    const legacy = new MemoryLegacyStorage()
    legacy.value = JSON.stringify({
      state: {
        room: makeRoom({
          utilities: [{ id: 'old-water', type: 'water', point: { x: 1000, y: 500 }, height: 500 }] as never,
        }),
        furniture: [],
        viewMode: '2d',
      },
      version: 0,
    })
    repository.failNextPut = true
    const session = new ProjectSession(repository, legacy, useAppStore)
    await expect(session.initialize()).rejects.toThrow('disk failed')
    expect(legacy.value).not.toBeNull()
    expect(repository.records.size).toBe(0)

    await session.initialize()
    expect(legacy.value).toBeNull()
    expect(repository.records.size).toBe(1)
    expect(useAppStore.getState().room.utilities[0]).toMatchObject({
      id: 'old-water',
      mount: { kind: 'floor' },
      height: 0,
    })
    expect(useAppStore.getState().viewMode).toBe('2d')
    session.dispose()
  })

  it('keeps a malformed old save untouched and does not import it silently', async () => {
    const repository = new MemoryRepository()
    const legacy = new MemoryLegacyStorage()
    legacy.value = '{bad json'
    const session = new ProjectSession(repository, legacy, useAppStore)
    await session.initialize()
    expect(legacy.value).toBe('{bad json')
    expect(session.getSnapshot().error).toContain('Старое сохранение')
    session.dispose()
  })

  it('preserves a newer localStorage revision even when an earlier one was already imported', async () => {
    const repository = new MemoryRepository()
    const legacy = new MemoryLegacyStorage()
    const save = (utilities: unknown[]) =>
      JSON.stringify({
        state: { room: { ...makeRoom(), utilities }, furniture: [], viewMode: 'split' },
        version: 0,
      })
    legacy.value = save([])
    const first = new ProjectSession(repository, legacy, useAppStore)
    await first.initialize()
    first.dispose()

    legacy.value = save([{ id: 'newer', type: 'sewer', point: { x: 800, y: 900 }, height: 0 }])
    const second = new ProjectSession(repository, legacy, useAppStore)
    await second.initialize()
    expect(second.getSnapshot().projects).toHaveLength(2)
    expect(
      second.getSnapshot().projects.some((project) => project.data.room.utilities.some((item) => item.id === 'newer')),
    ).toBe(true)
    expect(legacy.value).toBeNull()
    second.dispose()
  })

  it('retains unsaved edits after an IndexedDB write failure and retries them', async () => {
    const repository = new MemoryRepository()
    const session = new ProjectSession(repository, new MemoryLegacyStorage(), useAppStore)
    await session.initialize()
    const id = session.getSnapshot().currentId!
    repository.failNextPut = true
    useAppStore.getState().addUtility({ x: 900, y: 900 }, 'sewer')
    await expect(session.flush()).rejects.toThrow('disk failed')
    expect(session.hasPendingChanges()).toBe(true)
    expect(repository.records.get(id)?.data.room.utilities).toHaveLength(0)
    await session.flush()
    expect(repository.records.get(id)?.data.room.utilities).toHaveLength(1)
    expect(session.hasPendingChanges()).toBe(false)
    session.dispose()
  })

  it('renames, duplicates, deletes with a selected fallback and roundtrips a JSON backup', async () => {
    const repository = new MemoryRepository()
    const session = new ProjectSession(repository, new MemoryLegacyStorage(), useAppStore)
    await session.initialize()
    const originalId = session.getSnapshot().currentId!
    await session.rename(originalId, '  Кухня  ')
    expect(session.getSnapshot().projects[0]?.name).toBe('Кухня')
    useAppStore.getState().addUtility({ x: 1000, y: 1000 }, 'sewer')
    const backup = await session.exportCurrent()
    expect(JSON.parse(backup.json)).toMatchObject({ format: 'future-furniture-project', version: 1, name: 'Кухня' })
    await session.duplicate(originalId)
    const duplicateId = session.getSnapshot().currentId!
    expect(duplicateId).not.toBe(originalId)
    expect(useAppStore.getState().room.utilities).toHaveLength(1)
    await session.remove(duplicateId)
    expect(session.getSnapshot().currentId).toBe(originalId)
    await session.importJson(backup.json)
    expect(session.getSnapshot().projects).toHaveLength(2)
    expect(useAppStore.getState().room.utilities).toHaveLength(1)
    await expect(session.importJson('{')).rejects.toThrow('JSON')
    await expect(
      session.importJson(JSON.stringify({ format: 'future-furniture-project', version: 99 })),
    ).rejects.toThrow('версия')
    expect(session.getSnapshot().projects).toHaveLength(2)
    session.dispose()
  })
})
