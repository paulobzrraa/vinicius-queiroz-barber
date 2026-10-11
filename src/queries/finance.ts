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
// Colunas do select embutido: agendamento, profissional, e serviços com o preço gravado na reserva.
const revenueSelect =
  'id, starts_at, professional_id, payment_method, professional:professionals(name), appointment_services(service_id, price, services(name))'

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
      // Uma ida ao banco, com profissional, serviços e preço embutidos (ver fetchAppointmentsInRange).
      const { data, error } = await supabase
        .from('appointments')
        .select(revenueSelect)
        .gte('starts_at', startIso)
        .lt('starts_at', endIso)
        .eq('status', 'completed')
        .order('starts_at')
      if (error) throw error

      return data.map((appointment) => {
        const services = appointment.appointment_services.map((row) => ({
          serviceId: row.service_id,
          serviceName: row.services?.name ?? row.service_id,
          price: row.price ?? 0,
        }))
        return {
          id: appointment.id,
          startsAt: appointment.starts_at,
          professionalId: appointment.professional_id,
          professionalName: appointment.professional?.name ?? '—',
          paymentMethod: appointment.payment_method,
          services,
          total: services.reduce((sum, item) => sum + item.price, 0),
        }
      })
    },
  })
}
