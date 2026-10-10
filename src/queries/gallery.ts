import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { GALLERY_BUCKET, supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

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

/** Envia a foto para o bucket "gallery" e devolve a URL pública. */
export function useUploadGalleryPhoto() {
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const extension = file.name.split('.').pop() ?? 'jpg'
      const path = `${id}-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path)
      return data.publicUrl
    },
  })
}
