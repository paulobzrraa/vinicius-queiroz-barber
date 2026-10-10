// Monta o texto da notificação. Texto simples de propósito (sem HTML/Markdown),
// então nome de cliente com <, & ou _ não quebra nada nem precisa de escape.

const APP_TIMEZONE = 'America/Fortaleza' // mesmo valor de app_timezone() no schema.sql

export interface NotificationAppointment {
  clientName: string
  clientPhone: string | null
  startsAt: string // timestamptz em ISO, como vem do Postgres
  professionalName: string | null
  services: { name: string; price: number | null }[]
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatPhone(digits: string): string {
  const match = digits.match(/^(\d{2})(\d{5})(\d{4})$/)
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : digits
}

export type NotificationKind = 'created' | 'canceled' | 'rescheduled'

const TITLES: Record<NotificationKind, string> = {
  created: '💈 NOVO AGENDAMENTO — VINICIUS QUEIROZ BARBER',
  canceled: '❌ AGENDAMENTO CANCELADO — VINICIUS QUEIROZ BARBER',
  rescheduled: '🔄 AGENDAMENTO ALTERADO — VINICIUS QUEIROZ BARBER',
}

const FOOTERS: Record<NotificationKind, string> = {
  created: '🔔 Um novo agendamento foi registrado pelo site.',
  canceled: '🔔 O cliente cancelou o agendamento pelo site. O horário ficou livre.',
  rescheduled: '🔔 O cliente alterou o horário do agendamento pelo site.',
}

export function formatNotificationMessage(
  kind: NotificationKind,
  appointment: NotificationAppointment,
  previousStartsAt?: string | null,
): string {
  const startsAt = new Date(appointment.startsAt)
  const serviceNames = appointment.services.map((service) => service.name)

  const lines = [TITLES[kind], '']
  lines.push(`👤 Cliente: ${appointment.clientName}`)
  if (serviceNames.length > 0) {
    lines.push(`✂️ ${serviceNames.length > 1 ? 'Serviços' : 'Serviço'}: ${serviceNames.join(', ')}`)
  }
  if (appointment.professionalName) lines.push(`🧔 Profissional: ${appointment.professionalName}`)

  if (kind === 'rescheduled' && previousStartsAt) {
    const previous = new Date(previousStartsAt)
    lines.push(`📅 Antes: ${dateFormat.format(previous)} às ${timeFormat.format(previous)}`)
    lines.push(`📅 Agora: ${dateFormat.format(startsAt)} às ${timeFormat.format(startsAt)}`)
  } else {
    lines.push(`📅 Data: ${dateFormat.format(startsAt)}`)
    lines.push(`🕒 Horário: ${timeFormat.format(startsAt)}`)
  }

  // Valor só quando todos os serviços têm preço gravado; soma parcial enganaria.
  const prices = appointment.services.map((service) => service.price)
  const hasTotal = prices.length > 0 && prices.every((price) => price !== null)
  const extra: string[] = []
  if (hasTotal) {
    extra.push(
      `💰 Valor: ${brl.format(prices.reduce<number>((sum, price) => sum + (price ?? 0), 0))}`,
    )
  }
  if (appointment.clientPhone) extra.push(`📱 Telefone: ${formatPhone(appointment.clientPhone)}`)
  if (extra.length > 0) lines.push('', ...extra)

  lines.push('', FOOTERS[kind])
  return lines.join('\n')
}

export function formatAppointmentMessage(appointment: NotificationAppointment): string {
  return formatNotificationMessage('created', appointment)
}
