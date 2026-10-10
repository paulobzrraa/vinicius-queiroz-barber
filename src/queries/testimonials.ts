import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type TestimonialRow = Database['public']['Tables']['testimonials']['Row']
type TestimonialInsert = Database['public']['Tables']['testimonials']['Insert']

const key = ['testimonials']

async function fetchTestimonials(): Promise<TestimonialRow[]> {
  const { data, error } = await supabase.from('testimonials').select('*').order('sort_order')
  if (error) throw error
  return data
}

export function useTestimonials() {
  return useQuery({ queryKey: key, queryFn: fetchTestimonials })
}

export function useSaveTestimonial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: TestimonialInsert) => {
      const { error } = await supabase.from('testimonials').upsert(row)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteTestimonial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('testimonials').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
