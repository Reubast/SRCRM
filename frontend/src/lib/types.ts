export type Priority = 'low' | 'medium' | 'high'

export interface Column {
  id: string
  title: string
  order: number
  isDone: boolean
}

export interface Task {
  id: string
  parentId: string | null
  title: string
  description: string
  columnId: string
  priority: Priority
  startAt: string | null
  deadline: string | null
  completed: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface TimeEntry {
  id: string
  taskId: string
  date: string
  minutes: number
  note: string
  createdAt: string
}

export type Theme = 'light' | 'dark'

export interface ExportPayload {
  app: 'taskflow'
  version: 2
  exportedAt: string
  columns: Column[]
  tasks: Task[]
  timeEntries: TimeEntry[]
}

export interface TaskDraft {
  title: string
  description: string
  columnId: string
  priority: Priority
  startAt: string | null
  deadline: string | null
  parentId: string | null
  completed: boolean
  order: number
}

export interface TimeEntryDraft {
  taskId: string
  date: string
  minutes: number
  note: string
}

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low', label: 'Низкий' },
]

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}
