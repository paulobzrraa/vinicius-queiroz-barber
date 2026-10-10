import type { Database } from '@/lib/database.types'

type OpeningHoursRow = Database['public']['Tables']['opening_hours']['Row']

export const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** "09:00:00" (formato `time` do Postgres) -> "09:00 às 19:00". */
export function formatHoursRange(opensAt: string, closesAt: string): string {
  return `${opensAt.slice(0, 5)} às ${closesAt.slice(0, 5)}`
}

export interface OpeningHoursLine {
  label: string
  hours: string
}

/**
 * BL-093: agrupa dias consecutivos com o mesmo horário (ex.: "Segunda a
 * Sábado", em vez de uma linha por dia) a partir das linhas estruturadas
 * (weekday/opens_at/closes_at). Dias fechados (sem linha, ou opens_at nulo)
 * somem da lista — mesma convenção do texto livre anterior.
 */
export function groupStructuredHours(rows: OpeningHoursRow[]): OpeningHoursLine[] {
  const byWeekday = new Map(
    rows.filter((row) => row.weekday !== null).map((row) => [row.weekday as number, row]),
  )
  const lines: OpeningHoursLine[] = []

  let runStart: number | null = null
  let runKey: string | null = null

  function flush(runEnd: number) {
    if (runStart === null || runKey === null) return
    const label =
      runStart === runEnd
        ? WEEKDAY_NAMES[runStart]
        : `${WEEKDAY_NAMES[runStart]} a ${WEEKDAY_NAMES[runEnd]}`
    const [opensAt, closesAt] = runKey.split('|')
    lines.push({ label, hours: formatHoursRange(opensAt, closesAt) })
  }

  for (let day = 0; day <= 6; day++) {
    const row = byWeekday.get(day)
    const key = row?.opens_at && row?.closes_at ? `${row.opens_at}|${row.closes_at}` : null

    if (key !== runKey) {
      flush(day - 1)
      runStart = key !== null ? day : null
      runKey = key
    }
  }
  flush(6)

  return lines
}

export interface DayHours {
  opensAtMinutes: number
  closesAtMinutes: number
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Horário (em minutos desde 00:00) daquele dia da semana — `null` se fechado ou sem linha cadastrada. */
export function hoursForWeekday(rows: OpeningHoursRow[], weekday: number): DayHours | null {
  const row = rows.find((r) => r.weekday === weekday)
  if (!row?.opens_at || !row?.closes_at) return null
  return { opensAtMinutes: toMinutes(row.opens_at), closesAtMinutes: toMinutes(row.closes_at) }
}

/**
 * Menor abertura e maior fechamento entre os dias com horário cadastrado —
 * usado só para limitar o eixo de horário da agenda semanal do admin (não é
 * dado exibido ao cliente). Sem nenhum horário cadastrado ainda, cai num
 * intervalo padrão (8h–20h) pra a grade não ficar vazia.
 */
export function businessHoursRangeMinutes(rows: OpeningHoursRow[]): DayHours {
  const openDays = Array.from({ length: 7 }, (_, weekday) => hoursForWeekday(rows, weekday)).filter(
    (hours): hours is DayHours => hours !== null,
  )

  if (openDays.length === 0) return { opensAtMinutes: 8 * 60, closesAtMinutes: 20 * 60 }

  return {
    opensAtMinutes: Math.min(...openDays.map((day) => day.opensAtMinutes)),
    closesAtMinutes: Math.max(...openDays.map((day) => day.closesAtMinutes)),
  }
}
