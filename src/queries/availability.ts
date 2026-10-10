import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { clientSupabase, supabase } from '@/lib/supabase'

export interface AvailableSlot {
  professionalId: string
  startsAt: string
  endsAt: string
}

export interface CreateAppointmentInput {
  clientName: string
  clientPhone: string
  /** Opcional: com e-mail + senha, o cliente consulta os agendamentos em "Meus agendamentos". */
  clientEmail?: string
  /** Obrigatória com e-mail: cria a conta (1º agendamento) ou confere a senha dela. */
  clientPassword?: string
  serviceIds: string[]
  startsAt: string
  professionalId: string | null
  /** BL-104: campo isca invisível — se vier preenchido, é bot; a mutation nem chama o banco. */
  honeypot?: string
}

/** Erro conhecido: o horário escolhido acabou de ser ocupado (BL-073/BL-060). */
export class SlotUnavailableError extends Error {
  constructor() {
    super('slot_unavailable')
  }
}

/** BL-104: telefone criou agendamento(s) demais em pouco tempo (rate_limited, P0005). */
export class RateLimitedError extends Error {
  constructor() {
    super('rate_limited')
  }
}

function isSlotUnavailable(error: { message?: string; code?: string }): boolean {
  // "P0001"/"slot_unavailable": a revalidação em create_appointment não achou o horário livre.
  // "23P01": a constraint de exclusão (BL-060) barrou uma corrida perdida no INSERT.
  return error.code === '23P01' || error.message?.includes('slot_unavailable') === true
}

function isRateLimited(error: { message?: string; code?: string }): boolean {
  return error.code === 'P0005' || error.message?.includes('rate_limited') === true
}

/** Dias com pelo menos um horário livre num intervalo (BL-068, calendário). */
export function useAvailableDates(params: {
  serviceIds: string[]
  professionalId: string | null
  startDate: string
  endDate: string
  enabled?: boolean
}) {
  const { serviceIds, professionalId, startDate, endDate, enabled = true } = params

  return useQuery({
    queryKey: ['available_dates', serviceIds, professionalId, startDate, endDate],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('get_available_dates', {
        p_service_ids: serviceIds,
        p_start_date: startDate,
        p_end_date: endDate,
        p_professional_id: professionalId,
      })
      if (error) throw error
      return data.map((row) => row.available_date)
    },
    enabled: enabled && serviceIds.length > 0,
  })
}

/** Horários livres de um dia (BL-069, grade de horários). */
export function useAvailableSlots(params: {
  serviceIds: string[]
  professionalId: string | null
  date: string | null
}) {
  const { serviceIds, professionalId, date } = params

  return useQuery({
    queryKey: ['available_slots', serviceIds, professionalId, date],
    queryFn: async (): Promise<AvailableSlot[]> => {
      const { data, error } = await supabase.rpc('get_available_slots', {
        p_service_ids: serviceIds,
        p_date: date!,
        p_professional_id: professionalId,
      })
      if (error) throw error
      return data.map((row) => ({
        professionalId: row.professional_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }))
    },
    enabled: serviceIds.length > 0 && date !== null,
  })
}

/** Grava o agendamento (BL-073: quem revalida de verdade é o banco, não este hook). */
export function useCreateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      // Bot preencheu o campo isca: rejeita sem nem chamar o banco (BL-104).
      if (input.honeypot) throw new RateLimitedError()

      // clientSupabase: se o cliente entrou com Google, o banco recebe a sessão e dispensa a senha
      // quando o e-mail é o dele; sem login, é anônimo como antes.
      const { data, error } = await clientSupabase.rpc('create_appointment', {
        p_client_name: input.clientName,
        p_client_phone: input.clientPhone,
        p_service_ids: input.serviceIds,
        p_starts_at: input.startsAt,
        p_professional_id: input.professionalId,
        // Omitido quando vazio: segue funcionando mesmo antes de aplicar a migração do e-mail.
        ...(input.clientEmail
          ? {
              p_client_email: input.clientEmail,
              p_client_password: input.clientPassword || undefined,
            }
          : {}),
      })

      if (error) {
        if (isSlotUnavailable(error)) throw new SlotUnavailableError()
        if (isRateLimited(error)) throw new RateLimitedError()
        throw error
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available_dates'] })
      queryClient.invalidateQueries({ queryKey: ['available_slots'] })
    },
  })
}
