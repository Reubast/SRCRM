import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Column, ExportPayload, Task, Theme, TimeEntry } from './types'

interface TaskFlowDB extends DBSchema {
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
  settings: {
    key: string
    value: string
  }
}

const DB_NAME = 'taskflow'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<TaskFlowDB>> | null = null

function db(): Promise<IDBPDatabase<TaskFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TaskFlowDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('columns')) {
          database.createObjectStore('columns', { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains('tasks')) {
          database.createObjectStore('tasks', { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains('timeEntries')) {
          database.createObjectStore('timeEntries', { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings')
        }
      },
    })
  }

  return dbPromise
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const defaultColumns = (): Column[] => [
  { id: newId(), title: 'Бэклог', order: 0, isDone: false },
  { id: newId(), title: 'В работе', order: 1, isDone: false },
  { id: newId(), title: 'Выполнено', order: 2, isDone: true },
]

export async function loadAll(): Promise<{
  columns: Column[]
  tasks: Task[]
  timeEntries: TimeEntry[]
}> {
  const database = await db()
  const [columns, tasks, timeEntries] = await Promise.all([
    database.getAll('columns'),
    database.getAll('tasks'),
    database.getAll('timeEntries'),
  ])

  return {
    columns: columns.sort((a, b) => a.order - b.order),
    tasks: tasks
      .map((task) => ({ ...task, startAt: task.startAt ?? null }))
      .sort((a, b) => a.order - b.order),
    timeEntries: timeEntries.sort((a, b) => b.date.localeCompare(a.date)),
  }
}

export async function putColumn(column: Column): Promise<void> {
  const database = await db()
  await database.put('columns', column)
}

export async function removeColumn(id: string): Promise<void> {
  const database = await db()
  await database.delete('columns', id)
}

export async function putTask(task: Task): Promise<void> {
  const database = await db()
  await database.put('tasks', task)
}

export async function removeTasks(ids: string[]): Promise<void> {
  const database = await db()
  const transaction = database.transaction('tasks', 'readwrite')
  await Promise.all(ids.map((id) => transaction.store.delete(id)))
  await transaction.done
}

export async function putTimeEntry(entry: TimeEntry): Promise<void> {
  const database = await db()
  await database.put('timeEntries', entry)
}

export async function removeTimeEntries(ids: string[]): Promise<void> {
  const database = await db()
  const transaction = database.transaction('timeEntries', 'readwrite')
  await Promise.all(ids.map((id) => transaction.store.delete(id)))
  await transaction.done
}

export async function getTheme(): Promise<Theme | null> {
  const database = await db()
  const value = await database.get('settings', 'theme')

  return value === 'light' || value === 'dark' ? value : null
}

export async function saveTheme(theme: Theme): Promise<void> {
  const database = await db()
  await database.put('settings', theme, 'theme')
}

export async function replaceAll(payload: ExportPayload): Promise<void> {
  const database = await db()
  const transaction = database.transaction(['columns', 'tasks', 'timeEntries'], 'readwrite')
  await transaction.objectStore('columns').clear()
  await transaction.objectStore('tasks').clear()
  await transaction.objectStore('timeEntries').clear()
  await Promise.all([
    ...payload.columns.map((column) => transaction.objectStore('columns').put(column)),
    ...payload.tasks.map((task) => transaction.objectStore('tasks').put(task)),
    ...payload.timeEntries.map((entry) => transaction.objectStore('timeEntries').put(entry)),
  ])
  await transaction.done
}

export async function wipeData(): Promise<void> {
  const database = await db()
  const transaction = database.transaction(['columns', 'tasks', 'timeEntries'], 'readwrite')
  await transaction.objectStore('columns').clear()
  await transaction.objectStore('tasks').clear()
  await transaction.objectStore('timeEntries').clear()
  await transaction.done
}
