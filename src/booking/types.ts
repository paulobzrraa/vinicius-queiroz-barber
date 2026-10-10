import type { AvailableSlot } from '@/queries/availability'

export type BookingStep = 'services' | 'professional' | 'datetime' | 'client' | 'review' | 'success'

/** Ordem das seções do acordeão de agendamento (sucesso não é uma seção, é a tela final). */
export const stepOrder: BookingStep[] = ['services', 'professional', 'datetime', 'client', 'review']

export const stepLabels: Record<BookingStep, string> = {
  services: 'Serviço',
  professional: 'Profissional',
  datetime: 'Data e horário',
  client: 'Seus dados',
  review: 'Confirmação',
  success: 'Concluído',
}

export interface BookingState {
  serviceIds: string[]
  /** null = sem preferência (BL-061): o profissional é escolhido na hora de gravar. */
  professionalId: string | null
  date: string | null
  slot: AvailableSlot | null
  clientName: string
  clientPhone: string
  /** Opcional; vazio = não informado. */
  clientEmail: string
  /** Senha da conta (só com e-mail). Nunca vai para o rascunho em sessionStorage. */
  clientPassword: string
  /** BL-104: campo isca do ClientStep — preenchido só por bot. */
  honeypot: string
}

export const initialBookingState: BookingState = {
  serviceIds: [],
  professionalId: null,
  date: null,
  slot: null,
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  clientPassword: '',
  honeypot: '',
}
