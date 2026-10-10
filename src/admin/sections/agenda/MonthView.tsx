import { ChevronLeft, ChevronRight } from 'lucide-react'

import { IconButton, Text } from '@/components/ui'
import { useAppointmentsInRange } from '@/queries/adminAppointments'
import { cn } from '@/utils/cn'

import { addMonths, daysInMonth, formatMonthLabel, monthRangeIso, weekdayOf } from './dateUtils'

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface MonthViewProps {
  monthKey: string
  onMonthChange: (monthKey: string) => void
  onSelectDay: (dateKey: string) => void
}

/** BL-082: todos os profissionais num calendário navegável por mês, com a contagem de agendamentos do dia. */
export function MonthView({ monthKey, onMonthChange, onSelectDay }: MonthViewProps) {
  const { startIso, endIso } = monthRangeIso(monthKey)
  const { data: appointments } = useAppointmentsInRange(startIso, endIso)

  const countByDay = new Map<string, number>()
  for (const appointment of appointments ?? []) {
    const dateKey = appointment.starts_at.slice(0, 10)
    countByDay.set(dateKey, (countByDay.get(dateKey) ?? 0) + 1)
  }

  const days = daysInMonth(monthKey)
  const leadingBlanks = weekdayOf(days[0])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <IconButton
          aria-label="Mês anterior"
          onClick={() => onMonthChange(addMonths(monthKey, -1))}
        >
          <ChevronLeft />
        </IconButton>
        <Text size="body" className="font-semibold capitalize">
          {formatMonthLabel(monthKey)}
        </Text>
        <IconButton aria-label="Próximo mês" onClick={() => onMonthChange(addMonths(monthKey, 1))}>
          <ChevronRight />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={index} as="span" size="caption" tone="muted">
            {label}
          </Text>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}

        {days.map((day) => {
          const count = countByDay.get(day) ?? 0
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-card text-small transition-control hover:bg-foreground/8',
                count > 0 && 'font-semibold text-foreground',
              )}
            >
              {day.slice(-2)}
              {count > 0 && <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />}
              <span className="sr-only">
                {count > 0 ? `${count} agendamento(s)` : 'Nenhum agendamento'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
