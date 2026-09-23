import type { ProjectDocument } from './persistence'

export type ProjectRecord = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  data: ProjectDocument
}

export interface ProjectRepository {
  list(): Promise<ProjectRecord[]>
  get(id: string): Promise<ProjectRecord | undefined>
  put(record: ProjectRecord): Promise<void>
  remove(id: string): Promise<void>
  currentId(): Promise<string | null>
  setCurrentId(id: string | null): Promise<void>
}

const DATABASE_NAME = 'future-furniture-projects'
const DATABASE_VERSION = 1
const PROJECTS = 'projects'
const META = 'meta'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Ошибка IndexedDB'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Транзакция IndexedDB отменена'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Ошибка транзакции IndexedDB'))
  })
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private databasePromise: Promise<IDBDatabase> | null = null

  private database(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
        request.onupgradeneeded = () => {
          const database = request.result
          if (!database.objectStoreNames.contains(PROJECTS)) database.createObjectStore(PROJECTS, { keyPath: 'id' })
          if (!database.objectStoreNames.contains(META)) database.createObjectStore(META)
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB'))
        request.onblocked = () => reject(new Error('Закройте другие вкладки приложения и повторите попытку'))
      }).catch((error: unknown) => {
        this.databasePromise = null
        throw error
      })
    }
    return this.databasePromise!
  }

  private async read<T>(storeName: string, key?: IDBValidKey): Promise<T> {
    const database = await this.database()
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request: IDBRequest = key === undefined ? store.getAll() : store.get(key)
    const result = requestResult(request)
    const done = transactionDone(transaction)
    const [value] = await Promise.all([result, done])
    return value as T
  }

  private async write(storeName: string, value: unknown, key?: IDBValidKey, remove = false): Promise<void> {
    const database = await this.database()
    const transaction = database.transaction(storeName, 'readwrite')
    const done = transactionDone(transaction)
    const store = transaction.objectStore(storeName)
    if (remove) store.delete(key!)
    else if (key === undefined) store.put(value)
    else store.put(value, key)
    await done
  }

  async list(): Promise<ProjectRecord[]> {
    const projects = await this.read<ProjectRecord[]>(PROJECTS)
    return projects.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string): Promise<ProjectRecord | undefined> {
    return this.read<ProjectRecord | undefined>(PROJECTS, id)
  }

  put(record: ProjectRecord): Promise<void> {
    return this.write(PROJECTS, record)
  }

  remove(id: string): Promise<void> {
    return this.write(PROJECTS, undefined, id, true)
  }

  async currentId(): Promise<string | null> {
    return (await this.read<string | undefined>(META, 'currentId')) ?? null
  }

  setCurrentId(id: string | null): Promise<void> {
    return this.write(META, id, 'currentId')
  }
}
