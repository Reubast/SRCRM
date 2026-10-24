import {
  addDays,
  endOfDay,
  format,
  isPast,
  isThisMonth,
  isThisWeek,
  isToday,
  isTomorrow,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Column, Priority, Task, TimeEntry } from './types'

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

export function isOverdue(task: Task, inDoneColumn: boolean): boolean {
  if (!task.deadline || task.completed || inDoneColumn) {
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

export function matchesDue(iso: string | null, filter: DueFilter, inDoneColumn = false): boolean {
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
    return !inDoneColumn && isPast(date) && !isToday(date)
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

export type ProgressTone = 'gray' | 'amber' | 'green'

// Пороги прогресса: 0–33% серый, 34–99% янтарный, 100% зелёный.
export function progressTone(percent: number): ProgressTone {
  if (percent >= 100) {
    return 'green'
  }

  return percent > 33 ? 'amber' : 'gray'
}

export const progressBarClasses: Record<ProgressTone, string> = {
  gray: 'bg-slate-400',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
}

export const progressHex: Record<ProgressTone, string> = {
  gray: '#94a3b8',
  amber: '#d97706',
  green: '#059669',
}

// Картинки хранятся прямо в описании: ![](data:image/...;base64,...)
const IMAGE_SOURCE = 'data:image\\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+'
export const IMAGE_TOKEN_PATTERN = new RegExp(`!\\[\\]\\((${IMAGE_SOURCE})\\)`, 'g')
export const MAX_IMAGES_PER_TASK = 5

export type DescriptionPart = { kind: 'text'; value: string } | { kind: 'image'; src: string }

export function splitDescription(text: string): DescriptionPart[] {
  const parts: DescriptionPart[] = []
  let last = 0

  for (const match of text.matchAll(IMAGE_TOKEN_PATTERN)) {
    const index = match.index ?? 0

    if (index > last) {
      parts.push({ kind: 'text', value: text.slice(last, index) })
    }

    parts.push({ kind: 'image', src: match[1] })
    last = index + match[0].length
  }

  if (last < text.length) {
    parts.push({ kind: 'text', value: text.slice(last) })
  }

  return parts
}

export function countImages(text: string): number {
  return Array.from(text.matchAll(IMAGE_TOKEN_PATTERN)).length
}

export function plainDescription(text: string): string {
  return text.replace(IMAGE_TOKEN_PATTERN, ' [фото] ').replace(/\s+/g, ' ').trim()
}

export function imageToken(src: string): string {
  return `![](${src})`
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

export type TimePeriod = 'today' | 'week' | 'month' | 'all'

export function minutesLabel(total: number): string {
  const safe = Math.max(0, Math.round(total))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60

  if (hours > 0 && minutes > 0) {
    return `${hours} ч ${minutes} мин`
  }

  if (hours > 0) {
    return `${hours} ч`
  }

  return `${minutes} мин`
}

export function entryMinutes(entries: TimeEntry[]): number {
  return entries.reduce((total, entry) => total + entry.minutes, 0)
}

export function matchesPeriod(date: string, period: TimePeriod): boolean {
  if (period === 'all') {
    return true
  }

  const parsed = parseISO(date)

  if (period === 'today') {
    return isToday(parsed)
  }

  if (period === 'week') {
    return isThisWeek(parsed, { weekStartsOn: 1 })
  }

  return isThisMonth(parsed)
}

export function branchMinutes(task: Task, tasks: Task[], entries: TimeEntry[]): number {
  const ids = new Set<string>([task.id])

  for (const item of tasks) {
    if (item.parentId === task.id) {
      ids.add(item.id)
    }
  }

  return entries
    .filter((entry) => ids.has(entry.taskId))
    .reduce((total, entry) => total + entry.minutes, 0)
}
