import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  dateKeyOf,
  daysInMonth,
  daysInWeek,
  startOfMonth,
  startOfWeek,
  weekdayOf,
} from './dateUtils'

/** BL-111: mesma bateria da agenda pública (src/utils/timezone.ts), mas para as
 * datas da Agenda do admin — que usam o horário local do navegador, não Fortaleza fixo. */
describe('dateUtils da Agenda do admin', () => {
  it('addDays cruza fim de mês e de ano', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('addDays atravessa fevereiro bissexto', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('addMonths cruza virada de ano nos dois sentidos', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('daysInMonth conta corretamente fevereiro bissexto e não bissexto', () => {
    expect(daysInMonth('2028-02')).toHaveLength(29)
    expect(daysInMonth('2026-02')).toHaveLength(28)
  })

  it('startOfMonth sempre cai no dia 01', () => {
    expect(startOfMonth('2026-06-17')).toBe('2026-06-01')
  })

  it('weekdayOf bate com o dia da semana conhecido', () => {
    expect(weekdayOf('2026-01-01')).toBe(4) // quinta
  })

  it('startOfWeek sempre cai num domingo, venha de qualquer dia da semana', () => {
    expect(startOfWeek('2026-01-01')).toBe('2025-12-28') // quinta -> domingo anterior
    expect(startOfWeek('2025-12-28')).toBe('2025-12-28') // já é domingo
  })

  it('startOfWeek cruza virada de mês e de ano', () => {
    expect(startOfWeek('2026-01-01')).toBe('2025-12-28')
  })

  it('daysInWeek retorna os 7 dias, domingo a sábado', () => {
    expect(daysInWeek('2026-01-01')).toEqual([
      '2025-12-28',
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ])
  })

  it('dateKeyOf faz a volta certa a partir do ISO, em qualquer fuso de quem roda o teste', () => {
    // new Date(ano, mês, dia, hora) usa o fuso local da máquina que roda o
    // teste; toISOString() converte para UTC. dateKeyOf tem que desfazer essa
    // conversão e voltar ao mesmo dia local, não ao dia em UTC.
    const local = new Date(2026, 0, 1, 23, 30)
    expect(dateKeyOf(local.toISOString())).toBe('2026-01-01')
  })
})
