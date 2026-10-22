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
  deadline: string | null
  completed: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export type Theme = 'light' | 'dark'

export interface ExportPayload {
  app: 'taskflow'
  version: 1
  exportedAt: string
  columns: Column[]
  tasks: Task[]
}

export interface TaskDraft {
  title: string
  description: string
  columnId: string
  priority: Priority
  deadline: string | null
  parentId: string | null
  completed: boolean
  order: number
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
