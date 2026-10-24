import { useMemo, useState } from 'react'
import { useData } from '../lib/data'
import type { Priority, Task } from '../lib/types'
import { PRIORITY_LABELS, PRIORITIES } from '../lib/types'
import {
  branchMinutes,
  formatDateTime,
  isOverdue,
  matchesDue,
  minutesLabel,
  plainDescription,
  priorityStyles,
  progressOf,
  sortTasks,
  type DueFilter,
} from '../lib/utils'
import { TaskModal } from '../components/TaskModal'

export function TasksPage() {
  const { columns, tasks, timeEntries, ready, deleteTask, toggleTask } = useData()
  const [query, setQuery] = useState('')
  const [columnFilter, setColumnFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all')
  const [due, setDue] = useState<DueFilter>('all')
  const [sortMode, setSortMode] = useState<'manual' | 'deadline' | 'priority' | 'created'>('manual')
  const [modal, setModal] = useState<string | 'new' | null>(null)

  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns])
  const doneColumnIds = useMemo(
    () => new Set(columns.filter((column) => column.isDone).map((column) => column.id)),
    [columns],
  )
  const columnTitles = useMemo(
    () => new Map(columns.map((column) => [column.id, column.title])),
    [columns],
  )

  const subtasksByParent = useMemo(() => {
    const map = new Map<string, Task[]>()

    for (const task of tasks) {
      if (!task.parentId) {
        continue
      }

      const list = map.get(task.parentId) ?? []
      list.push(task)
      map.set(task.parentId, list)
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order)
    }

    return map
  }, [tasks])

  const minutesByTask = useMemo(() => {
    const map = new Map<string, number>()

    for (const entry of timeEntries) {
      map.set(entry.taskId, (map.get(entry.taskId) ?? 0) + entry.minutes)
    }

    return map
  }, [timeEntries])

  const roots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const filtered = tasks
      .filter((task) => !task.parentId)
      .filter((task) => columnFilter === 'all' || task.columnId === columnFilter)
      .filter((task) => priorityFilter === 'all' || task.priority === priorityFilter)
      .filter((task) => matchesDue(task.deadline, due, doneColumnIds.has(task.columnId)))
      .filter((task) => {
        if (!normalizedQuery) {
          return true
        }

        if (
          task.title.toLowerCase().includes(normalizedQuery) ||
          task.description.toLowerCase().includes(normalizedQuery)
        ) {
          return true
        }

        return (subtasksByParent.get(task.id) ?? []).some((subtask) =>
          subtask.title.toLowerCase().includes(normalizedQuery),
        )
      })

    return filtered.sort((a, b) => sortTasks(a, b, sortMode))
  }, [tasks, columnFilter, priorityFilter, due, query, sortMode, subtasksByParent, doneColumnIds])

  const total = tasks.filter((task) => !task.parentId).length
  const shown = roots.length

  if (!ready) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Все задачи</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Показано {shown} из {total} задач верхнего уровня.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModal('new')}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Новая задача
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по названию и описанию"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none lg:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />

        <select
          value={columnFilter}
          onChange={(event) => setColumnFilter(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="all">Все колонки</option>
          {sortedColumns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as 'all' | Priority)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="all">Все приоритеты</option>
          {PRIORITIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={due}
            onChange={(event) => setDue(event.target.value as DueFilter)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">Дедлайн: все</option>
            <option value="overdue">Просроченные</option>
            <option value="today">Сегодня</option>
            <option value="week">Неделя</option>
            <option value="none">Без дедлайна</option>
          </select>

          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as 'manual' | 'deadline' | 'priority' | 'created')
            }
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="manual">Вручную</option>
            <option value="deadline">Дедлайн</option>
            <option value="priority">Приоритет</option>
            <option value="created">Новые</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="px-3 py-2 font-medium">Задача</th>
              <th className="px-3 py-2 font-medium">Колонка</th>
              <th className="px-3 py-2 font-medium">Приоритет</th>
              <th className="px-3 py-2 font-medium">Дедлайн</th>
              <th className="px-3 py-2 font-medium">Время</th>
              <th className="px-3 py-2 font-medium">Прогресс</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {roots.map((task) => {
              const subtasks = subtasksByParent.get(task.id) ?? []
              const progress = progressOf(task, tasks, columns)
              const done = columns.find((column) => column.id === task.columnId)?.isDone ?? false

              return (
                <TaskRows
                  key={task.id}
                  task={task}
                  subtasks={subtasks}
                  progress={progress}
                  columnTitle={columnTitles.get(task.columnId) ?? '—'}
                  done={done}
                  minutes={branchMinutes(task, tasks, timeEntries)}
                  minutesByTask={minutesByTask}
                  onOpen={() => setModal(task.id)}
                  onToggle={() => void toggleTask(task.id)}
                  onOpenSubtask={(id) => setModal(id)}
                  onToggleSubtask={(id) => void toggleTask(id)}
                  onDelete={() => {
                    if (
                      window.confirm(
                        subtasks.length
                          ? `Удалить задачу «${task.title}» и ${subtasks.length} подзадач(и)?`
                          : `Удалить задачу «${task.title}»?`,
                      )
                    ) {
                      void deleteTask(task.id)
                    }
                  }}
                />
              )
            })}

            {roots.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Задач не найдено.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'new' && (
        <TaskModal
          defaultColumnId={sortedColumns[0]?.id ?? ''}
          defaultOrder={
            tasks
              .filter((task) => task.columnId === sortedColumns[0]?.id && !task.parentId)
              .reduce((max, task) => Math.max(max, task.order), -1) + 1
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal && modal !== 'new' && <TaskModal taskId={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

interface TaskRowsProps {
  task: Task
  subtasks: Task[]
  progress: { done: number; total: number; percent: number }
  columnTitle: string
  done: boolean
  minutes: number
  minutesByTask: Map<string, number>
  onOpen: () => void
  onToggle: () => void
  onOpenSubtask: (id: string) => void
  onToggleSubtask: (id: string) => void
  onDelete: () => void
}

function TaskRows({
  task,
  subtasks,
  progress,
  columnTitle,
  done,
  minutes,
  minutesByTask,
  onOpen,
  onToggle,
  onOpenSubtask,
  onToggleSubtask,
  onDelete,
}: TaskRowsProps) {
  const overdue = isOverdue(task, done)
  const hasSubtasks = subtasks.length > 0

  return (
    <>
      <tr className="border-b border-slate-100 align-top dark:border-slate-800/70">
        <td className="px-3 py-2">
          <div className="flex items-start gap-2">
            {!hasSubtasks && (
              <input
                type="checkbox"
                checked={task.completed}
                onChange={onToggle}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                aria-label="Выполнено"
              />
            )}
            <button type="button" onClick={onOpen} className="min-w-0 text-left">
              <span
                className={[
                  'font-medium',
                  done || task.completed
                    ? 'text-slate-400 line-through dark:text-slate-500'
                    : 'text-slate-800 dark:text-slate-100',
                ].join(' ')}
              >
                {task.title}
              </span>
              {task.description && (
                <span className="mt-0.5 block line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                  {plainDescription(task.description)}
                </span>
              )}
            </button>
          </div>
        </td>

        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{columnTitle}</td>

        <td className="px-3 py-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${priorityStyles[task.priority]}`}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        </td>

        <td className="px-3 py-2">
          <span
            className={
              overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
            }
          >
            {formatDateTime(task.deadline)}
          </span>
        </td>

        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
          {minutes > 0 ? minutesLabel(minutes) : '—'}
        </td>

        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {hasSubtasks ? `${progress.done}/${progress.total}` : `${progress.percent}%`}
            </span>
          </div>
        </td>

        <td className="px-3 py-2 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={onOpen}
            className="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Открыть
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            Удалить
          </button>
        </td>
      </tr>

      {subtasks.map((subtask) => (
        <tr
          key={subtask.id}
          className="border-b border-slate-100 bg-slate-50/60 align-top dark:border-slate-800/70 dark:bg-slate-950/40"
        >
          <td className="py-2 pr-3 pl-9">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => onToggleSubtask(subtask.id)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                aria-label="Выполнено"
              />
              <button type="button" onClick={() => onOpenSubtask(subtask.id)} className="text-left">
                <span
                  className={
                    subtask.completed
                      ? 'text-slate-400 line-through dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-200'
                  }
                >
                  {subtask.title}
                </span>
              </button>
            </div>
          </td>
          <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">подзадача</td>
          <td className="px-3 py-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${priorityStyles[subtask.priority]}`}
            >
              {PRIORITY_LABELS[subtask.priority]}
            </span>
          </td>
          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            {formatDateTime(subtask.deadline)}
          </td>
          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            {(minutesByTask.get(subtask.id) ?? 0) > 0
              ? minutesLabel(minutesByTask.get(subtask.id) ?? 0)
              : '—'}
          </td>
          <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">—</td>
          <td className="px-3 py-2 text-right">
            <button
              type="button"
              onClick={() => onOpenSubtask(subtask.id)}
              className="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Открыть
            </button>
          </td>
        </tr>
      ))}
    </>
  )
}
