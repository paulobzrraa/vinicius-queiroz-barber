import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database, ExpenseCategory, PaymentMethod } from '@/lib/database.types'

export type ExpenseRow = Database['public']['Tables']['expenses']['Row']
type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  pix: 'Pix',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Aluguel',
  supplies: 'Produtos e insumos',
  utilities: 'Contas (água, luz, internet)',
  maintenance: 'Manutenção',
  marketing: 'Marketing',
  commission: 'Comissão paga',
  other: 'Outros',
}

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]

// ------------------------------------------------------------------ despesas

const expensesKey = ['expenses']
const expensesRangeKey = (startDate: string, endDate: string) => [
  ...expensesKey,
  startDate,
  endDate,
]

/** Despesas com expense_date em [startDate, endDate) — formato AAAA-MM-DD (BL-098). */
export function useExpensesInRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: expensesRangeKey(startDate, endDate),
    queryFn: async (): Promise<ExpenseRow[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lt('expense_date', endDate)
        .order('expense_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSaveExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (row: ExpenseInsert) => {
      const { error } = await supabase.from('expenses').upsert(row)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expensesKey }),
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expensesKey }),
  })
}

// -------------------------------------------------------------------- ganhos

export interface CompletedAppointmentRevenue {
  id: string
  startsAt: string
  professionalId: string
  professionalName: string
  paymentMethod: PaymentMethod | null
  services: { serviceId: string; serviceName: string; price: number }[]
  total: number
}

const revenueKey = ['revenue']
const revenueRangeKey = (startIso: string, endIso: string) => [...revenueKey, startIso, endIso]

/**
 * Agendamentos concluídos num intervalo, com o valor somado dos serviços —
 * base de "ganho" do módulo financeiro (BL-098). Cancelados e "não
 * compareceu" ficam de fora (filtro `status = completed`), para o número
 * refletir receita real, não tudo que passou pela agenda.
 */
export function useRevenueInRange(startIso: string, endIso: string) {
  return useQuery({
    queryKey: revenueRangeKey(startIso, endIso),
    queryFn: async (): Promise<CompletedAppointmentRevenue[]> => {
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('id, starts_at, professional_id, payment_method')
        .gte('starts_at', startIso)
        .lt('starts_at', endIso)
        .eq('status', 'completed')
        .order('starts_at')
      if (error) throw error
      if (appointments.length === 0) return []

      const appointmentIds = appointments.map((appointment) => appointment.id)

      const [{ data: professionals }, { data: appointmentServices, error: servicesError }] =
        await Promise.all([
          supabase.from('professionals').select('id, name'),
          supabase
            .from('appointment_services')
            .select('appointment_id, service_id, price')
            .in('appointment_id', appointmentIds),
        ])
      if (servicesError) throw servicesError

      const serviceIds = [...new Set((appointmentServices ?? []).map((row) => row.service_id))]
      const { data: serviceRows } =
        serviceIds.length > 0
          ? await supabase.from('services').select('id, name').in('id', serviceIds)
          : { data: [] }

      const professionalNameById = new Map(professionals?.map((row) => [row.id, row.name]))
      const serviceNameById = new Map(serviceRows?.map((row) => [row.id, row.name]))

      const servicesByAppointment = new Map<
        string,
        { serviceId: string; serviceName: string; price: number }[]
      >()
      for (const row of appointmentServices ?? []) {
        servicesByAppointment.set(row.appointment_id, [
          ...(servicesByAppointment.get(row.appointment_id) ?? []),
          {
            serviceId: row.service_id,
            serviceName: serviceNameById.get(row.service_id) ?? row.service_id,
            price: row.price ?? 0,
          },
        ])
      }

      return appointments.map((appointment) => {
        const services = servicesByAppointment.get(appointment.id) ?? []
        return {
          id: appointment.id,
          startsAt: appointment.starts_at,
          professionalId: appointment.professional_id,
          professionalName: professionalNameById.get(appointment.professional_id) ?? '—',
          paymentMethod: appointment.payment_method,
          services,
          total: services.reduce((sum, item) => sum + item.price, 0),
        }
      })
    },
  })
}
