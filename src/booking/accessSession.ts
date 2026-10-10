import type { AccessAppointment } from '@/queries/appointmentAccess'
import { readSession, removeSession, writeSession } from '@/utils/sessionCache'

const KEY = 'vinicius-queiroz-barber:my-appointments'
const TTL_MS = 30 * 60 * 1000

interface AccessSession {
  email: string
  appointments: AccessAppointment[]
}

/**
 * Lista de "Meus agendamentos" já liberada pelo código de e-mail, guardada só
 * nesta aba por 30 minutos: ir ao detalhe de um agendamento e voltar não
 * exige pedir outro código. Ela guarda os links únicos dos agendamentos, por
 * isso é curta, não vai para o localStorage e é apagada em "Sair".
 */
export function loadAccessSession(): AccessSession | null {
  return readSession<AccessSession>(KEY, TTL_MS)
}

export function saveAccessSession(session: AccessSession): void {
  writeSession(KEY, session)
}

export function clearAccessSession(): void {
  removeSession(KEY)
}

/** Reflete no cache o que o cliente mudou no detalhe (cancelou ou reagendou). */
export function updateCachedAppointment(
  token: string,
  change: { canceled: true } | { startsAt: string },
): void {
  const session = loadAccessSession()
  if (!session) return

  const appointments = session.appointments
    .flatMap((appointment) => {
      if (appointment.access_token !== token) return [appointment]
      if ('canceled' in change) return []
      return [{ ...appointment, starts_at: change.startsAt }]
    })
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))

  saveAccessSession({ ...session, appointments })
}
