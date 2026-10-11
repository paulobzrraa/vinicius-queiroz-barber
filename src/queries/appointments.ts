import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type AppointmentRow = Database['public']['Tables']['appointments']['Row']
export type AppointmentServiceRow = Database['public']['Tables']['appointment_services']['Row']

export interface AppointmentDetails {
  appointment: AppointmentRow
  professional: Database['public']['Tables']['professionals']['Row'] | null
  services: (AppointmentServiceRow & { name: string })[]
}

/**
 * Busca um agendamento pelo link único do cliente (BL-058/BL-072), sem
 * precisar de login. Tanto o agendamento quanto os serviços vêm de funções
 * security definer no banco: appointment_services não tem leitura anônima (RLS
 * só para o admin), então um select direto voltaria vazio sem erro.
 */
export function useAppointmentByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['appointment', token],
    queryFn: async (): Promise<AppointmentDetails | null> => {
      const { data: rows, error } = await supabase.rpc('get_appointment_by_token', {
        token: token!,
      })
      if (error) throw error

      const appointment = rows[0]
      if (!appointment) return null

      const [{ data: professional }, { data: services, error: servicesError }] = await Promise.all([
        supabase
          .from('professionals')
          .select('*')
          .eq('id', appointment.professional_id)
          .maybeSingle(),
        supabase.rpc('get_appointment_services_by_token', { token: token! }),
      ])
      if (servicesError) throw servicesError

      return {
        appointment,
        professional: professional ?? null,
        services: services ?? [],
      }
    },
    enabled: token !== undefined,
  })
}
