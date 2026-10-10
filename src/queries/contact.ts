import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type ContactSettings = Database['public']['Tables']['contact_settings']['Row']
type ContactSettingsUpdate = Database['public']['Tables']['contact_settings']['Update']
type OpeningHoursRow = Database['public']['Tables']['opening_hours']['Row']
type OpeningHoursInsert = Database['public']['Tables']['opening_hours']['Insert']
type SocialLinkRow = Database['public']['Tables']['social_links']['Row']
type SocialLinkInsert = Database['public']['Tables']['social_links']['Insert']

const contactKey = ['contact_settings']
const hoursKey = ['opening_hours']
const socialsKey = ['social_links']

// ------------------------------------------------------------- endereço/contato

async function fetchContactSettings(): Promise<ContactSettings | null> {
  const { data, error } = await supabase
    .from('contact_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data
}

export function useContactSettings() {
  return useQuery({ queryKey: contactKey, queryFn: fetchContactSettings })
}

export function useUpdateContactSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ContactSettingsUpdate) => {
      const { error } = await supabase.from('contact_settings').update(values).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contactKey }),
  })
}

// ------------------------------------------------------------------- horários

async function fetchOpeningHours(): Promise<OpeningHoursRow[]> {
  const { data, error } = await supabase.from('opening_hours').select('*').order('sort_order')
  if (error) throw error
  return data
}

export function useOpeningHours() {
  return useQuery({ queryKey: hoursKey, queryFn: fetchOpeningHours })
}

export function useSaveOpeningHours() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: OpeningHoursInsert) => {
      const { error } = await supabase.from('opening_hours').upsert(row)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hoursKey }),
  })
}

/** BL-093: grava os 7 dias estruturados de uma vez (upsert) e remove os que ficaram vazios (fechados). */
export function useSaveOpeningHoursBulk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      upsert,
      deleteIds,
    }: {
      upsert: OpeningHoursInsert[]
      deleteIds: string[]
    }) => {
      if (upsert.length > 0) {
        const { error } = await supabase.from('opening_hours').upsert(upsert)
        if (error) throw error
      }
      if (deleteIds.length > 0) {
        const { error } = await supabase.from('opening_hours').delete().in('id', deleteIds)
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hoursKey }),
  })
}

export function useDeleteOpeningHours() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('opening_hours').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hoursKey }),
  })
}

// -------------------------------------------------------------- redes sociais

async function fetchSocialLinks(): Promise<SocialLinkRow[]> {
  const { data, error } = await supabase.from('social_links').select('*').order('sort_order')
  if (error) throw error
  return data
}

export function useSocialLinks() {
  return useQuery({ queryKey: socialsKey, queryFn: fetchSocialLinks })
}

export function useSaveSocialLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: SocialLinkInsert) => {
      const { error } = await supabase.from('social_links').upsert(row)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: socialsKey }),
  })
}

export function useDeleteSocialLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('social_links').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: socialsKey }),
  })
}
