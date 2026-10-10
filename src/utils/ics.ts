interface IcsEvent {
  title: string
  description?: string
  location?: string
  /** ISO 8601 (timestamptz do banco). */
  startsAt: string
  endsAt: string
}

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeIcsText(text: string): string {
  return text.replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')
}

/** Monta um .ics de um evento só, para "adicionar ao calendário" (BL-072). */
export function buildIcsFile(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vinicius Queiroz Barber//Agendamento//PT-BR',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(event.startsAt)}`,
    `DTEND:${toIcsDate(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]

  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

/** Baixa o .ics no navegador do cliente, sem precisar de um endpoint no servidor. */
export function downloadIcsFile(fileName: string, event: IcsEvent) {
  const blob = new Blob([buildIcsFile(event)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()

  URL.revokeObjectURL(url)
}
