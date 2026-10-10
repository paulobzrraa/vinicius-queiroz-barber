import {
  addDays,
  addMonths,
  dayRangeIso,
  formatDateLabel,
  formatMonthLabel,
  formatWeekLabel,
  monthRangeIso,
  startOfMonth,
  startOfWeek,
  todayKey,
  weekRangeIso,
} from '../agenda/dateUtils'

/**
 * Período de navegação comum ao Resumo/Despesas/Comissões do módulo
 * financeiro — reaproveita as mesmas convenções de data da Agenda
 * (dateUtils), só que num tipo único em vez de três estados separados
 * (dateKey/weekKey/monthKey) como em AgendaEditor, já que aqui o período
 * muda junto da aba, não em telas independentes.
 */
export type PeriodMode = 'day' | 'week' | 'month'

export const periodModeLabels: Record<PeriodMode, string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
}

export function defaultPeriodKey(mode: PeriodMode): string {
  const today = todayKey()
  if (mode === 'day') return today
  if (mode === 'week') return startOfWeek(today)
  return startOfMonth(today)
}

export function shiftPeriodKey(mode: PeriodMode, key: string, direction: 1 | -1): string {
  if (mode === 'day') return addDays(key, direction)
  if (mode === 'week') return addDays(key, direction * 7)
  return addMonths(key, direction)
}

export function periodRangeIso(
  mode: PeriodMode,
  key: string,
): { startIso: string; endIso: string } {
  if (mode === 'day') return dayRangeIso(key)
  if (mode === 'week') return weekRangeIso(key)
  return monthRangeIso(key)
}

/**
 * Mesmo intervalo, em AAAA-MM-DD puro — para colunas `date` (expenses.expense_date),
 * que não são timestamptz e não devem ser comparadas com ISO com hora.
 */
export function periodRangeDateKeys(
  mode: PeriodMode,
  key: string,
): { startDate: string; endDate: string } {
  if (mode === 'day') return { startDate: key, endDate: addDays(key, 1) }
  if (mode === 'week') {
    const start = startOfWeek(key)
    return { startDate: start, endDate: addDays(start, 7) }
  }
  const start = startOfMonth(key)
  return { startDate: start, endDate: addMonths(start, 1) }
}

export function periodLabel(mode: PeriodMode, key: string): string {
  if (mode === 'day') return formatDateLabel(key)
  if (mode === 'week') return formatWeekLabel(key)
  return formatMonthLabel(key)
}

/** Dias (AAAA-MM-DD) cobertos pelo período — base do gráfico diário em semana/mês. */
export function daysInPeriod(mode: PeriodMode, key: string): string[] {
  const { startDate, endDate } = periodRangeDateKeys(mode, key)
  const days: string[] = []
  for (let day = startDate; day < endDate; day = addDays(day, 1)) days.push(day)
  return days
}
