import { useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import type { DateClickInfo, EventClickInfo, EventDropInfo, EventInput } from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import classicThemePlugin from '@fullcalendar/react/themes/classic'
import ruLocale from '@fullcalendar/react/locales/ru'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import { useData } from '../lib/data'
import { TaskModal } from '../components/TaskModal'
import { atMidnight, isAllDay, priorityEventColors } from '../lib/utils'

type ModalState = { kind: 'new'; deadline: string } | { kind: 'edit'; taskId: string } | null

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
          const done = task.completed || doneColumnIds.has(task.columnId)
          const color = done ? '#94a3b8' : priorityEventColors[task.priority]

          return {
            id: task.id,
            title: task.parentId ? `· ${task.title}` : task.title,
            start: task.deadline as string,
            allDay: isAllDay(task.deadline as string),
            backgroundColor: color,
            borderColor: color,
            textColor: '#ffffff',
          }
        }),
    [tasks, doneColumnIds],
  )

  function handleDateClick(info: DateClickInfo) {
    const deadline = info.allDay ? atMidnight(info.date) : info.date.toISOString()
    setModal({ kind: 'new', deadline })
  }

  function handleEventClick(info: EventClickInfo) {
    info.jsEvent.preventDefault()

    if (info.event.id) {
      setModal({ kind: 'edit', taskId: info.event.id })
    }
  }

  async function handleEventDrop(info: EventDropInfo) {
    const start = info.event.start

    if (!start) {
      info.revert()
      return
    }

    const deadline = info.event.allDay ? atMidnight(start) : start.toISOString()

    try {
      await patchTask(info.event.id, { deadline })
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
            Нажмите на день, чтобы создать задачу, или перетащите событие, чтобы изменить дедлайн.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModal({ kind: 'new', deadline: new Date().toISOString() })}
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
          events={events}          editable
          eventDurationEditable={false}
          eventStartEditable
          dayMaxEvents={3}
          nowIndicator
          height="auto"
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
        />
      </div>

      {modal?.kind === 'new' && (
        <TaskModal
          defaultColumnId={sortedColumns[0]?.id ?? ''}
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
