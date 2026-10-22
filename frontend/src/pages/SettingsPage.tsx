import { useRef, useState, type ChangeEvent } from 'react'
import { format } from 'date-fns'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import type { ExportPayload } from '../lib/types'

type Status = { kind: 'ok' | 'error'; text: string } | null

export function SettingsPage() {
  const { user, logout } = useAuth()
  const { columns, tasks, theme, setTheme, importData, resetData } = useData()
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>(null)

  function handleExport() {
    const payload: ExportPayload = {
      app: 'taskflow',
      version: 1,
      exportedAt: new Date().toISOString(),
      columns,
      tasks,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `taskflow-${format(new Date(), 'yyyy-MM-dd')}.json`
    link.click()
    URL.revokeObjectURL(url)
    setStatus({ kind: 'ok', text: `Экспортировано задач: ${tasks.length}.` })
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray((parsed as { columns?: unknown }).columns) ||
        !Array.isArray((parsed as { tasks?: unknown }).tasks)
      ) {
        throw new Error('В файле нет колонок и задач TaskFlow.')
      }

      if (
        !window.confirm(
          'Импорт заменит все текущие задачи и колонки в этом браузере. Продолжить?',
        )
      ) {
        return
      }

      await importData(parsed as ExportPayload)
      setStatus({ kind: 'ok', text: 'Данные импортированы.' })
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Не удалось импортировать файл.',
      })
    } finally {
      event.target.value = ''
    }
  }

  async function handleReset() {
    if (
      !window.confirm(
        'Удалить все задачи и вернуть стандартные колонки? Это действие нельзя отменить.',
      )
    ) {
      return
    }

    await resetData()
    setStatus({ kind: 'ok', text: 'Данные очищены.' })
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Настройки</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Задачи хранятся локально в этом браузере (IndexedDB). Экспортируйте JSON для резервной копии
          или переноса на другое устройство.
        </p>
      </div>

      {status && (
        <div
          className={[
            'rounded-xl border px-3 py-2 text-sm',
            status.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-300',
          ].join(' ')}
        >
          {status.text}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Тема оформления
        </h2>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={[
              'rounded-lg border px-4 py-2 text-sm font-medium transition',
              theme === 'light'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            Светлая
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={[
              'rounded-lg border px-4 py-2 text-sm font-medium transition',
              theme === 'dark'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            Тёмная
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Тема применяется сразу и сохраняется в браузере.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Данные
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Колонок: {columns.length}, задач и подзадач: {tasks.length}.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Экспорт в JSON
          </button>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Импорт из JSON
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            Очистить всё
          </button>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Аккаунт
        </h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          {user?.name} · {user?.email} · роль: {user?.role}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {user?.role === 'admin' && (
            <a
              href="/admin/users"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Управление пользователями
            </a>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Выйти
          </button>
        </div>
      </section>
    </div>
  )
}
