import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  compareDateKeys,
  daysInMonth,
  startOfMonth,
  weekdayOf,
} from './timezone'

/**
 * BL-111: aritmética de datas do fluxo de agendamento em datas de fronteira
 * (virada de mês, virada de ano, fevereiro bissexto). São funções puras —
 * não precisam de banco nem de fuso do navegador para testar.
 */
describe('addDays', () => {
  it('cruza o fim do mês', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('cruza o fim do ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('aceita deltas negativos cruzando o início do mês', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('atravessa fevereiro bissexto', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
  })

  it('atravessa fevereiro não bissexto', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('addMonths', () => {
  it('cruza o fim do ano', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
  })

  it('aceita deltas negativos cruzando o início do ano', () => {
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
  })
})

describe('daysInMonth', () => {
  it('fevereiro tem 29 dias em ano bissexto', () => {
    expect(daysInMonth('2028-02-01')).toHaveLength(29)
  })

  it('fevereiro tem 28 dias em ano não bissexto', () => {
    expect(daysInMonth('2026-02-01')).toHaveLength(28)
  })

  it('meses de 30 e 31 dias', () => {
    expect(daysInMonth('2026-04-01')).toHaveLength(30)
    expect(daysInMonth('2026-01-01')).toHaveLength(31)
  })

  it('a primeira e a última chave batem com o mês pedido', () => {
    const days = daysInMonth('2026-04-15')
    expect(days[0]).toBe('2026-04-01')
    expect(days.at(-1)).toBe('2026-04-30')
  })
})

describe('weekdayOf', () => {
  it('bate com o dia da semana conhecido (2026-01-01 é uma quinta)', () => {
    expect(weekdayOf('2026-01-01')).toBe(4)
  })

  it('domingo é 0 e sábado é 6', () => {
    expect(weekdayOf('2026-01-04')).toBe(0)
    expect(weekdayOf('2026-01-03')).toBe(6)
  })
})

describe('startOfMonth', () => {
  it('sempre volta pro dia 01 do mesmo mês', () => {
    expect(startOfMonth('2026-06-17')).toBe('2026-06-01')
  })
})

describe('compareDateKeys', () => {
  it('ordena cruzando virada de ano', () => {
    expect(compareDateKeys('2026-12-31', '2027-01-01')).toBeLessThan(0)
    expect(compareDateKeys('2027-01-01', '2026-12-31')).toBeGreaterThan(0)
    expect(compareDateKeys('2026-06-01', '2026-06-01')).toBe(0)
  })
})
