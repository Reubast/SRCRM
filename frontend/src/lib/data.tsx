import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as store from './db'
import type {
  Column,
  ExportPayload,
  Priority,
  Task,
  TaskDraft,
  Theme,
  TimeEntry,
  TimeEntryDraft,
} from './types'

interface DataValue {
  columns: Column[]
  tasks: Task[]
  timeEntries: TimeEntry[]
  ready: boolean
  theme: Theme
  setTheme: (theme: Theme) => void
  addColumn: (title: string) => Promise<void>
  renameColumn: (id: string, title: string) => Promise<void>
  moveColumn: (id: string, direction: -1 | 1) => Promise<void>
  deleteColumn: (id: string) => Promise<void>
  saveTask: (draft: TaskDraft, id?: string) => Promise<Task>
  patchTask: (id: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  addTimeEntry: (draft: TimeEntryDraft) => Promise<void>
  deleteTimeEntry: (id: string) => Promise<void>
  importData: (payload: ExportPayload) => Promise<void>
  resetData: () => Promise<void>
}

const DataContext = createContext<DataValue | null>(null)

const PRIORITY_VALUES: Priority[] = ['low', 'medium', 'high']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function todayDate(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function normalizeImport(payload: ExportPayload): {
  columns: Column[]
  tasks: Task[]
  timeEntries: TimeEntry[]
} {
  if (!isRecord(payload) || !Array.isArray(payload.columns) || !Array.isArray(payload.tasks)) {
    throw new Error('Файл не похож на экспорт TaskFlow.')
  }

  const columns: Column[] = payload.columns.map((raw, index) => {
    const item: Record<string, unknown> = isRecord(raw) ? raw : {}

    return {
      id: typeof item.id === 'string' && item.id ? item.id : store.newId(),
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `Колонка ${index + 1}`,
      order: typeof item.order === 'number' ? item.order : index,
      isDone: item.isDone === true,
    }
  })

  if (columns.length === 0) {
    throw new Error('В файле нет ни одной колонки.')
  }

  const columnIds = new Set(columns.map((column) => column.id))
  const now = new Date().toISOString()

  const tasks: Task[] = payload.tasks
    .filter((raw) => isRecord(raw) && typeof raw.id === 'string' && typeof raw.title === 'string')
    .map((raw) => {
      const item = raw as unknown as Record<string, unknown>
      const priority = PRIORITY_VALUES.includes(item.priority as Priority)
        ? (item.priority as Priority)
        : 'medium'

      return {
        id: item.id as string,
        parentId: typeof item.parentId === 'string' ? item.parentId : null,
        title: (item.title as string).trim() || 'Без названия',
        description: typeof item.description === 'string' ? item.description : '',
        columnId: columnIds.has(item.columnId as string) ? (item.columnId as string) : columns[0].id,
        priority,
        startAt: typeof item.startAt === 'string' ? item.startAt : null,
        deadline: typeof item.deadline === 'string' ? item.deadline : null,
        completed: item.completed === true,
        order: typeof item.order === 'number' ? item.order : 0,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
      }
    })

  const taskIds = new Set(tasks.map((task) => task.id))
  const byId = new Map(tasks.map((task) => [task.id, task]))

  for (const task of tasks) {
    if (task.parentId && (!taskIds.has(task.parentId) || task.parentId === task.id)) {
      task.parentId = null
      continue
    }

    if (task.parentId) {
      const parent = byId.get(task.parentId)
      if (parent?.parentId) {
        task.parentId = null
      }
    }
  }

  const rawEntries = Array.isArray((payload as { timeEntries?: unknown }).timeEntries)
    ? ((payload as { timeEntries: unknown[] }).timeEntries)
    : []

  const timeEntries: TimeEntry[] = rawEntries
    .filter(
      (raw) =>
        isRecord(raw) &&
        typeof raw.id === 'string' &&
        typeof raw.taskId === 'string' &&
        taskIds.has(raw.taskId),
    )
    .map((raw) => {
      const item = raw as unknown as Record<string, unknown>
      const minutes = typeof item.minutes === 'number' && item.minutes > 0
        ? Math.min(1440, Math.round(item.minutes))
        : 30

      return {
        id: item.id as string,
        taskId: item.taskId as string,
        date: typeof item.date === 'string' && DATE_PATTERN.test(item.date) ? item.date : todayDate(),
        minutes,
        note: typeof item.note === 'string' ? item.note : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
      }
    })

  return { columns, tasks, timeEntries }
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.localStorage.getItem('taskflow-theme') === 'dark' ? 'dark' : 'light'
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [columns, setColumns] = useState<Column[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [ready, setReady] = useState(false)
  const [dbBlocked, setDbBlocked] = useState(false)
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => store.onDbBlocked(() => setDbBlocked(true)), [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const storedTheme = await store.getTheme()
      const loaded = await store.loadAll()
      let nextColumns = loaded.columns

      if (nextColumns.length === 0) {
        nextColumns = store.defaultColumns()
        await Promise.all(nextColumns.map((column) => store.putColumn(column)))
      }

      if (cancelled) {
        return
      }

      if (storedTheme) {
        setThemeState(storedTheme)
      }

      setColumns(nextColumns)
      setTasks(loaded.tasks)
      setTimeEntries(loaded.timeEntries)
      setDbBlocked(false)
      setReady(true)
    }

    boot().catch(() => setReady(true))

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    window.localStorage.setItem('taskflow-theme', theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    void store.saveTheme(next)
  }, [])

  const addColumn = useCallback(
    async (title: string) => {
      const trimmed = title.trim()

      if (!trimmed) {
        return
      }

      const order = columns.reduce((max, column) => Math.max(max, column.order), -1) + 1
      const column: Column = { id: store.newId(), title: trimmed, order, isDone: false }

      await store.putColumn(column)
      setColumns((current) => [...current, column])
    },
    [columns],
  )

  const renameColumn = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim()
      const column = columns.find((item) => item.id === id)

      if (!column || !trimmed || column.title === trimmed) {
        return
      }

      const next = { ...column, title: trimmed }
      await store.putColumn(next)
      setColumns((current) => current.map((item) => (item.id === id ? next : item)))
    },
    [columns],
  )

  const moveColumn = useCallback(
    async (id: string, direction: -1 | 1) => {
      const sorted = [...columns].sort((a, b) => a.order - b.order)
      const index = sorted.findIndex((column) => column.id === id)
      const target = index + direction

      if (index < 0 || target < 0 || target >= sorted.length) {
        return
      }

      const current = sorted[index]
      const other = sorted[target]
      const updated = [
        { ...current, order: other.order },
        { ...other, order: current.order },
      ]

      await Promise.all(updated.map((column) => store.putColumn(column)))
      setColumns((state) => state.map((column) => updated.find((item) => item.id === column.id) ?? column))
    },
    [columns],
  )

  const deleteColumn = useCallback(
    async (id: string) => {
      const remaining = columns.filter((column) => column.id !== id)

      if (remaining.length === 0) {
        return
      }

      const fallback = [...remaining].sort((a, b) => a.order - b.order)[0]
      const affected = tasks.filter((task) => task.columnId === id)
      const now = new Date().toISOString()
      const moved = affected.map((task) => ({ ...task, columnId: fallback.id, updatedAt: now }))

      await Promise.all(moved.map((task) => store.putTask(task)))
      await store.removeColumn(id)

      setTasks((current) => current.map((task) => moved.find((item) => item.id === task.id) ?? task))
      setColumns(remaining)
    },
    [columns, tasks],
  )

  const saveTask = useCallback(
    async (draft: TaskDraft, id?: string) => {
      const existing = id ? tasks.find((task) => task.id === id) : undefined
      const now = new Date().toISOString()
      const task: Task = {
        id: existing?.id ?? store.newId(),
        parentId: draft.parentId,
        title: draft.title.trim() || 'Без названия',
        description: draft.description,
        columnId: draft.columnId,
        priority: draft.priority,
        startAt: draft.startAt,
        deadline: draft.deadline,
        completed: draft.completed,
        order: draft.order,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }

      await store.putTask(task)
      setTasks((current) => {
        const exists = current.some((item) => item.id === task.id)

        return exists
          ? current.map((item) => (item.id === task.id ? task : item))
          : [...current, task]
      })

      return task
    },
    [tasks],
  )

  const patchTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const existing = tasks.find((task) => task.id === id)

      if (!existing) {
        return
      }

      const next: Task = { ...existing, ...patch, updatedAt: new Date().toISOString() }
      await store.putTask(next)
      setTasks((current) => current.map((task) => (task.id === id ? next : task)))
    },
    [tasks],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const ids = new Set<string>([id])
      let changed = true

      while (changed) {
        changed = false
        for (const task of tasks) {
          if (task.parentId && ids.has(task.parentId) && !ids.has(task.id)) {
            ids.add(task.id)
            changed = true
          }
        }
      }

      const entryIds = timeEntries
        .filter((entry) => ids.has(entry.taskId))
        .map((entry) => entry.id)

      await Promise.all([store.removeTasks([...ids]), store.removeTimeEntries(entryIds)])
      setTasks((current) => current.filter((task) => !ids.has(task.id)))
      setTimeEntries((current) => current.filter((entry) => !entryIds.includes(entry.id)))
    },
    [tasks, timeEntries],
  )

  const toggleTask = useCallback(
    async (id: string) => {
      const task = tasks.find((item) => item.id === id)

      if (!task) {
        return
      }

      await patchTask(id, { completed: !task.completed })
    },
    [tasks, patchTask],
  )

  const addTimeEntry = useCallback(
    async (draft: TimeEntryDraft) => {
      const minutes = Math.round(draft.minutes)

      if (minutes <= 0) {
        return
      }

      const entry: TimeEntry = {
        id: store.newId(),
        taskId: draft.taskId,
        date: DATE_PATTERN.test(draft.date) ? draft.date : todayDate(),
        minutes: Math.min(1440, minutes),
        note: draft.note.trim(),
        createdAt: new Date().toISOString(),
      }

      await store.putTimeEntry(entry)
      setTimeEntries((current) => [entry, ...current])
    },
    [],
  )

  const deleteTimeEntry = useCallback(
    async (id: string) => {
      await store.removeTimeEntries([id])
      setTimeEntries((current) => current.filter((entry) => entry.id !== id))
    },
    [],
  )

  const importData = useCallback(async (payload: ExportPayload) => {
    const normalized = normalizeImport(payload)

    await store.replaceAll({ ...payload, ...normalized })
    setColumns(normalized.columns)
    setTasks(normalized.tasks)
    setTimeEntries(normalized.timeEntries)
  }, [])

  const resetData = useCallback(async () => {
    await store.wipeData()
    const nextColumns = store.defaultColumns()

    await Promise.all(nextColumns.map((column) => store.putColumn(column)))
    setColumns(nextColumns)
    setTasks([])
    setTimeEntries([])
  }, [])

  const value = useMemo<DataValue>(
    () => ({
      columns,
      tasks,
      timeEntries,
      ready,
      theme,
      setTheme,
      addColumn,
      renameColumn,
      moveColumn,
      deleteColumn,
      saveTask,
      patchTask,
      deleteTask,
      toggleTask,
      addTimeEntry,
      deleteTimeEntry,
      importData,
      resetData,
    }),
    [
      columns,
      tasks,
      timeEntries,
      ready,
      theme,
      setTheme,
      addColumn,
      renameColumn,
      moveColumn,
      deleteColumn,
      saveTask,
      patchTask,
      deleteTask,
      toggleTask,
      addTimeEntry,
      deleteTimeEntry,
      importData,
      resetData,
    ],
  )

  return (
    <DataContext.Provider value={value}>
      {dbBlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Нужно обновить локальное хранилище
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Откройте TaskFlow только в одной вкладке: закройте другие вкладки с приложением и
              обновите страницу.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Обновить
            </button>
          </div>
        </div>
      )}
      {children}
    </DataContext.Provider>
  )
}

export function useData(): DataValue {
  const value = useContext(DataContext)

  if (!value) {
    throw new Error('useData must be used inside DataProvider')
  }

  return value
}
