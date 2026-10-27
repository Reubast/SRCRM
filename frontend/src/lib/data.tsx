import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { newId, readLegacy, type LegacySnapshot } from './db'
import {
  TASK_COLORS,
  type Column,
  type ExportPayload,
  type Priority,
  type Task,
  type TaskDraft,
  type Theme,
  type TimeEntry,
  type TimeEntryDraft,
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

interface StateResponse {
  columns: Column[]
  tasks: Task[]
  timeEntries: TimeEntry[]
}

const DataContext = createContext<DataValue | null>(null)

const PRIORITY_VALUES: Priority[] = ['low', 'medium', 'high']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TASK_FIELDS = [
  'parentId',
  'columnId',
  'title',
  'description',
  'priority',
  'startAt',
  'deadline',
  'completed',
  'color',
] as const

function todayDate(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function legacyKey(userId: number): string {
  return `taskflow-legacy-offered:${userId}`
}

function taskBody(patch: Partial<Task>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const source = patch as Record<string, unknown>

  for (const field of TASK_FIELDS) {
    if (field in source) {
      body[field] = source[field] ?? null
    }
  }

  if ('order' in source) {
    body.order = source.order
  }

  return body
}

function normalizeImport(payload: ExportPayload): LegacySnapshot {
  if (!isRecord(payload) || !Array.isArray(payload.columns) || !Array.isArray(payload.tasks)) {
    throw new Error('Файл не похож на экспорт TaskFlow.')
  }

  const now = new Date().toISOString()
  const columns: Column[] = payload.columns.map((raw, index) => {
    const item: Record<string, unknown> = isRecord(raw) ? raw : {}

    return {
      id: typeof item.id === 'string' && item.id ? item.id : newId(),
      title:
        typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `Колонка ${index + 1}`,
      order: typeof item.order === 'number' ? item.order : index,
      isDone: item.isDone === true,
    }
  })

  if (columns.length === 0) {
    throw new Error('В файле нет ни одной колонки.')
  }

  const tasks: Task[] = payload.tasks
    .filter((raw) => isRecord(raw) && typeof raw.id === 'string' && typeof raw.title === 'string')
    .map((raw) => {
      const item = raw as unknown as Record<string, unknown>
      const priority = PRIORITY_VALUES.includes(item.priority as Priority)
        ? (item.priority as Priority)
        : 'medium'
      const color = TASK_COLORS.some((option) => option.value === item.color)
        ? (item.color as string)
        : null

      return {
        id: item.id as string,
        parentId: typeof item.parentId === 'string' ? item.parentId : null,
        title: (item.title as string).trim() || 'Без названия',
        description: typeof item.description === 'string' ? item.description : '',
        columnId: typeof item.columnId === 'string' ? item.columnId : columns[0].id,
        priority,
        startAt: typeof item.startAt === 'string' ? item.startAt : null,
        deadline: typeof item.deadline === 'string' ? item.deadline : null,
        completed: item.completed === true,
        order: typeof item.order === 'number' ? item.order : 0,
        color,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
      }
    })

  const rawEntries = Array.isArray((payload as { timeEntries?: unknown }).timeEntries)
    ? (payload as { timeEntries: unknown[] }).timeEntries
    : []

  const timeEntries: TimeEntry[] = rawEntries
    .filter((raw) => isRecord(raw) && typeof raw.id === 'string' && typeof raw.taskId === 'string')
    .map((raw) => {
      const item = raw as unknown as Record<string, unknown>
      const minutes =
        typeof item.minutes === 'number' && item.minutes > 0 ? Math.min(1440, Math.round(item.minutes)) : 30

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
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [columns, setColumns] = useState<Column[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loadedFor, setLoadedFor] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [legacy, setLegacy] = useState<LegacySnapshot | null>(null)
  const [legacyBusy, setLegacyBusy] = useState(false)
  const [legacyError, setLegacyError] = useState<string | null>(null)
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  const ready = userId !== null && loadedFor === userId

  const applyState = useCallback((state: StateResponse) => {
    setColumns([...state.columns].sort((a, b) => a.order - b.order))
    setTasks([...state.tasks].sort((a, b) => a.order - b.order))
    setTimeEntries(state.timeEntries)
  }, [])

  useEffect(() => {
    if (userId === null) {
      setColumns([])
      setTasks([])
      setTimeEntries([])
      setLoadedFor(null)
      setLegacy(null)
      setLoadError(null)
      return
    }

    let cancelled = false
    const currentUserId: number = userId

    async function load() {
      const state = await api<StateResponse>('/api/state')

      if (cancelled) {
        return
      }

      applyState(state)
      setLoadError(null)
      setLoadedFor(currentUserId)

      const key = legacyKey(currentUserId)
      const offered = window.localStorage.getItem(key) === '1'

      if (offered || state.tasks.length > 0) {
        window.localStorage.setItem(key, '1')
        return
      }

      const snapshot = await readLegacy()

      if (cancelled) {
        return
      }

      if (snapshot && snapshot.tasks.length + snapshot.timeEntries.length > 0) {
        setLegacy(snapshot)
      } else {
        window.localStorage.setItem(key, '1')
      }
    }

    load().catch((error: unknown) => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить данные.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [userId, reloadKey, applyState])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    window.localStorage.setItem('taskflow-theme', theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
  }, [])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const addColumn = useCallback(
    async (title: string) => {
      const trimmed = title.trim()

      if (!trimmed) {
        return
      }

      const order = columns.reduce((max, column) => Math.max(max, column.order), -1) + 1
      const column = await api<Column>('/api/columns', {
        method: 'POST',
        body: JSON.stringify({ id: newId(), title: trimmed, order, isDone: false }),
      })

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

      const next = await api<Column>(`/api/columns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: trimmed }),
      })

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
      const [first, second] = await Promise.all([
        api<Column>(`/api/columns/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ order: other.order }),
        }),
        api<Column>(`/api/columns/${other.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ order: current.order }),
        }),
      ])

      setColumns((state) =>
        state.map((column) => (column.id === first.id ? first : column.id === second.id ? second : column)),
      )
    },
    [columns],
  )

  const deleteColumn = useCallback(
    async (id: string) => {
      if (columns.length <= 1) {
        return
      }

      await api<{ ok: boolean }>(`/api/columns/${id}`, { method: 'DELETE' })
      // Сервер переносит задачи в первую оставшуюся колонку, проще перечитать состояние.
      reload()
    },
    [columns, reload],
  )

  const saveTask = useCallback(
    async (draft: TaskDraft, id?: string) => {
      const existing = id ? tasks.find((task) => task.id === id) : undefined
      const body = {
        parentId: draft.parentId,
        columnId: draft.columnId,
        title: draft.title.trim() || 'Без названия',
        description: draft.description,
        priority: draft.priority,
        startAt: draft.startAt,
        deadline: draft.deadline,
        completed: draft.completed,
        order: draft.order,
        color: draft.color === undefined ? (existing?.color ?? null) : draft.color,
      }

      if (existing) {
        const updated = await api<Task>(`/api/tasks/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })

        setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)))

        return updated
      }

      const created = await api<Task>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ id: newId(), ...body }),
      })

      setTasks((current) => [...current, created])

      return created
    },
    [tasks],
  )

  const patchTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const updated = await api<Task>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(taskBody(patch)),
      })

      setTasks((current) => current.map((task) => (task.id === id ? updated : task)))
    },
    [],
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

      await api<{ ok: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' })

      const removedEntries = new Set(
        timeEntries.filter((entry) => ids.has(entry.taskId)).map((entry) => entry.id),
      )

      setTasks((current) => current.filter((task) => !ids.has(task.id)))
      setTimeEntries((current) => current.filter((entry) => !removedEntries.has(entry.id)))
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

  const addTimeEntry = useCallback(async (draft: TimeEntryDraft) => {
    const minutes = Math.round(draft.minutes)

    if (minutes <= 0) {
      return
    }

    const entry = await api<TimeEntry>('/api/time-entries', {
      method: 'POST',
      body: JSON.stringify({
        id: newId(),
        taskId: draft.taskId,
        date: DATE_PATTERN.test(draft.date) ? draft.date : todayDate(),
        minutes: Math.min(1440, minutes),
        note: draft.note.trim(),
      }),
    })

    setTimeEntries((current) => [entry, ...current])
  }, [])

  const deleteTimeEntry = useCallback(async (id: string) => {
    await api<{ ok: boolean }>(`/api/time-entries/${id}`, { method: 'DELETE' })
    setTimeEntries((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const importData = useCallback(
    async (payload: ExportPayload) => {
      const normalized = normalizeImport(payload)
      const state = await api<StateResponse>('/api/state/import', {
        method: 'POST',
        body: JSON.stringify({ mode: 'replace', payload: normalized }),
      })

      applyState(state)
    },
    [applyState],
  )

  const resetData = useCallback(async () => {
    const state = await api<StateResponse>('/api/state', { method: 'DELETE' })

    applyState(state)
  }, [applyState])

  const acceptLegacy = useCallback(async () => {
    if (!legacy || userId === null) {
      return
    }

    setLegacyBusy(true)
    setLegacyError(null)

    try {
      const state = await api<StateResponse>('/api/state/import', {
        method: 'POST',
        body: JSON.stringify({ mode: 'merge', payload: legacy }),
      })

      applyState(state)
      window.localStorage.setItem(legacyKey(userId), '1')
      setLegacy(null)
    } catch (error) {
      setLegacyError(error instanceof Error ? error.message : 'Не удалось перенести данные.')
    } finally {
      setLegacyBusy(false)
    }
  }, [legacy, userId, applyState])

  const declineLegacy = useCallback(() => {
    if (userId !== null) {
      window.localStorage.setItem(legacyKey(userId), '1')
    }

    setLegacy(null)
    setLegacyError(null)
  }, [userId])

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
      {loadError && userId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Не удалось загрузить задачи</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(null)
                reload()
              }}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Повторить
            </button>
          </div>
        </div>
      )}
      {legacy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Перенести задачи в аккаунт?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              В этом браузере найдены задачи, которые были сохранены до входа в аккаунт:{' '}
              {legacy.tasks.length} задач, {legacy.timeEntries.length} записей времени. После переноса они будут
              доступны с любого устройства под этим аккаунтом.
            </p>
            {legacyError && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{legacyError}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={declineLegacy}
                disabled={legacyBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Не переносить
              </button>
              <button
                type="button"
                onClick={() => void acceptLegacy()}
                disabled={legacyBusy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {legacyBusy ? 'Переносим…' : 'Перенести'}
              </button>
            </div>
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
