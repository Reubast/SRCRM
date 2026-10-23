import { useMemo, useState, type FormEvent } from 'react'
import { TaskModal } from '../components/TaskModal'
import { useData } from '../lib/data'
import {
  entryMinutes,
  matchesPeriod,
  minutesLabel,
  type TimePeriod,
} from '../lib/utils'

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё время' },
]

const fieldClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'

function todayValue(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function entryDateLabel(date: string): string {
  const [year, month, day] = date.split('-')

  return year && month && day ? `${day}.${month}.${year}` : date
}

export function TimePage() {
  const { tasks, timeEntries, ready, addTimeEntry, deleteTimeEntry } = useData()
  const [period, setPeriod] = useState<TimePeriod>('week')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<string | null>(null)

  const [taskId, setTaskId] = useState('')
  const [date, setDate] = useState(todayValue)
  const [minutes, setMinutes] = useState('30')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (Boolean(a.parentId) !== Boolean(b.parentId)) {
          return a.parentId ? 1 : -1
        }

        return a.title.localeCompare(b.title, 'ru')
      }),
    [tasks],
  )

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return timeEntries
      .filter((entry) => matchesPeriod(entry.date, period))
      .filter((entry) => {
        if (!normalizedQuery) {
          return true
        }

        const title = taskById.get(entry.taskId)?.title ?? ''

        return (
          title.toLowerCase().includes(normalizedQuery) ||
          entry.note.toLowerCase().includes(normalizedQuery)
        )
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [timeEntries, period, query, taskById])

  const total = entryMinutes(filtered)
  const uniqueTasks = new Set(filtered.map((entry) => entry.taskId)).size

  const byTask = useMemo(() => {
    const map = new Map<string, number>()

    for (const entry of filtered) {
      map.set(entry.taskId, (map.get(entry.taskId) ?? 0) + entry.minutes)
    }

    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

  async function handleAdd(event: FormEvent) {
    event.preventDefault()

    if (!taskId) {
      setError('Выберите задачу.')
      return
    }

    const value = Number(minutes)

    if (!Number.isFinite(value) || value <= 0) {
      setError('Укажите количество минут больше нуля.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await addTimeEntry({ taskId, date, minutes: value, note })
      setNote('')
    } catch {
      setError('Не удалось сохранить трудозатраты.')
    } finally {
      setSaving(false)
    }
  }

  if (!ready) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Трудозатраты</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Учёт времени по задачам и подзадачам. Записи также доступны в карточке задачи.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Всего за период</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {minutesLabel(total)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Записей</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{filtered.length}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3 sm:col-span-1 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Задач</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{uniqueTasks}</p>
        </div>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Задача
          <select
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Выберите задачу</option>
            {sortedTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.parentId ? `· ${task.title}` : task.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Дата
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Минуты
          <input
            type="number"
            min={1}
            max={1440}
            step={5}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className={`${fieldClass} w-24`}
          />
        </label>

        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          Комментарий
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Что делали"
            className={fieldClass}
          />
        </label>

        <button
          type="submit"
          disabled={saving || tasks.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Добавить
        </button>

        {error && <p className="w-full text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as TimePeriod)}
          className={fieldClass}
        >
          {PERIODS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по задаче и комментарию"
          className={`${fieldClass} min-w-[14rem] flex-1 sm:max-w-sm`}
        />
      </div>

      {byTask.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Сводка по задачам</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {byTask.map(([id, value]) => {
              const task = taskById.get(id)
              const percent = total > 0 ? Math.round((value / total) * 100) : 0

              return (
                <li key={id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModal(id)}
                    className="min-w-0 flex-1 truncate text-left text-sm text-slate-700 transition hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400"
                  >
                    {task?.title ?? 'Удалённая задача'}
                  </button>
                  <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                    {minutesLabel(value)}
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs text-slate-400 dark:text-slate-500">
                    {percent}%
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="px-3 py-2 font-medium">Дата</th>
              <th className="px-3 py-2 font-medium">Задача</th>
              <th className="px-3 py-2 font-medium">Время</th>
              <th className="px-3 py-2 font-medium">Комментарий</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const task = taskById.get(entry.taskId)

              return (
                <tr key={entry.id} className="border-b border-slate-100 dark:border-slate-800/70">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
                    {entryDateLabel(entry.date)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setModal(entry.taskId)}
                      className="text-left font-medium text-slate-800 transition hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                    >
                      {task?.title ?? 'Удалённая задача'}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
                    {minutesLabel(entry.minutes)}
                  </td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{entry.note || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => void deleteTimeEntry(entry.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Записей за период нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <TaskModal taskId={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
