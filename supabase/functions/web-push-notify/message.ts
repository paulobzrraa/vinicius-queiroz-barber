// Texto das notificações push para o admin. Mantém só o necessário para o aviso
// fazer sentido: nome do cliente, serviço, data e horário. Sem telefone, sem
// valor e sem id interno. Esse conteúdo aparece na tela bloqueada do aparelho.

const APP_TIMEZONE = 'America/Fortaleza' // mesmo valor de app_timezone() no schema.sql

export type PushKind = 'created' | 'canceled' | 'updated'

export interface PushAppointment {
  clientName: string
  startsAt: string // timestamptz em ISO, como vem do Postgres
  status: string
  serviceNames: string[]
}

export interface PushMessage {
  title: string
  body: string
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

const TITLES: Record<PushKind, string> = {
  created: 'Novo agendamento',
  canceled: 'Agendamento cancelado',
  updated: 'Agendamento atualizado',
}

export function formatPushMessage(kind: PushKind, appointment: PushAppointment): PushMessage {
  const startsAt = new Date(appointment.startsAt)
  // Primeira linha: cliente e horário (o que importa na tela bloqueada).
  // Segunda linha: serviço, quando houver.
  const headline = `${appointment.clientName} · ${dateFormat.format(startsAt)} às ${timeFormat.format(startsAt)}`
  const services = appointment.serviceNames.join(', ')
  const lines = [headline]
  if (kind !== 'canceled' && services) lines.push(`Serviço: ${services}`)

  return { title: TITLES[kind], body: lines.join('\n') }
}
