import { describe, expect, it } from 'vitest'

import {
  formatAppointmentMessage,
  formatNotificationMessage,
  type NotificationAppointment,
} from './message.ts'

const base: NotificationAppointment = {
  clientName: 'João Silva',
  clientPhone: '85999999999',
  // 17:30Z = 14:30 em America/Fortaleza (UTC-3, sem horário de verão)
  startsAt: '2026-10-12T17:30:00Z',
  professionalName: 'Barbeiro',
  services: [{ name: 'Corte degradê', price: 35 }],
}

describe('formatAppointmentMessage', () => {
  it('traz os dados reais no padrão brasileiro e no fuso de Fortaleza', () => {
    const text = formatAppointmentMessage(base)

    expect(text).toContain('NOVO AGENDAMENTO — VINICIUS QUEIROZ BARBER')
    expect(text).toContain('Cliente: João Silva')
    expect(text).toContain('Serviço: Corte degradê')
    expect(text).toContain('Profissional: Barbeiro')
    expect(text).toContain('Data: 12/10/2026')
    expect(text).toContain('Horário: 14:30')
    expect(text).toMatch(/Valor: R\$\s35,00/)
    expect(text).toContain('Telefone: (85) 99999-9999')
  })

  it('usa a data local quando o UTC já virou o dia seguinte', () => {
    // 02:00Z de 13/10 ainda é 23:00 de 12/10 em Fortaleza
    const text = formatAppointmentMessage({ ...base, startsAt: '2026-10-13T02:00:00Z' })

    expect(text).toContain('Data: 12/10/2026')
    expect(text).toContain('Horário: 23:00')
  })

  it('soma vários serviços', () => {
    const text = formatAppointmentMessage({
      ...base,
      services: [
        { name: 'Corte', price: 35 },
        { name: 'Barba', price: 25.5 },
      ],
    })

    expect(text).toContain('Serviços: Corte, Barba')
    expect(text).toMatch(/Valor: R\$\s60,50/)
  })

  it('omite campos que o sistema não tem', () => {
    const text = formatAppointmentMessage({
      ...base,
      clientPhone: null,
      professionalName: null,
      services: [{ name: 'Corte', price: null }],
    })

    expect(text).not.toContain('Valor')
    expect(text).not.toContain('Telefone')
    expect(text).not.toContain('Profissional')
  })

  it('não mostra soma parcial quando só alguns serviços têm preço', () => {
    const text = formatAppointmentMessage({
      ...base,
      services: [
        { name: 'Corte', price: 35 },
        { name: 'Barba', price: null },
      ],
    })

    expect(text).not.toContain('Valor')
  })

  it('mantém caracteres especiais do nome como texto simples', () => {
    expect(formatAppointmentMessage({ ...base, clientName: '<b>Zé & _Cia_</b>' })).toContain(
      'Cliente: <b>Zé & _Cia_</b>',
    )
  })
})

describe('formatNotificationMessage', () => {
  it('cancelamento: título, dados do horário cancelado e rodapé próprios', () => {
    const text = formatNotificationMessage('canceled', base)

    expect(text).toContain('AGENDAMENTO CANCELADO — VINICIUS QUEIROZ BARBER')
    expect(text).toContain('Data: 12/10/2026')
    expect(text).toContain('Horário: 14:30')
    expect(text).toContain('O cliente cancelou')
    expect(text).not.toContain('novo agendamento')
  })

  it('alteração: mostra horário anterior e novo no fuso de Fortaleza', () => {
    const text = formatNotificationMessage('rescheduled', base, '2026-10-13T02:00:00Z')

    expect(text).toContain('AGENDAMENTO ALTERADO — VINICIUS QUEIROZ BARBER')
    expect(text).toContain('Antes: 12/10/2026 às 23:00')
    expect(text).toContain('Agora: 12/10/2026 às 14:30')
    expect(text).toContain('O cliente alterou')
  })

  it('alteração sem horário anterior cai no formato simples', () => {
    const text = formatNotificationMessage('rescheduled', base, null)

    expect(text).toContain('Data: 12/10/2026')
    expect(text).not.toContain('Antes')
  })
})
