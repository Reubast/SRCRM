import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Column, ExportPayload, Task, Theme } from './types'

interface TaskFlowDB extends DBSchema {
  columns: {
    key: string
    value: Column
  }
  tasks: {
    key: string
    value: Task
  }
  settings: {
    key: string
    value: string
  }
}

const DB_NAME = 'taskflow'
const DB_VERSION = 1

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

export async function loadAll(): Promise<{ columns: Column[]; tasks: Task[] }> {
  const database = await db()
  const [columns, tasks] = await Promise.all([
    database.getAll('columns'),
    database.getAll('tasks'),
  ])

  return {
    columns: columns.sort((a, b) => a.order - b.order),
    tasks: tasks.sort((a, b) => a.order - b.order),
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
  const transaction = database.transaction(['columns', 'tasks'], 'readwrite')
  await transaction.objectStore('columns').clear()
  await transaction.objectStore('tasks').clear()
  await Promise.all([
    ...payload.columns.map((column) => transaction.objectStore('columns').put(column)),
    ...payload.tasks.map((task) => transaction.objectStore('tasks').put(task)),
  ])
  await transaction.done
}

export async function wipeData(): Promise<void> {
  const database = await db()
  const transaction = database.transaction(['columns', 'tasks'], 'readwrite')
  await transaction.objectStore('columns').clear()
  await transaction.objectStore('tasks').clear()
  await transaction.done
}
