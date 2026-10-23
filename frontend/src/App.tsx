import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuth } from './lib/auth'
import { KanbanPage } from './pages/KanbanPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { TasksPage } from './pages/TasksPage'
import { TimePage } from './pages/TimePage'

const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })),
)

function RequireAuth() {
  const { user, ready } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Загрузка…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Layout />
}

function PageFallback() {
  return <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка…</p>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route index element={<Navigate to="/kanban" replace />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route
          path="/calendar"
          element={
            <Suspense fallback={<PageFallback />}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/time" element={<TimePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/kanban" replace />} />
    </Routes>
  )
}
