import { useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import type {
  DateSelectInfo,
  EventClickInfo,
  EventDropInfo,
  EventInput,
  EventResizeDoneInfo,
} from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import classicThemePlugin from '@fullcalendar/react/themes/classic'
import ruLocale from '@fullcalendar/react/locales/ru'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import { addDays } from 'date-fns'
import { useData } from '../lib/data'
import { TaskModal } from '../components/TaskModal'
import { atMidnight, isAllDay, priorityEventColors } from '../lib/utils'

type ModalState =
  | { kind: 'new'; startAt: string | null; deadline: string | null }
  | { kind: 'edit'; taskId: string }
  | null

export function CalendarPage() {
  const { columns, tasks, ready, patchTask } = useData()
  const [modal, setModal] = useState<ModalState>(null)

  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns])
  const doneColumnIds = useMemo(
    () => new Set(columns.filter((column) => column.isDone).map((column) => column.id)),
    [columns],
  )

  const events = useMemo<EventInput[]>(
    () =>
      tasks
        .filter((task) => task.deadline)
        .map((task) => {
          const deadline = task.deadline as string
          const start = task.startAt ?? deadline
          const allDay = isAllDay(start) && isAllDay(deadline)
          const hasRange = Boolean(task.startAt) && deadline !== start
          const done = task.completed || doneColumnIds.has(task.columnId)
          const color = done ? '#94a3b8' : priorityEventColors[task.priority]

          return {
            id: task.id,
            title: task.parentId ? `· ${task.title}` : task.title,
            start,
            end: hasRange ? deadline : undefined,
            allDay,
            backgroundColor: color,
            borderColor: color,
            textColor: '#ffffff',
          }
        }),
    [tasks, doneColumnIds],
  )

  function handleSelect(info: DateSelectInfo) {
    if (info.allDay) {
      const startAt = atMidnight(info.start)
      const deadline = atMidnight(addDays(info.end, -1))

      setModal({
        kind: 'new',
        startAt,
        deadline: deadline >= startAt ? deadline : startAt,
      })
    } else {
      setModal({ kind: 'new', startAt: info.start.toISOString(), deadline: info.end.toISOString() })
    }

    info.view.calendar.unselect()
  }

  function handleEventClick(info: EventClickInfo) {
    info.jsEvent.preventDefault()

    if (info.event.id) {
      setModal({ kind: 'edit', taskId: info.event.id })
    }
  }

  async function handleEventDrop(info: EventDropInfo) {
    const start = info.event.start
    const task = tasks.find((item) => item.id === info.event.id)

    if (!start || !task) {
      info.revert()
      return
    }

    const end = info.event.end
    let startAt: string | null = null
    let deadline: string

    if (info.event.allDay) {
      const startIso = atMidnight(start)
      const endIso = end ? atMidnight(addDays(end, -1)) : startIso

      startAt = task.startAt ? startIso : null
      deadline = endIso >= startIso ? endIso : startIso
    } else if (end) {
      startAt = start.toISOString()
      deadline = end.toISOString()
    } else {
      startAt = task.startAt ?? null
      deadline = start.toISOString()
    }

    try {
      await patchTask(info.event.id, { startAt, deadline })
    } catch {
      info.revert()
    }
  }

  async function handleEventResize(info: EventResizeDoneInfo) {
    const start = info.event.start
    const end = info.event.end

    if (!start || !end) {
      info.revert()
      return
    }

    let startAt: string
    let deadline: string

    if (info.event.allDay) {
      const startIso = atMidnight(start)
      const endIso = atMidnight(addDays(end, -1))

      startAt = startIso
      deadline = endIso >= startIso ? endIso : startIso
    } else {
      startAt = start.toISOString()
      deadline = end.toISOString()
    }

    try {
      await patchTask(info.event.id, { startAt, deadline })
    } catch {
      info.revert()
    }
  }

  if (!ready) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Календарь</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Выделите диапазон дат, чтобы создать задачу, тяните событие или его край, чтобы изменить сроки.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setModal({ kind: 'new', startAt: null, deadline: new Date().toISOString() })
          }
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Новая задача
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, classicThemePlugin]}
          initialView="dayGridMonth"
          locales={[ruLocale]}
          locale="ru"
          firstDay={1}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          editable
          eventDurationEditable
          eventStartEditable
          selectable
          selectMirror
          dayMaxEvents={3}
          nowIndicator
          height="auto"
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
        />
      </div>

      {modal?.kind === 'new' && (
        <TaskModal
          defaultColumnId={sortedColumns[0]?.id ?? ''}
          defaultStartAt={modal.startAt}
          defaultDeadline={modal.deadline}
          defaultOrder={
            tasks
              .filter((task) => task.columnId === sortedColumns[0]?.id && !task.parentId)
              .reduce((max, task) => Math.max(max, task.order), -1) + 1
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === 'edit' && <TaskModal taskId={modal.taskId} onClose={() => setModal(null)} />}
    </div>
  )
}
