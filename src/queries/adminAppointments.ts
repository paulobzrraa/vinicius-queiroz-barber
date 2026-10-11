import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabase } from '@/lib/supabase'
import type { AppointmentStatus, Database, PaymentMethod } from '@/lib/database.types'

import { assertSaved } from './writes'

export type AppointmentRow = Database['public']['Tables']['appointments']['Row']

export interface AppointmentWithDetails extends AppointmentRow {
  professionalName: string
  serviceIds: string[]
  serviceNames: string[]
}

const baseKey = ['admin_appointments']
const rangeKey = (startIso: string, endIso: string) => [...baseKey, startIso, endIso]

/*
 * Uma ida ao banco só: o profissional e os serviços vêm embutidos, resolvidos pelas
 * chaves estrangeiras. Antes eram 3 a 4 requisições, e a última mandava todos os ids
 * numa lista `in(...)` na URL, que ficava longa num mês cheio.
 */
const appointmentDetailsSelect =
  '*, professional:professionals(name), appointment_services(service_id, services(name))'

async function fetchAppointmentsInRange(
  startIso: string,
  endIso: string,
): Promise<AppointmentWithDetails[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(appointmentDetailsSelect)
    .gte('starts_at', startIso)
    .lt('starts_at', endIso)
    .order('starts_at')
  if (error) throw error

  return data.map(({ professional, appointment_services, ...appointment }) => ({
    ...appointment,
    professionalName: professional?.name ?? '—',
    serviceIds: appointment_services.map((row) => row.service_id),
    serviceNames: appointment_services.map((row) => row.services?.name ?? row.service_id),
  }))
}

/** BL-081/082: agendamentos entre duas datas (ISO), com nome do profissional e dos serviços já resolvidos. */
export function useAppointmentsInRange(startIso: string, endIso: string) {
  return useQuery({
    queryKey: rangeKey(startIso, endIso),
    queryFn: () => fetchAppointmentsInRange(startIso, endIso),
  })
}

/** BL-080 (painel): qualquer INSERT/UPDATE/DELETE em appointments invalida a
 * visão da agenda, então ela se atualiza sozinha sem precisar recarregar a
 * página. RLS filtra quem recebe o evento — só o admin autenticado escuta
 * (appointments não tem policy de leitura pública, ver BL-058). */
export function useAppointmentsRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        queryClient.invalidateQueries({ queryKey: baseKey })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

interface ManualAppointmentInput {
  clientName: string
  clientPhone: string
  professionalId: string
  serviceIds: string[]
  startsAt: string
}

/** BL-083: agendamento criado pelo admin (cliente que ligou ou chegou sem agendar online).
 * Ao contrário do fluxo público (create_appointment, BL-073), não passa pela grade de 15min
 * nem pela janela de antecedência — o admin decide o horário direto. A função
 * admin_create_appointment grava agendamento, serviços e histórico numa transação só, e a
 * constraint de exclusão (BL-060) ainda protege contra sobrepor outro agendamento. */
export function useCreateManualAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ManualAppointmentInput) => {
      const { data, error } = await supabase.rpc('admin_create_appointment', {
        p_client_name: input.clientName,
        p_client_phone: input.clientPhone,
        p_professional_id: input.professionalId,
        p_service_ids: input.serviceIds,
        p_starts_at: input.startsAt,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  })
}

interface MoveAppointmentInput {
  id: string
  professionalId: string
  startsAt: string
  serviceIds: string[]
}

/** BL-084: muda profissional, horário e/ou serviços em uma transação só (admin_move_appointment):
 * recalcula ends_at a partir dos serviços atuais e troca os serviços sem deixar a linha pela metade. */
export function useMoveAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: MoveAppointmentInput) => {
      const { error } = await supabase.rpc('admin_move_appointment', {
        p_appointment_id: input.id,
        p_professional_id: input.professionalId,
        p_starts_at: input.startsAt,
        p_service_ids: input.serviceIds,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  })
}

/** BL-105: anonimiza agendamentos mais antigos que o prazo (dias). Retorna quantas linhas mudaram. */
export function useAnonymizeOldAppointments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (olderThanDays: number) => {
      const { data, error } = await supabase.rpc('anonymize_old_appointments', {
        p_older_than: `${olderThanDays} days`,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  })
}

/** BL-105: exclusão sob pedido — remove nome/telefone de todos os agendamentos daquele telefone. */
export function useEraseClientData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (clientPhone: string) => {
      const { data, error } = await supabase.rpc('erase_client_data', {
        p_client_phone: clientPhone,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  })
}

/** BL-085: confirmado, concluído, cancelado ou não compareceu — registra no histórico quem mudou. */
export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id)
        .select('id')
      if (error) throw error
      assertSaved(data)

      const { error: historyError } = await supabase
        .from('appointment_status_history')
        .insert({ appointment_id: id, status, changed_by: 'admin' })
      if (historyError) throw historyError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  })
}

/** Exclui o agendamento (appointment_services e appointment_status_history cascateiam pela FK). */
export function useDeleteAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  })
}

/** BL-098: forma de pagamento de um agendamento concluído — alimenta o módulo financeiro (ganho por forma de pagamento). */
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      paymentMethod,
    }: {
      id: string
      paymentMethod: PaymentMethod | null
    }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update({ payment_method: paymentMethod })
        .eq('id', id)
        .select('id')
      if (error) throw error
      assertSaved(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: baseKey }),
  })
}

/** Esqueci a senha: o admin define uma senha nova para a conta do cliente (reset_client_password). Devolve quantas contas mudaram (0 = e-mail sem conta). */
export function useResetClientPassword() {
  return useMutation({
    mutationFn: async (input: { email: string; newPassword: string }) => {
      const { data, error } = await supabase.rpc('reset_client_password', {
        p_email: input.email,
        p_new_password: input.newPassword,
      })
      if (error) throw error
      return data
    },
  })
}
