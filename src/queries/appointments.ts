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
 * precisar de login. get_appointment_by_token roda como security definer no
 * banco — aqui só chamamos e completamos com profissional/serviços, que já
 * são de leitura pública.
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

      const [{ data: professional }, { data: appointmentServices, error: servicesError }] =
        await Promise.all([
          supabase
            .from('professionals')
            .select('*')
            .eq('id', appointment.professional_id)
            .maybeSingle(),
          supabase.from('appointment_services').select('*').eq('appointment_id', appointment.id),
        ])
      if (servicesError) throw servicesError

      const serviceIds = (appointmentServices ?? []).map((row) => row.service_id)
      const nameById = new Map<string, string>()

      if (serviceIds.length > 0) {
        const { data: serviceNames, error: namesError } = await supabase
          .from('services')
          .select('id, name')
          .in('id', serviceIds)
        if (namesError) throw namesError
        for (const service of serviceNames ?? []) nameById.set(service.id, service.name)
      }

      return {
        appointment,
        professional: professional ?? null,
        services: (appointmentServices ?? []).map((row) => ({
          ...row,
          name: nameById.get(row.service_id) ?? row.service_id,
        })),
      }
    },
    enabled: token !== undefined,
  })
}
