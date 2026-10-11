import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { GALLERY_BUCKET, supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

import { assertSaved } from './writes'

type SiteSettings = Database['public']['Tables']['site_settings']['Row']
type SiteSettingsUpdate = Database['public']['Tables']['site_settings']['Update']

const key = ['site_settings']

async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data
}

export function useSiteSettings() {
  return useQuery({ queryKey: key, queryFn: fetchSiteSettings })
}

export function useUpdateSiteSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: SiteSettingsUpdate) => {
      const { data, error } = await supabase
        .from('site_settings')
        .update(values)
        .eq('id', 1)
        .select('id')
      if (error) throw error
      assertSaved(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Envia a foto de fundo do Hero para o bucket "gallery" e devolve a URL pública. */
export function useUploadHeroPhoto() {
  return useMutation({
    mutationFn: async (file: File) => {
      const extension = file.name.split('.').pop() ?? 'jpg'
      const path = `hero-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path)
      return data.publicUrl
    },
  })
}

/** Envia o GIF da seção Sobre Nós para o bucket "gallery" e devolve a URL pública. */
export function useUploadAboutGif() {
  return useMutation({
    mutationFn: async (file: File) => {
      const extension = file.name.split('.').pop() ?? 'gif'
      const path = `about-gif-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path)
      return data.publicUrl
    },
  })
}
