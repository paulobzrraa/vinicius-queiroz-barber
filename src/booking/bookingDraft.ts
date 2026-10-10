import { readSession, removeSession, writeSession } from '@/utils/sessionCache'
import type { BookingState, BookingStep } from './types'

const KEY = 'vinicius-queiroz-barber:booking-draft'
const TTL_MS = 2 * 60 * 60 * 1000

export interface BookingDraft {
  step: BookingStep
  state: BookingState
}

/**
 * Rascunho do agendamento em andamento: recarregar (F5) ou voltar para a
 * página não joga o cliente de volta ao primeiro passo. O horário guardado
 * pode ficar velho — a revalidação do banco na hora de confirmar (BL-073)
 * continua valendo e devolve o cliente à escolha de horário se ele sumir.
 */
export function loadBookingDraft(): BookingDraft | null {
  return readSession<BookingDraft>(KEY, TTL_MS)
}

export function saveBookingDraft(draft: BookingDraft): void {
  // O campo isca (BL-104) e a senha nunca são guardados.
  writeSession(KEY, { ...draft, state: { ...draft.state, honeypot: '', clientPassword: '' } })
}

export function clearBookingDraft(): void {
  removeSession(KEY)
}
