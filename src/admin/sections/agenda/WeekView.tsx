import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button, IconButton, Text } from '@/components/ui'
import { useOpeningHours } from '@/queries/contact'
import { type AppointmentWithDetails, useAppointmentsInRange } from '@/queries/adminAppointments'
import { businessHoursRangeMinutes, hoursForWeekday } from '@/utils/openingHours'
import { cn } from '@/utils/cn'

import {
  addDays,
  dateKeyOf,
  daysInWeek,
  formatWeekdayShort,
  formatWeekLabel,
  todayKey,
  weekdayOf,
  weekRangeIso,
} from './dateUtils'

interface WeekViewProps {
  weekKey: string
  onWeekChange: (weekKey: string) => void
  onSelectDay: (dateKey: string) => void
}

const SLOT_MINUTES = 15
const ROW_PX = 12 // 1h = 4 slots = 48px
const MIN_BLOCK_PX = 22

function minutesOfDay(iso: string): number {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes()
}

interface PositionedAppointment {
  appointment: AppointmentWithDetails
  top: number
  height: number
  colIndex: number
  totalCols: number
}

/**
 * Posiciona os agendamentos de um dia no eixo vertical (minuto -> px) e, para
 * os que se sobrepõem no tempo (profissionais diferentes no mesmo horário),
 * divide a coluna em sub-colunas (cores de intervalo, como qualquer agenda).
 * Simplificação: a largura é dividida pelo máximo de sobreposições do dia
 * inteiro, não por grupo — mais simples, nunca sobrepõe, só às vezes deixa um
 * cartão mais estreito do que precisaria.
 */
function layoutDay(
  appointments: AppointmentWithDetails[],
  axisStart: number,
  axisEnd: number,
): PositionedAppointment[] {
  const sorted = [...appointments].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const columnsEnd: number[] = []

  const assigned = sorted.map((appointment) => {
    const startMinutes = minutesOfDay(appointment.starts_at)
    const endMinutes = Math.max(startMinutes + SLOT_MINUTES, minutesOfDay(appointment.ends_at))

    let colIndex = columnsEnd.findIndex((end) => end <= startMinutes)
    if (colIndex === -1) {
      colIndex = columnsEnd.length
      columnsEnd.push(endMinutes)
    } else {
      columnsEnd[colIndex] = endMinutes
    }

    return { appointment, startMinutes, endMinutes, colIndex }
  })

  const totalCols = Math.max(1, columnsEnd.length)

  return assigned.map(({ appointment, startMinutes, endMinutes, colIndex }) => {
    const clampedStart = Math.min(Math.max(startMinutes, axisStart), axisEnd)
    const clampedEnd = Math.min(Math.max(endMinutes, axisStart), axisEnd)
    const top = ((clampedStart - axisStart) / SLOT_MINUTES) * ROW_PX
    const height = Math.max(((clampedEnd - clampedStart) / SLOT_MINUTES) * ROW_PX, MIN_BLOCK_PX)
    return { appointment, top, height, colIndex, totalCols }
  })
}

/** Faixa [de, até] (em px, dentro da coluna do dia) fora do horário de funcionamento daquele dia. */
function closedRanges(
  axisStart: number,
  axisEnd: number,
  hours: ReturnType<typeof hoursForWeekday>,
) {
  if (!hours) {
    return [{ top: 0, height: ((axisEnd - axisStart) / SLOT_MINUTES) * ROW_PX }]
  }

  const ranges: { top: number; height: number }[] = []
  if (hours.opensAtMinutes > axisStart) {
    ranges.push({ top: 0, height: ((hours.opensAtMinutes - axisStart) / SLOT_MINUTES) * ROW_PX })
  }
  if (hours.closesAtMinutes < axisEnd) {
    ranges.push({
      top: ((hours.closesAtMinutes - axisStart) / SLOT_MINUTES) * ROW_PX,
      height: ((axisEnd - hours.closesAtMinutes) / SLOT_MINUTES) * ROW_PX,
    })
  }
  return ranges
}

/**
 * Agenda da semana, estilo Google Agenda: 7 colunas (domingo a sábado) por um
 * eixo de horário, com o nome do cliente em evidência em cada cartão (o
 * profissional vai pequeno, embaixo — mesma inversão da lista do dia, ver
 * AppointmentRow). Fora do horário de funcionamento, a coluna fica
 * sombreada. Rola na horizontal (eixo fixo) e na vertical (cabeçalho fixo)
 * dentro de uma altura limitada — é o que permite caber 7 dias numa tela de
 * celular sem estourar a largura.
 */
export function WeekView({ weekKey, onWeekChange, onSelectDay }: WeekViewProps) {
  const { startIso, endIso } = weekRangeIso(weekKey)
  const { data: appointments } = useAppointmentsInRange(startIso, endIso)
  const { data: openingHours } = useOpeningHours()

  const scrollRef = useRef<HTMLDivElement>(null)
  const days = daysInWeek(weekKey)
  const today = todayKey()

  const { opensAtMinutes: axisStart, closesAtMinutes: axisEnd } = businessHoursRangeMinutes(
    openingHours ?? [],
  )
  const totalSlots = Math.max(1, Math.ceil((axisEnd - axisStart) / SLOT_MINUTES))
  const columnHeight = totalSlots * ROW_PX

  const hourMarks: { minutes: number; label: string }[] = []
  for (let m = Math.ceil(axisStart / 60) * 60; m <= axisEnd; m += 60) {
    hourMarks.push({ minutes: m, label: `${String(Math.floor(m / 60)).padStart(2, '0')}:00` })
  }

  const appointmentsByDay = new Map<string, AppointmentWithDetails[]>()
  for (const appointment of appointments ?? []) {
    const key = dateKeyOf(appointment.starts_at)
    appointmentsByDay.set(key, [...(appointmentsByDay.get(key) ?? []), appointment])
  }

  // Ao abrir (ou trocar de semana), já deixa a hora atual visível em vez de
  // precisar rolar manualmente até ela — mesmo gesto do Google Agenda.
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const isCurrentWeek = days.includes(today)
    const nowMinutes = isCurrentWeek ? minutesOfDay(new Date().toISOString()) : axisStart
    const top = Math.max(0, ((nowMinutes - axisStart) / SLOT_MINUTES) * ROW_PX - ROW_PX * 8)
    container.scrollTop = top
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconButton
            aria-label="Semana anterior"
            onClick={() => onWeekChange(addDays(weekKey, -7))}
          >
            <ChevronLeft />
          </IconButton>
          <Text size="body" className="font-semibold capitalize">
            {formatWeekLabel(weekKey)}
          </Text>
          <IconButton aria-label="Próxima semana" onClick={() => onWeekChange(addDays(weekKey, 7))}>
            <ChevronRight />
          </IconButton>
        </div>

        {!days.includes(today) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onWeekChange(today)}>
            Hoje
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="max-h-[32rem] overflow-auto rounded-card border border-border"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: '3.25rem repeat(7, minmax(7rem, 1fr))' }}
        >
          <div className="sticky top-0 left-0 z-20 col-start-1 row-start-1 bg-background" />

          {days.map((dateKey, i) => (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDay(dateKey)}
              style={{ gridColumn: i + 2, gridRow: 1 }}
              className="sticky top-0 z-10 border-b border-border bg-background py-2 text-center transition-control hover:bg-foreground/5"
            >
              <Text as="span" size="caption" tone="muted" className="block uppercase">
                {formatWeekdayShort(dateKey)}
              </Text>
              <span
                className={cn(
                  'mx-auto mt-1 flex size-7 items-center justify-center rounded-full text-small',
                  dateKey === today && 'bg-foreground font-semibold text-background',
                )}
              >
                {Number(dateKey.slice(-2))}
              </span>
            </button>
          ))}

          <div
            className="sticky left-0 z-10 col-start-1 row-start-2 bg-background"
            style={{ height: columnHeight }}
          >
            {hourMarks.map((mark) => (
              <Text
                key={mark.minutes}
                as="span"
                size="caption"
                tone="muted"
                className="absolute end-1.5 -translate-y-1/2"
                style={{ top: ((mark.minutes - axisStart) / SLOT_MINUTES) * ROW_PX }}
              >
                {mark.label}
              </Text>
            ))}
          </div>

          {days.map((dateKey, i) => {
            const dayHours = hoursForWeekday(openingHours ?? [], weekdayOf(dateKey))
            const positioned = layoutDay(appointmentsByDay.get(dateKey) ?? [], axisStart, axisEnd)

            return (
              <div
                key={dateKey}
                style={{
                  gridColumn: i + 2,
                  gridRow: 2,
                  height: columnHeight,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent ${ROW_PX * 4}px)`,
                }}
                className="relative border-l border-border"
              >
                {closedRanges(axisStart, axisEnd, dayHours).map((range, index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    className="absolute inset-x-0 bg-surface-raised/60"
                    style={{ top: range.top, height: range.height }}
                  />
                ))}

                {positioned.map(({ appointment, top, height, colIndex, totalCols }) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => onSelectDay(dateKey)}
                    aria-label={`${appointment.client_name}, ${appointment.professionalName}`}
                    className="absolute flex flex-col overflow-hidden rounded-sm bg-surface-raised px-1.5 py-1 text-start leading-tight transition-control hover:bg-foreground/10"
                    style={{
                      top,
                      height,
                      left: `calc(${(100 / totalCols) * colIndex}% + 1px)`,
                      width: `calc(${100 / totalCols}% - 2px)`,
                    }}
                  >
                    <span className="truncate text-caption font-semibold text-foreground">
                      {appointment.client_name}
                    </span>
                    <span className="truncate text-caption text-muted">
                      {appointment.professionalName}
                    </span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
