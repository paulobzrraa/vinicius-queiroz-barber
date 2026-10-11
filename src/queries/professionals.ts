import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { GALLERY_BUCKET, PHOTO_CACHE_CONTROL, supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { prepareImageForUpload } from '@/utils/imageUpload'

export type ProfessionalRow = Database['public']['Tables']['professionals']['Row']
type ProfessionalInsert = Database['public']['Tables']['professionals']['Insert']
export type ProfessionalServiceRow = Database['public']['Tables']['professional_services']['Row']
type ProfessionalServiceInsert = Database['public']['Tables']['professional_services']['Insert']
export type ProfessionalHoursRow = Database['public']['Tables']['professional_hours']['Row']
type ProfessionalHoursInsert = Database['public']['Tables']['professional_hours']['Insert']
export type ScheduleExceptionRow = Database['public']['Tables']['schedule_exceptions']['Row']
type ScheduleExceptionInsert = Database['public']['Tables']['schedule_exceptions']['Insert']

const key = ['professionals']
const activeKey = ['professionals', 'active']

async function fetchProfessionals(): Promise<ProfessionalRow[]> {
  const { data, error } = await supabase.from('professionals').select('*').order('sort_order')
  if (error) throw error
  return data
}

/** Todos os profissionais, ativos ou não — usado no admin para gerenciar (BL-088). */
export function useProfessionals() {
  return useQuery({ queryKey: key, queryFn: fetchProfessionals })
}

async function fetchActiveProfessionals(): Promise<ProfessionalRow[]> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  if (error) throw error
  return data
}

/** Só os ativos — usado na landing page e no fluxo de agendamento do cliente. */
export function useActiveProfessionals() {
  return useQuery({ queryKey: activeKey, queryFn: fetchActiveProfessionals })
}

function invalidateProfessionals(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: key })
  queryClient.invalidateQueries({ queryKey: activeKey })
}

export function useSaveProfessional() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: ProfessionalInsert) => {
      const { data, error } = await supabase.from('professionals').upsert(row).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateProfessionals(queryClient),
  })
}

export function useDeleteProfessional() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('professionals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateProfessionals(queryClient),
  })
}

/** Lado maior da foto de profissional: é exibida num círculo de até ~144 px (com folga para retina). */
const PROFESSIONAL_PHOTO_MAX_SIDE = 800

/** Envia a foto para o bucket "gallery" (mesmo bucket da galeria, path próprio; redimensionada, em WebP) e devolve a URL pública. */
export function useUploadProfessionalPhoto() {
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const prepared = await prepareImageForUpload(file, PROFESSIONAL_PHOTO_MAX_SIDE)
      const path = `professionals/${id}-${Date.now()}.${prepared.extension}`

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

// --------------------------------------------------------- serviços x profissional

async function fetchProfessionalServices(): Promise<ProfessionalServiceRow[]> {
  const { data, error } = await supabase.from('professional_services').select('*')
  if (error) throw error
  return data
}

const servicesKey = ['professional_services']

/** Todas as linhas (tabela pequena): usado para filtrar, no cliente, quem atende
 * a combinação de serviços escolhida no fluxo de agendamento e para o admin editar. */
export function useProfessionalServices() {
  return useQuery({ queryKey: servicesKey, queryFn: fetchProfessionalServices })
}

export function useSaveProfessionalService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: ProfessionalServiceInsert) => {
      const { error } = await supabase.from('professional_services').upsert(row)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: servicesKey }),
  })
}

export function useDeleteProfessionalService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      professionalId,
      serviceId,
    }: {
      professionalId: string
      serviceId: string
    }) => {
      const { error } = await supabase
        .from('professional_services')
        .delete()
        .eq('professional_id', professionalId)
        .eq('service_id', serviceId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: servicesKey }),
  })
}

// --------------------------------------------------------------- horário semanal

function professionalHoursKey(professionalId: string) {
  return ['professional_hours', professionalId]
}

export function useProfessionalHours(professionalId: string) {
  return useQuery({
    queryKey: professionalHoursKey(professionalId),
    queryFn: async (): Promise<ProfessionalHoursRow[]> => {
      const { data, error } = await supabase
        .from('professional_hours')
        .select('*')
        .eq('professional_id', professionalId)
        .order('weekday')
      if (error) throw error
      return data
    },
  })
}

export function useSaveProfessionalHours(professionalId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: ProfessionalHoursInsert) => {
      const { error } = await supabase.from('professional_hours').upsert(row)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: professionalHoursKey(professionalId) }),
  })
}

export function useDeleteProfessionalHours(professionalId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('professional_hours').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: professionalHoursKey(professionalId) }),
  })
}

/** BL-089: grava os 7 dias de expediente de um profissional de uma vez. */
export function useSaveProfessionalHoursBulk(professionalId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      upsert,
      deleteIds,
    }: {
      upsert: ProfessionalHoursInsert[]
      deleteIds: string[]
    }) => {
      if (upsert.length > 0) {
        const { error } = await supabase.from('professional_hours').upsert(upsert)
        if (error) throw error
      }
      if (deleteIds.length > 0) {
        const { error } = await supabase.from('professional_hours').delete().in('id', deleteIds)
        if (error) throw error
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: professionalHoursKey(professionalId) }),
  })
}

// ------------------------------------------------------------- exceções de agenda

/** professionalId null = exceções da barbearia inteira (BL-094); com id, só daquele profissional (BL-090). */
function scheduleExceptionsKey(professionalId: string | null) {
  return ['schedule_exceptions', professionalId]
}

export function useScheduleExceptions(professionalId: string | null) {
  return useQuery({
    queryKey: scheduleExceptionsKey(professionalId),
    queryFn: async (): Promise<ScheduleExceptionRow[]> => {
      const query = supabase.from('schedule_exceptions').select('*').order('starts_at')
      const { data, error } =
        professionalId === null
          ? await query.is('professional_id', null)
          : await query.eq('professional_id', professionalId)
      if (error) throw error
      return data
    },
  })
}

export function useSaveScheduleException(professionalId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: ScheduleExceptionInsert) => {
      const { error } = await supabase.from('schedule_exceptions').insert(row)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: scheduleExceptionsKey(professionalId) }),
  })
}

export function useDeleteScheduleException(professionalId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_exceptions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: scheduleExceptionsKey(professionalId) }),
  })
}
