import {
  addDays,
  endOfDay,
  format,
  isPast,
  isToday,
  isTomorrow,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Column, Priority, Task } from './types'

export type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'none'

export interface Progress {
  done: number
  total: number
  percent: number
}

export function deadlineLabel(iso: string | null): string {
  if (!iso) {
    return ''
  }

  const date = parseISO(iso)

  if (isToday(date)) {
    return `Сегодня, ${format(date, 'HH:mm')}`
  }

  if (isTomorrow(date)) {
    return `Завтра, ${format(date, 'HH:mm')}`
  }

  return format(date, 'd MMM, HH:mm', { locale: ru })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }

  return format(parseISO(iso), 'd MMM yyyy, HH:mm', { locale: ru })
}

export function isOverdue(task: Task): boolean {
  if (!task.deadline || task.completed) {
    return false
  }

  return isPast(parseISO(task.deadline))
}

export function isAllDay(iso: string): boolean {
  const date = parseISO(iso)

  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
}

export function toDateTimeInput(iso: string | null): string {
  if (!iso) {
    return ''
  }

  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
}

export function fromDateTimeInput(value: string): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function atMidnight(date: Date): string {
  return startOfDay(date).toISOString()
}

export function matchesDue(iso: string | null, filter: DueFilter): boolean {
  if (filter === 'all') {
    return true
  }

  if (filter === 'none') {
    return !iso
  }

  if (!iso) {
    return false
  }

  const date = parseISO(iso)

  if (filter === 'overdue') {
    return isPast(date) && !isToday(date)
  }

  if (filter === 'today') {
    return isToday(date)
  }

  return isWithinInterval(date, {
    start: startOfDay(new Date()),
    end: endOfDay(addDays(new Date(), 7)),
  })
}

export function progressOf(task: Task, tasks: Task[], columns: Column[]): Progress {
  if (task.parentId) {
    const percent = task.completed ? 100 : 0

    return { done: task.completed ? 1 : 0, total: 1, percent }
  }

  const subtasks = tasks.filter((item) => item.parentId === task.id)

  if (subtasks.length > 0) {
    const done = subtasks.filter((item) => item.completed).length

    return {
      done,
      total: subtasks.length,
      percent: Math.round((done / subtasks.length) * 100),
    }
  }

  const column = columns.find((item) => item.id === task.columnId)
  const percent = column?.isDone ? 100 : 0

  return { done: column?.isDone ? 1 : 0, total: 1, percent }
}

export const priorityStyles: Record<Priority, string> = {
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

export const priorityBars: Record<Priority, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
}

export const priorityEventColors: Record<Priority, string> = {
  high: '#e11d48',
  medium: '#d97706',
  low: '#059669',
}

export function sortTasks(a: Task, b: Task, mode: 'manual' | 'deadline' | 'priority' | 'created'): number {
  if (mode === 'deadline') {
    if (!a.deadline && !b.deadline) return a.order - b.order
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline.localeCompare(b.deadline)
  }

  if (mode === 'priority') {
    const weight: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
    return weight[a.priority] - weight[b.priority] || a.order - b.order
  }

  if (mode === 'created') {
    return b.createdAt.localeCompare(a.createdAt)
  }

  return a.order - b.order
}
