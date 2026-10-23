import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { useData } from '../lib/data'
import type { Priority, Task } from '../lib/types'
import { PRIORITIES } from '../lib/types'
import {
  formatDateTime,
  fromDateTimeInput,
  minutesLabel,
  progressOf,
  toDateTimeInput,
} from '../lib/utils'

interface TaskModalProps {
  taskId?: string
  defaultColumnId?: string
  defaultStartAt?: string | null
  defaultDeadline?: string | null
  defaultOrder?: number
  onClose: () => void
}

const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

const labelClass = 'flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'

function todayValue(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function entryDateLabel(date: string): string {
  const [year, month, day] = date.split('-')

  return year && month && day ? `${day}.${month}.${year}` : date
}

export function TaskModal({
  taskId,
  defaultColumnId,
  defaultStartAt = null,
  defaultDeadline = null,
  defaultOrder = 0,
  onClose,
}: TaskModalProps) {
  const {
    columns,
    tasks,
    timeEntries,
    saveTask,
    patchTask,
    deleteTask,
    toggleTask,
    addTimeEntry,
    deleteTimeEntry,
  } = useData()
  const task = taskId ? tasks.find((item) => item.id === taskId) : undefined
  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  )

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [columnId, setColumnId] = useState(
    task?.columnId ?? defaultColumnId ?? sortedColumns[0]?.id ?? '',
  )
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [startAt, setStartAt] = useState(toDateTimeInput(task?.startAt ?? defaultStartAt))
  const [deadline, setDeadline] = useState(toDateTimeInput(task?.deadline ?? defaultDeadline))
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [entryDate, setEntryDate] = useState(todayValue)
  const [entryMinutes, setEntryMinutes] = useState('30')
  const [entryNote, setEntryNote] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)
  const [savingTime, setSavingTime] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const subtasks = useMemo(
    () =>
      task
        ? tasks
            .filter((item) => item.parentId === task.id)
            .sort((a, b) => a.order - b.order)
        : [],
    [task, tasks],
  )

  const taskEntries = useMemo(
    () =>
      task
        ? timeEntries
            .filter((entry) => entry.taskId === task.id)
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        : [],
    [task, timeEntries],
  )

  const totalMinutes = taskEntries.reduce((total, entry) => total + entry.minutes, 0)
  const progress = task ? progressOf(task, tasks, columns) : null
  const parent = task?.parentId ? tasks.find((item) => item.id === task.parentId) : undefined

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!title.trim() || !columnId) {
      return
    }

    const nextStart = fromDateTimeInput(startAt)
    const nextDeadline = fromDateTimeInput(deadline)

    if (nextStart && nextDeadline && nextStart > nextDeadline) {
      setError('Начало не может быть позже дедлайна.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await saveTask(
        {
          title,
          description,
          columnId,
          priority,
          startAt: nextStart,
          deadline: nextDeadline,
          parentId: task?.parentId ?? null,
          completed: task?.completed ?? false,
          order: task?.order ?? defaultOrder,
        },
        task?.id,
      )
      onClose()
    } catch {
      setError('Не удалось сохранить задачу.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task) {
      return
    }

    const message = subtasks.length
      ? `Удалить задачу «${task.title}» и её подзадачи (${subtasks.length})?`
      : `Удалить задачу «${task.title}»?`

    if (!window.confirm(message)) {
      return
    }

    await deleteTask(task.id)
    onClose()
  }

  async function handleAddSubtask(event: FormEvent) {
    event.preventDefault()

    if (!task || !subtaskTitle.trim()) {
      return
    }

    const order = subtasks.reduce((max, item) => Math.max(max, item.order), 0) + 1

    await saveTask({
      title: subtaskTitle,
      description: '',
      columnId: task.columnId,
      priority: task.priority,
      startAt: null,
      deadline: null,
      parentId: task.id,
      completed: false,
      order,
    })

    setSubtaskTitle('')
  }

  async function handleAddTime() {
    if (!task) {
      return
    }

    const minutes = Number(entryMinutes)

    if (!Number.isFinite(minutes) || minutes <= 0) {
      setTimeError('Укажите количество минут больше нуля.')
      return
    }

    setSavingTime(true)
    setTimeError(null)

    try {
      await addTimeEntry({
        taskId: task.id,
        date: entryDate,
        minutes,
        note: entryNote,
      })
      setEntryNote('')
    } catch {
      setTimeError('Не удалось добавить трудозатраты.')
    } finally {
      setSavingTime(false)
    }
  }

  function stopPropagation(event: MouseEvent) {
    event.stopPropagation()
  }

  if (sortedColumns.length === 0) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        onMouseDown={stopPropagation}
        className="my-2 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:my-6 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {task ? 'Задача' : 'Новая задача'}
            </h2>
            {parent && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Подзадача задачи «{parent.title}»
              </p>
            )}
            {progress && subtasks.length > 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Прогресс: {progress.done} из {progress.total} ({progress.percent}%)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Закрыть"
          >
            Закрыть
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <label className={labelClass}>
            Название
            <input
              className={fieldClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Что нужно сделать?"
              autoFocus
              required
            />
          </label>

          <label className={labelClass}>
            Описание
            <textarea
              className={`${fieldClass} min-h-[90px] resize-y`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Детали, ссылки, критерии готовности"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Колонка
              <select
                className={fieldClass}
                value={columnId}
                onChange={(event) => setColumnId(event.target.value)}
              >
                {sortedColumns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Приоритет
              <select
                className={fieldClass}
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {PRIORITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Начало
              <input
                type="datetime-local"
                className={fieldClass}
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
              />
            </label>

            <label className={labelClass}>
              Дедлайн
              <input
                type="datetime-local"
                className={fieldClass}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </label>
          </div>

          {task && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Трудозатраты {totalMinutes > 0 && `(${minutesLabel(totalMinutes)})`}
                </h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">Всего по задаче</span>
              </div>

              {taskEntries.length > 0 && (
                <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                  {taskEntries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 py-1.5">
                      <span className="w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {entryDateLabel(entry.date)}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-slate-800 dark:text-slate-100">
                        {minutesLabel(entry.minutes)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {entry.note || '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void deleteTimeEntry(entry.id)}
                        className="rounded px-1.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Дата
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(event) => setEntryDate(event.target.value)}
                    className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Минуты
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    step={5}
                    value={entryMinutes}
                    onChange={(event) => setEntryMinutes(event.target.value)}
                    className="w-20 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                </label>

                <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Комментарий
                  <input
                    value={entryNote}
                    onChange={(event) => setEntryNote(event.target.value)}
                    placeholder="Что делали"
                    className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleAddTime()}
                  disabled={savingTime}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Добавить
                </button>
              </div>

              {timeError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{timeError}</p>}
            </div>
          )}

          {task && !task.parentId && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Подзадачи {subtasks.length > 0 && `(${subtasks.length})`}
                </h3>
                {subtasks.length === 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Прогресс считается по подзадачам
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-col gap-2">
                {subtasks.map((subtask) => (
                  <SubtaskRow
                    key={subtask.id}
                    task={subtask}
                    onPatch={patchTask}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                  />
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  className={fieldClass}
                  value={subtaskTitle}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  placeholder="Новая подзадача"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void handleAddSubtask(event)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!subtaskTitle.trim()}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}

          {task && task.parentId && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => void toggleTask(task.id)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Выполнена
            </label>
          )}

          {!task && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Сохраните задачу, чтобы добавить подзадачи и трудозатраты.
            </p>
          )}

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            {task && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                Удалить
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

interface SubtaskRowProps {
  task: Task
  onPatch: (id: string, patch: Partial<Task>) => Promise<void>
  onToggle: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function SubtaskRow({ task, onPatch, onToggle, onDelete }: SubtaskRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800/60">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => void onToggle(task.id)}
        className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />

      <input
        defaultValue={task.title}
        onBlur={(event) => {
          const next = event.target.value.trim()

          if (next && next !== task.title) {
            void onPatch(task.id, { title: next })
          }
        }}
        className="min-w-[8rem] flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-800 outline-none focus:border-slate-300 focus:bg-white dark:text-slate-100 dark:focus:border-slate-600 dark:focus:bg-slate-950"
      />

      <input
        type="datetime-local"
        value={toDateTimeInput(task.deadline)}
        onChange={(event) => void onPatch(task.id, { deadline: fromDateTimeInput(event.target.value) })}
        className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
        title={formatDateTime(task.deadline)}
      />

      <button
        type="button"
        onClick={() => void onDelete(task.id)}
        className="rounded px-1.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        aria-label="Удалить подзадачу"
      >
        Удалить
      </button>
    </div>
  )
}
