import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { GALLERY_BUCKET, PHOTO_CACHE_CONTROL, supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { prepareImageForUpload } from '@/utils/imageUpload'

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

/** Lado maior da foto de fundo: cobre telas de 2560 px sem subir o original do celular. */
const HERO_PHOTO_MAX_SIDE = 2560

/** Envia a foto de fundo do Hero para o bucket "gallery" (redimensionada, em WebP) e devolve a URL pública. */
export function useUploadHeroPhoto() {
  return useMutation({
    mutationFn: async (file: File) => {
      const prepared = await prepareImageForUpload(file, HERO_PHOTO_MAX_SIDE)
      const path = `hero-${Date.now()}.${prepared.extension}`

      const { error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(path, prepared.file, {
          upsert: true,
          contentType: prepared.contentType,
          cacheControl: PHOTO_CACHE_CONTROL,
        })
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

      // GIF não é recodificado (pode ser animado): sobe como está, só com o cache longo.
      const { error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: PHOTO_CACHE_CONTROL })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path)
      return data.publicUrl
    },
  })
}
