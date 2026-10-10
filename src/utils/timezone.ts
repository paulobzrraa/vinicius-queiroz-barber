/**
 * Fuso único do agendamento (BL-063), para bater com o que o banco usa em
 * get_available_slots/get_available_dates (supabase/schema.sql). Datas de
 * calendário (YYYY-MM-DD) são tratadas como valores "sem fuso": as funções
 * abaixo ancoram a aritmética em UTC só para não sofrer o deslocamento do
 * fuso do navegador de quem está agendando. Instantes reais (starts_at/
 * ends_at, que já vêm como timestamptz do banco) usam TIMEZONE de verdade.
 */
export const TIMEZONE = 'America/Fortaleza'

/** Data de hoje em Fortaleza, como chave YYYY-MM-DD. */
export function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
}

function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

function dateFromKey(key: string): Date {
  const { year, month, day } = parseDateKey(key)
  return new Date(Date.UTC(year, month - 1, day))
}

function dateKeyFromUTC(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key)
  return dateKeyFromUTC(new Date(Date.UTC(year, month - 1, day + days)))
}

export function addMonths(key: string, months: number): string {
  const { year, month, day } = parseDateKey(key)
  return dateKeyFromUTC(new Date(Date.UTC(year, month - 1 + months, day)))
}

export function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 0 = domingo … 6 = sábado, igual ao extract(dow) do Postgres e ao Date.getDay(). */
export function weekdayOf(key: string): number {
  return dateFromKey(key).getUTCDay()
}

/** Todas as chaves do mês de `key` (dia 1 até o último dia). */
export function daysInMonth(key: string): string[] {
  const { year, month } = parseDateKey(key)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: last }, (_, i) =>
    dateKeyFromUTC(new Date(Date.UTC(year, month - 1, i + 1))),
  )
}

/** Primeiro dia do mês de `key`, como chave. */
export function startOfMonth(key: string): string {
  const { year, month } = parseDateKey(key)
  return dateKeyFromUTC(new Date(Date.UTC(year, month - 1, 1)))
}

export function formatWeekdayShort(key: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' }).format(
    dateFromKey(key),
  )
}

export function formatDayLabel(key: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'long',
  }).format(dateFromKey(key))
}

export function formatWeekdayLong(key: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' }).format(
    dateFromKey(key),
  )
}

export function formatMonthLabel(key: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(dateFromKey(key))
}

/** Horário local (Fortaleza) de um instante absoluto (timestamptz do banco). */
export function formatTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** Dia + horário local de um instante absoluto, para telas de confirmação/sucesso. */
export function formatDateTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
