import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useData } from '../lib/data'
import type { Column, Priority, Task } from '../lib/types'
import { PRIORITY_LABELS, PRIORITIES } from '../lib/types'
import {
  branchMinutes,
  deadlineLabel,
  isOverdue,
  matchesDue,
  minutesLabel,
  plainDescription,
  priorityStyles,
  progressBarClasses,
  progressOf,
  progressTone,
  sortTasks,
  type DueFilter,
} from '../lib/utils'
import { TaskModal } from '../components/TaskModal'

type ModalState =
  | { kind: 'new'; columnId: string }
  | { kind: 'edit'; taskId: string }
  | null

export function KanbanPage() {
  const { columns, tasks, ready, addColumn, renameColumn, moveColumn, deleteColumn, patchTask } = useData()
  const [priority, setPriority] = useState<'all' | Priority>('all')
  const [due, setDue] = useState<DueFilter>('all')
  const [sortMode, setSortMode] = useState<'manual' | 'deadline' | 'priority' | 'created'>('manual')
  const [modal, setModal] = useState<ModalState>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [editingColumn, setEditingColumn] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns])

  const topTasks = useMemo(() => tasks.filter((task) => !task.parentId), [tasks])
  const doneColumnIds = useMemo(
    () => new Set(columns.filter((column) => column.isDone).map((column) => column.id)),
    [columns],
  )
  const filtered = useMemo(
    () =>
      topTasks.filter(
        (task) =>
          (priority === 'all' || task.priority === priority) &&
          matchesDue(task.deadline, due, doneColumnIds.has(task.columnId)),
      ),
    [topTasks, priority, due, doneColumnIds],
  )

  const visibleByColumn = useMemo(() => {
    const map = new Map<string, Task[]>()

    for (const column of sortedColumns) {
      map.set(
        column.id,
        filtered
          .filter((task) => task.columnId === column.id)
          .sort((a, b) => sortTasks(a, b, sortMode)),
      )
    }

    return map
  }, [filtered, sortedColumns, sortMode])

  const hasFilters = priority !== 'all' || due !== 'all'

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId === overId) {
      return
    }

    const task = tasks.find((item) => item.id === activeId)

    if (!task) {
      return
    }

    if (overId.startsWith('column-')) {
      const targetId = overId.slice('column-'.length)

      if (task.columnId === targetId) {
        return
      }

      const siblings = topTasks.filter((item) => item.columnId === targetId)
      const order = siblings.reduce((max, item) => Math.max(max, item.order), -1) + 1

      await patchTask(activeId, { columnId: targetId, order })
      return
    }

    const overTask = tasks.find((item) => item.id === overId)

    if (!overTask || overTask.parentId) {
      return
    }

    const translated = active.rect.current.translated
    const below = translated
      ? translated.top > over.rect.top + over.rect.height / 2
      : false
    const order = below ? overTask.order + 0.5 : overTask.order - 0.5

    await patchTask(activeId, { columnId: overTask.columnId, order })
  }

  async function handleAddColumn() {
    await addColumn(newColumnTitle)
    setNewColumnTitle('')
    setAddingColumn(false)
  }

  if (!ready) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Канбан</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Перетаскивайте карточки между колонками, чтобы менять статус.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModal({ kind: 'new', columnId: sortedColumns[0]?.id ?? '' })}
          disabled={sortedColumns.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          Новая задача
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as 'all' | Priority)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="all">Все приоритеты</option>
          {PRIORITIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={due}
          onChange={(event) => setDue(event.target.value as DueFilter)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="all">Все дедлайны</option>
          <option value="overdue">Просроченные</option>
          <option value="today">На сегодня</option>
          <option value="week">На неделю</option>
          <option value="none">Без дедлайна</option>
        </select>

        <select
          value={sortMode}
          onChange={(event) =>
            setSortMode(event.target.value as 'manual' | 'deadline' | 'priority' | 'created')
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="manual">Ручной порядок</option>
          <option value="deadline">По дедлайну</option>
          <option value="priority">По приоритету</option>
          <option value="created">Сначала новые</option>
        </select>

        {hasFilters && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Показано {filtered.length} из {topTasks.length}
          </span>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          {sortedColumns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={visibleByColumn.get(column.id) ?? []}
              allTasks={tasks}
              draggable={sortMode === 'manual' && !hasFilters}
              editing={editingColumn === column.id}
              canMoveLeft={sortedColumns[0]?.id !== column.id}
              canMoveRight={sortedColumns[sortedColumns.length - 1]?.id !== column.id}
              onStartEdit={() => setEditingColumn(column.id)}
              onFinishEdit={(title) => {
                setEditingColumn(null)
                void renameColumn(column.id, title)
              }}
              onMove={(direction) => void moveColumn(column.id, direction)}
              onDelete={() => {
                if (window.confirm(`Удалить колонку «${column.title}»? Задачи перейдут в другую колонку.`)) {
                  void deleteColumn(column.id)
                }
              }}
              onAddTask={() => setModal({ kind: 'new', columnId: column.id })}
              onOpenTask={(taskId) => setModal({ kind: 'edit', taskId })}
            />
          ))}

          <div className="w-[260px] shrink-0">
            {addingColumn ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleAddColumn()
                }}
                className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
              >
                <input
                  autoFocus
                  value={newColumnTitle}
                  onChange={(event) => setNewColumnTitle(event.target.value)}
                  placeholder="Название колонки"
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setAddingColumn(false)
                      setNewColumnTitle('')
                    }
                  }}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                  >
                    Добавить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingColumn(false)
                      setNewColumnTitle('')
                    }}
                    className="rounded-lg px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                className="w-full rounded-2xl border border-dashed border-slate-300 px-3 py-3 text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
              >
                Добавить колонку
              </button>
            )}
          </div>
        </div>
      </DndContext>

      {modal?.kind === 'new' && (
        <TaskModal
          defaultColumnId={modal.columnId}
          defaultOrder={
            tasks.filter((task) => task.columnId === modal.columnId && !task.parentId).reduce(
              (max, task) => Math.max(max, task.order),
              -1,
            ) + 1
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'edit' && (
        <TaskModal taskId={modal.taskId} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

interface BoardColumnProps {
  column: Column
  tasks: Task[]
  allTasks: Task[]
  draggable: boolean
  editing: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onStartEdit: () => void
  onFinishEdit: (title: string) => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onAddTask: () => void
  onOpenTask: (taskId: string) => void
}

function BoardColumn({
  column,
  tasks,
  allTasks,
  draggable,
  editing,
  canMoveLeft,
  canMoveRight,
  onStartEdit,
  onFinishEdit,
  onMove,
  onDelete,
  onAddTask,
  onOpenTask,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}` })
  const [draft, setDraft] = useState(column.title)

  return (
    <section
      ref={setNodeRef}
      className={[
        'flex w-[280px] shrink-0 flex-col rounded-2xl border bg-slate-100/80 p-2 transition sm:w-[300px] dark:bg-slate-900/70',
        isOver
          ? 'border-indigo-400 ring-2 ring-indigo-400/30 dark:border-indigo-500'
          : 'border-slate-200 dark:border-slate-800',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 px-1 pb-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => onFinishEdit(draft)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onFinishEdit(draft)
              }
              if (event.key === 'Escape') {
                setDraft(column.title)
                onFinishEdit(column.title)
              }
            }}
            className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-0.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(column.title)
              onStartEdit()
            }}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
            title="Переименовать колонку"
          >
            {column.title}
          </button>
        )}

        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {tasks.length}
        </span>

        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={!canMoveLeft}
          className="rounded px-1 text-slate-400 transition hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
          title="Влево"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={!canMoveRight}
          className="rounded px-1 text-slate-400 transition hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
          title="Вправо"
        >
          ›
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded px-1 text-slate-400 transition hover:text-rose-600 dark:hover:text-rose-400"
          title="Удалить колонку"
        >
          ×
        </button>
      </div>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[80px] flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              allTasks={allTasks}
              draggable={draggable}
              onClick={() => onOpenTask(task.id)}
            />
          ))}

          {tasks.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 px-2 py-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
              Пусто
            </p>
          )}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={onAddTask}
        className="mt-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        + Задача
      </button>
    </section>
  )
}

interface TaskCardProps {
  task: Task
  allTasks: Task[]
  draggable: boolean
  onClick: () => void
}

function TaskCard({ task, allTasks, draggable, onClick }: TaskCardProps) {
  const { columns, timeEntries } = useData()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !draggable })
  const progress = progressOf(task, allTasks, columns)
  const subtasks = allTasks.filter((item) => item.parentId === task.id)
  const doneColumn = columns.find((column) => column.id === task.columnId)?.isDone ?? false
  const overdue = isOverdue(task, doneColumn)
  const spent = branchMinutes(task, allTasks, timeEntries)
  const barClass = progressBarClasses[progressTone(progress.percent)]

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Перетащить задачу"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(task.color ? { borderTopWidth: 4, borderTopColor: task.color } : {}),
      }}
      className={[
        'group flex items-start gap-1 rounded-xl border bg-white p-2 shadow-sm transition dark:bg-slate-900',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        isDragging ? 'opacity-60 shadow-lg' : 'hover:shadow-md',
        doneColumn ? 'border-emerald-200 dark:border-emerald-800/60' : 'border-slate-200 dark:border-slate-800',
      ].join(' ')}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        disabled={!draggable}
        className="mt-1 cursor-grab rounded px-0.5 text-slate-300 opacity-60 transition hover:text-slate-500 group-hover:opacity-100 disabled:cursor-default disabled:opacity-20 dark:text-slate-600 dark:hover:text-slate-300"
        title={draggable ? 'Перетащить' : 'Перетаскивание недоступно при фильтрах и сортировке'}
        aria-label="Перетащить задачу"
      >
        ⋮⋮
      </button>

      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-2">
          <span
            className={[
              'line-clamp-2 text-sm font-medium',
              doneColumn || task.completed
                ? 'text-slate-400 line-through dark:text-slate-500'
                : 'text-slate-800 dark:text-slate-100',
            ].join(' ')}
          >
            {task.title}
          </span>

          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${priorityStyles[task.priority]}`}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>

        {task.description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {plainDescription(task.description)}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {task.deadline && (
            <span
              className={[
                'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                overdue
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              ].join(' ')}
            >
              {deadlineLabel(task.deadline)}
              {overdue ? ' · просрочено' : ''}
            </span>
          )}

          {subtasks.length > 0 && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {progress.done}/{progress.total}
            </span>
          )}

          {spent > 0 && (
            <span
              className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
              title="Суммарные трудозатраты по задаче и подзадачам"
            >
              {minutesLabel(spent)}
            </span>
          )}
        </div>

        {subtasks.length > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}
      </button>
    </div>
  )
}
