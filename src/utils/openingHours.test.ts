import { describe, expect, it } from 'vitest'

import { businessHoursRangeMinutes, groupStructuredHours, hoursForWeekday } from './openingHours'
import type { Database } from '@/lib/database.types'

type OpeningHoursRow = Database['public']['Tables']['opening_hours']['Row']

function row(overrides: Partial<OpeningHoursRow>): OpeningHoursRow {
  return {
    id: 'id',
    days: '',
    hours: '',
    sort_order: 0,
    weekday: null,
    opens_at: null,
    closes_at: null,
    ...overrides,
  }
}

describe('groupStructuredHours', () => {
  it('agrupa uma faixa de dias consecutivos com o mesmo horário', () => {
    const rows = [1, 2, 3, 4, 5, 6].map((weekday) =>
      row({ weekday, opens_at: '09:00:00', closes_at: '19:00:00' }),
    )

    expect(groupStructuredHours(rows)).toEqual([
      { label: 'Segunda a Sábado', hours: '09:00 às 19:00' },
    ])
  })

  it('separa dias com horário diferente em linhas distintas', () => {
    const rows = [
      row({ weekday: 0, opens_at: '10:00:00', closes_at: '14:00:00' }),
      ...[1, 2, 3, 4, 5].map((weekday) =>
        row({ weekday, opens_at: '09:00:00', closes_at: '19:00:00' }),
      ),
    ]

    expect(groupStructuredHours(rows)).toEqual([
      { label: 'Domingo', hours: '10:00 às 14:00' },
      { label: 'Segunda a Sexta', hours: '09:00 às 19:00' },
    ])
  })

  it('omite dias fechados (sem linha ou sem horário) da lista', () => {
    const rows = [1, 2, 3, 4, 5].map((weekday) =>
      row({ weekday, opens_at: '09:00:00', closes_at: '19:00:00' }),
    )
    // sábado (6) e domingo (0) não têm linha -> fechados, não devem aparecer

    expect(groupStructuredHours(rows)).toEqual([
      { label: 'Segunda a Sexta', hours: '09:00 às 19:00' },
    ])
  })

  it('um único dia aberto não usa "a" no rótulo', () => {
    const rows = [row({ weekday: 3, opens_at: '10:00:00', closes_at: '14:00:00' })]
    expect(groupStructuredHours(rows)).toEqual([{ label: 'Quarta', hours: '10:00 às 14:00' }])
  })

  it('sem nenhuma linha estruturada, devolve lista vazia', () => {
    expect(groupStructuredHours([])).toEqual([])
    expect(groupStructuredHours([row({ weekday: null })])).toEqual([])
  })
})

describe('hoursForWeekday', () => {
  it('converte opens_at/closes_at para minutos desde a meia-noite', () => {
    const rows = [row({ weekday: 2, opens_at: '09:30:00', closes_at: '19:00:00' })]
    expect(hoursForWeekday(rows, 2)).toEqual({ opensAtMinutes: 570, closesAtMinutes: 1140 })
  })

  it('devolve null para um dia sem linha ou sem horário (fechado)', () => {
    const rows = [row({ weekday: 2, opens_at: '09:00:00', closes_at: '19:00:00' })]
    expect(hoursForWeekday(rows, 0)).toBeNull()
    expect(hoursForWeekday([row({ weekday: 0, opens_at: null, closes_at: null })], 0)).toBeNull()
  })
})

describe('businessHoursRangeMinutes', () => {
  it('pega a menor abertura e a maior fechamento entre os dias cadastrados', () => {
    const rows = [
      row({ weekday: 1, opens_at: '09:00:00', closes_at: '19:00:00' }),
      row({ weekday: 6, opens_at: '08:00:00', closes_at: '14:00:00' }),
    ]
    expect(businessHoursRangeMinutes(rows)).toEqual({ opensAtMinutes: 480, closesAtMinutes: 1140 })
  })

  it('sem nenhum horário cadastrado, cai no padrão 8h-20h', () => {
    expect(businessHoursRangeMinutes([])).toEqual({ opensAtMinutes: 480, closesAtMinutes: 1200 })
  })
})
