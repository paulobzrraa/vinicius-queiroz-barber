import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

import { assertSaved } from './writes'

type BookingSettings = Database['public']['Tables']['booking_settings']['Row']
type BookingSettingsUpdate = Database['public']['Tables']['booking_settings']['Update']

const key = ['booking_settings']

async function fetchBookingSettings(): Promise<BookingSettings | null> {
  const { data, error } = await supabase
    .from('booking_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data
}

export function useBookingSettings() {
  return useQuery({ queryKey: key, queryFn: fetchBookingSettings })
}

export function useUpdateBookingSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: BookingSettingsUpdate) => {
      const { data, error } = await supabase
        .from('booking_settings')
        .update(values)
        .eq('id', 1)
        .select('id')
      if (error) throw error
      assertSaved(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
