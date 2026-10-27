import { openDB, type DBSchema } from 'idb'
import type { Column, Task, TimeEntry } from './types'

// Старое локальное хранилище (до переноса данных на сервер). Только чтение,
// для одноразового предложения перенести задачи в аккаунт.
interface LegacyDB extends DBSchema {
  columns: {
    key: string
    value: Column
  }
  tasks: {
    key: string
    value: Task
  }
  timeEntries: {
    key: string
    value: TimeEntry
  }
}

const DB_NAME = 'taskflow'
const READ_TIMEOUT_MS = 3000

export interface LegacySnapshot {
  columns: Column[]
  tasks: Task[]
  timeEntries: TimeEntry[]
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function hasLegacyDatabase(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') {
    return false
  }

  if (typeof indexedDB.databases !== 'function') {
    return true
  }

  const databases = await indexedDB.databases()

  return databases.some((item) => item.name === DB_NAME)
}

async function readAll(): Promise<LegacySnapshot | null> {
  // Открываем без указания версии: апгрейд схемы здесь не нужен и не может заблокироваться.
  const database = await openDB<LegacyDB>(DB_NAME)

  try {
    if (!database.objectStoreNames.contains('tasks')) {
      return null
    }

    const hasEntries = database.objectStoreNames.contains('timeEntries')
    const [columns, tasks, timeEntries] = await Promise.all([
      database.getAll('columns'),
      database.getAll('tasks'),
      hasEntries ? database.getAll('timeEntries') : Promise.resolve([]),
    ])

    return {
      columns,
      tasks: tasks.map((task) => ({ ...task, startAt: task.startAt ?? null })),
      timeEntries,
    }
  } finally {
    database.close()
  }
}

/**
 * Читает локальные данные старой версии. Возвращает null, если данных нет
 * или чтение не завершилось за READ_TIMEOUT_MS (например, база занята другой вкладкой).
 */
export async function readLegacy(): Promise<LegacySnapshot | null> {
  try {
    const exists = await hasLegacyDatabase()

    if (!exists) {
      return null
    }

    return await Promise.race([
      readAll(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])
  } catch {
    return null
  }
}
