import { useState } from 'react'

import { PushNotificationsToggle } from '@/admin/components/PushNotificationsToggle'
import { useAppointmentsRealtime } from '@/queries/adminAppointments'
import { cn } from '@/utils/cn'

import { DayView } from './DayView'
import { startOfMonth, startOfWeek, todayKey } from './dateUtils'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'

type ViewMode = 'day' | 'week' | 'month'

const viewLabels: Record<ViewMode, string> = { day: 'Dia', week: 'Semana', month: 'Mês' }

/** BL-081/082: visão de agenda do admin, por dia, semana ou mês. */
export function AgendaEditor() {
  useAppointmentsRealtime()

  const [view, setView] = useState<ViewMode>('day')
  const [dateKey, setDateKey] = useState(todayKey())
  const [weekKey, setWeekKey] = useState(startOfWeek(todayKey()))
  const [monthKey, setMonthKey] = useState(startOfMonth(todayKey()))

  function goToDay(day: string) {
    setDateKey(day)
    setView('day')
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PushNotificationsToggle />

      <div className="flex gap-2">
        {(['day', 'week', 'month'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            className={cn(
              'rounded-control px-3 py-1.5 text-small transition-control',
              view === mode
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted hover:text-foreground',
            )}
          >
            {viewLabels[mode]}
          </button>
        ))}
      </div>

      {view === 'day' && <DayView dateKey={dateKey} onDateChange={setDateKey} />}
      {view === 'week' && (
        <WeekView weekKey={weekKey} onWeekChange={setWeekKey} onSelectDay={goToDay} />
      )}
      {view === 'month' && (
        <MonthView monthKey={monthKey} onMonthChange={setMonthKey} onSelectDay={goToDay} />
      )}
    </div>
  )
}
