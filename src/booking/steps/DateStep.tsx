import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { IconButton, Text } from '@/components/ui'
import { useBookingSettings } from '@/queries/booking'
import { useAvailableDates } from '@/queries/availability'
import { cn } from '@/utils/cn'
import {
  addDays,
  addMonths,
  compareDateKeys,
  daysInMonth,
  formatDayLabel,
  formatMonthLabel,
  formatWeekdayShort,
  startOfMonth,
  todayKey,
  weekdayOf,
} from '@/utils/timezone'
import { NoAvailability } from '../components/NoAvailability'
import { StepShell } from '../components/StepShell'

interface DateStepProps {
  serviceIds: string[]
  professionalId: string | null
  date: string | null
  onChange: (date: string) => void
  onBack?: () => void
  /** BL-1xx: sem título/voltar próprios — usado pelo DateTimeStep, que já dá o contexto. */
  hideChrome?: boolean
}

const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  formatWeekdayShort(addDays('2024-01-07', i)),
)

/** BL-068 (calendário) e BL-108 (setas do teclado navegam entre os dias, como um date picker nativo). */
export function DateStep({
  serviceIds,
  professionalId,
  date,
  onChange,
  onBack,
  hideChrome = false,
}: DateStepProps) {
  const { data: settings } = useBookingSettings()
  const today = todayKey()
  const maxDate = addDays(today, settings?.max_advance_days ?? 60)

  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(date ?? today))
  const [focusedDay, setFocusedDay] = useState(date ?? today)
  const dayRefs = useRef(new Map<string, HTMLButtonElement>())

  const { data: availableDates, isLoading } = useAvailableDates({
    serviceIds,
    professionalId,
    startDate: today,
    endDate: maxDate,
  })

  const monthDays = daysInMonth(visibleMonth)
  const leadingBlanks = weekdayOf(monthDays[0])
  const canGoPrevious = compareDateKeys(startOfMonth(visibleMonth), startOfMonth(today)) > 0
  const canGoNext = compareDateKeys(startOfMonth(visibleMonth), startOfMonth(maxDate)) < 0

  const noAvailabilityAtAll = !isLoading && (availableDates?.length ?? 0) === 0

  function moveFocus(nextDay: string) {
    const clamped =
      compareDateKeys(nextDay, today) < 0
        ? today
        : compareDateKeys(nextDay, maxDate) > 0
          ? maxDate
          : nextDay

    setFocusedDay(clamped)
    const clampedMonth = startOfMonth(clamped)
    if (clampedMonth !== visibleMonth) setVisibleMonth(clampedMonth)
  }

  useEffect(() => {
    dayRefs.current.get(focusedDay)?.focus()
  }, [focusedDay, visibleMonth])

  // Trocar de mês pelo botão (não pela seta do teclado) muda o dia focado no mesmo
  // gesto que muda o mês, em vez de corrigir depois num efeito reagindo ao desvio.
  function goToMonth(nextMonth: string) {
    setVisibleMonth(nextMonth)
    setFocusedDay(daysInMonth(nextMonth)[0])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    const delta = deltas[event.key]
    if (delta === undefined) return

    event.preventDefault()
    moveFocus(addDays(focusedDay, delta))
  }

  const content = (
    <>
      <div aria-live="polite">
        {isLoading && (
          <Text size="small" tone="muted">
            Carregando dias disponíveis…
          </Text>
        )}
        {noAvailabilityAtAll && <NoAvailability />}
      </div>

      {!noAvailabilityAtAll && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <IconButton
              aria-label="Mês anterior"
              disabled={!canGoPrevious}
              onClick={() => goToMonth(addMonths(visibleMonth, -1))}
            >
              <ChevronLeft />
            </IconButton>
            <Text size="body" className="font-semibold capitalize">
              {formatMonthLabel(visibleMonth)}
            </Text>
            <IconButton
              aria-label="Próximo mês"
              disabled={!canGoNext}
              onClick={() => goToMonth(addMonths(visibleMonth, 1))}
            >
              <ChevronRight />
            </IconButton>
          </div>

          <div
            role="grid"
            aria-label="Dias disponíveis"
            onKeyDown={handleKeyDown}
            className="grid grid-cols-7 gap-1.5 text-center"
          >
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} as="span" size="caption" tone="muted" className="uppercase">
                {label}
              </Text>
            ))}

            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden="true" />
            ))}

            {monthDays.map((day) => {
              const isAvailable = availableDates?.includes(day) ?? false
              const isOutOfRange =
                compareDateKeys(day, today) < 0 || compareDateKeys(day, maxDate) > 0
              const isSelected = day === date
              const isDisabled = !isAvailable || isOutOfRange

              return (
                <button
                  key={day}
                  ref={(el) => {
                    if (el) dayRefs.current.set(day, el)
                    else dayRefs.current.delete(day)
                  }}
                  type="button"
                  role="gridcell"
                  tabIndex={day === focusedDay ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={formatDayLabel(day)}
                  // aria-disabled (não o atributo disabled): o dia continua focável para as
                  // setas do teclado passarem por ele, só não é clicável (BL-108).
                  aria-disabled={isDisabled}
                  onFocus={() => setFocusedDay(day)}
                  onClick={() => {
                    if (!isDisabled) onChange(day)
                  }}
                  className={cn(
                    'aspect-square rounded-control text-small transition-control',
                    isSelected && 'bg-accent font-semibold text-accent-foreground',
                    !isSelected && !isDisabled && 'hover:bg-foreground/8',
                    isDisabled && 'cursor-default text-muted opacity-40',
                  )}
                >
                  {day.slice(-2)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )

  if (hideChrome) return content

  return (
    <StepShell title="Escolha o dia" onBack={onBack}>
      {content}
    </StepShell>
  )
}
