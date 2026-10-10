import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type ServiceRow = Database['public']['Tables']['services']['Row']
type ServiceInsert = Database['public']['Tables']['services']['Insert']

const key = ['services']
const activeKey = ['services', 'active']

async function fetchServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase.from('services').select('*').order('sort_order')
  if (error) throw error
  return data
}

/** Todos os serviços, pausados ou não — usado no admin para gerenciar. */
export function useServices() {
  return useQuery({ queryKey: key, queryFn: fetchServices })
}

async function fetchActiveServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  if (error) throw error
  return data
}

/** Só os serviços visíveis (BL-096) — usado na landing page e no fluxo de agendamento. */
export function useActiveServices() {
  return useQuery({ queryKey: activeKey, queryFn: fetchActiveServices })
}

export function useSaveService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: ServiceInsert) => {
      const { error } = await supabase.from('services').upsert(row)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: activeKey })
    },
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: activeKey })
    },
  })
}
