import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type AppointmentActionReason =
  'not_found' | 'slot_unavailable' | 'too_late' | 'already_canceled'

/** Erros conhecidos de cancel_appointment/reschedule_appointment (BL-078/079), mapeados
 * dos errcodes definidos em supabase/schema.sql (P0001 a P0004, mais 23P01 da constraint de exclusão). */
export class AppointmentActionError extends Error {
  reason: AppointmentActionReason

  constructor(reason: AppointmentActionReason) {
    super(reason)
    this.reason = reason
  }
}

function toActionError(error: { code?: string }): AppointmentActionError {
  switch (error.code) {
    case 'P0002':
      return new AppointmentActionError('not_found')
    case 'P0003':
      return new AppointmentActionError('too_late')
    case 'P0004':
      return new AppointmentActionError('already_canceled')
    case 'P0001':
    case '23P01':
      return new AppointmentActionError('slot_unavailable')
    default:
      throw error
  }
}

export function useCancelAppointment(token: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cancel_appointment', { p_token: token })
      if (error) throw toActionError(error)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointment', token] }),
  })
}

export function useRescheduleAppointment(token: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (startsAt: string) => {
      const { data, error } = await supabase.rpc('reschedule_appointment', {
        p_token: token,
        p_starts_at: startsAt,
      })
      if (error) throw toActionError(error)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointment', token] }),
  })
}
