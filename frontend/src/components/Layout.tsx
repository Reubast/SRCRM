import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'

const links = [
  { to: '/kanban', label: 'Канбан' },
  { to: '/calendar', label: 'Календарь' },
  { to: '/tasks', label: 'Все задачи' },
  { to: '/time', label: 'Время' },
  { to: '/settings', label: 'Настройки' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition',
    isActive
      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  ].join(' ')

export function Layout() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useData()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const current = links.find((link) => location.pathname.startsWith(link.to))
    document.title = current ? `${current.label} · TaskFlow` : 'TaskFlow'
  }, [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/kanban" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            TaskFlow
          </NavLink>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto sm:flex-1">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
            {user?.role === 'admin' && (
              <a
                href="/admin/users"
                className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:block dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                Админка
              </a>
            )}

            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Переключить тему"
            >
              {theme === 'dark' ? 'Светлая' : 'Тёмная'}
            </button>

            <span className="hidden max-w-[12rem] truncate text-sm text-slate-600 sm:block dark:text-slate-300">
              {user?.name}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}
