/**
 * Datas da Agenda do admin usam o horário local do navegador de quem está
 * logado (não o fuso fixo de src/utils/timezone.ts, que existe para o fluxo
 * público bater com o horário da barbearia independente de onde o cliente
 * está). Presume-se que o admin opera no mesmo fuso da barbearia.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function keyFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey(): string {
  return keyFromDate(new Date())
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return keyFromDate(date)
}

export function addMonths(dateKey: string, months: number): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setMonth(date.getMonth() + months)
  return keyFromDate(date)
}

export function startOfMonth(dateKey: string): string {
  const [year, month] = dateKey.split('-')
  return `${year}-${month}-01`
}

export function daysInMonth(monthKey: string): string[] {
  const [year, month] = monthKey.split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  return Array.from({ length: last }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`)
}

export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00`).getDay()
}

/** Chave local (YYYY-MM-DD) de um timestamp ISO — mesmo formato de `todayKey`/`dateKey`. */
export function dateKeyOf(iso: string): string {
  return keyFromDate(new Date(iso))
}

/** Domingo (weekday 0) da semana que contém essa data — mesma convenção do `getDay()`. */
export function startOfWeek(dateKey: string): string {
  return addDays(dateKey, -weekdayOf(dateKey))
}

/** Os 7 dias (domingo a sábado) da semana que contém essa data. */
export function daysInWeek(dateKey: string): string[] {
  const start = startOfWeek(dateKey)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** [início do dia, início do dia seguinte) em ISO, para consultar appointments com gte/lt. */
export function dayRangeIso(dateKey: string): { startIso: string; endIso: string } {
  const start = new Date(`${dateKey}T00:00:00`)
  const end = addDays(dateKey, 1)
  return { startIso: start.toISOString(), endIso: new Date(`${end}T00:00:00`).toISOString() }
}

/** [início da semana, início da semana seguinte) em ISO. */
export function weekRangeIso(dateKey: string): { startIso: string; endIso: string } {
  const start = startOfWeek(dateKey)
  const end = addDays(start, 7)
  return {
    startIso: new Date(`${start}T00:00:00`).toISOString(),
    endIso: new Date(`${end}T00:00:00`).toISOString(),
  }
}

/** [início do mês, início do mês seguinte) em ISO. */
export function monthRangeIso(monthKey: string): { startIso: string; endIso: string } {
  const start = startOfMonth(monthKey)
  const end = addMonths(start, 1)
  return {
    startIso: new Date(`${start}T00:00:00`).toISOString(),
    endIso: new Date(`${end}T00:00:00`).toISOString(),
  }
}

export function formatDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(`${dateKey}T00:00:00`))
}

export function formatMonthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(`${monthKey}T00:00:00`),
  )
}

/** "5 – 11 de outubro de 2026" (ou cruzando meses/anos, o Intl resolve sozinho). */
export function formatWeekLabel(dateKey: string): string {
  const start = startOfWeek(dateKey)
  const end = addDays(start, 6)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).formatRange(new Date(`${start}T00:00:00`), new Date(`${end}T00:00:00`))
}

/** "Dom" + "5", para o cabeçalho de cada coluna da semana. */
export function formatWeekdayShort(dateKey: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(new Date(`${dateKey}T00:00:00`))
    .replace('.', '')
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

/** Valor para <input type="datetime-local">, no horário local do navegador. */
export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
