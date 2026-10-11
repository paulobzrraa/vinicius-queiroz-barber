import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { GALLERY_BUCKET, PHOTO_CACHE_CONTROL, supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { prepareImageForUpload } from '@/utils/imageUpload'

export type GalleryImageRow = Database['public']['Tables']['gallery_images']['Row']
type GalleryImageInsert = Database['public']['Tables']['gallery_images']['Insert']

const key = ['gallery_images']

async function fetchGalleryImages(): Promise<GalleryImageRow[]> {
  const { data, error } = await supabase.from('gallery_images').select('*').order('sort_order')
  if (error) throw error
  return data
}

export function useGalleryImages() {
  return useQuery({ queryKey: key, queryFn: fetchGalleryImages })
}

export function useSaveGalleryImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: GalleryImageInsert) => {
      const { error } = await supabase.from('gallery_images').upsert(row)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteGalleryImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gallery_images').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Lado maior de uma foto da galeria: o maior card e a lightbox ficam bem abaixo disso. */
const GALLERY_PHOTO_MAX_SIDE = 1600

/** Envia a foto para o bucket "gallery" (redimensionada, em WebP) e devolve a URL pública. */
export function useUploadGalleryPhoto() {
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const prepared = await prepareImageForUpload(file, GALLERY_PHOTO_MAX_SIDE)
      const path = `${id}-${Date.now()}.${prepared.extension}`

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
