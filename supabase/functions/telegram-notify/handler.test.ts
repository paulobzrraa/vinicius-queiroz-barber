import { describe, expect, it, vi } from 'vitest'

import { processNotification, type NotificationStore, type QueuedNotification } from './handler.ts'
import type { NotificationAppointment } from './message.ts'

const ID = '11111111-1111-1111-1111-111111111111'
const APPT = '22222222-2222-2222-2222-222222222222'

const queued: QueuedNotification = {
  appointmentId: APPT,
  kind: 'created',
  status: 'pending',
  previousStartsAt: null,
}
const TOKEN = '123:FAKE_TOKEN'

const appointment: NotificationAppointment = {
  clientName: 'Maria Souza',
  clientPhone: '88988887777',
  startsAt: '2026-10-12T17:30:00Z',
  professionalName: 'Barbeiro',
  services: [{ name: 'Corte', price: 40 }],
}

function setup(overrides: Partial<NotificationStore> = {}, fetchResult?: () => Promise<Response>) {
  const store = {
    getNotification: vi.fn().mockResolvedValue(queued),
    loadAppointment: vi.fn().mockResolvedValue(appointment),
    markSent: vi.fn().mockResolvedValue(undefined),
    markError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies NotificationStore
  const fetchImpl = vi
    .fn()
    .mockImplementation(
      fetchResult ?? (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    )
  const log = vi.fn()
  const deps = {
    store,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getConfig: () => ({ token: TOKEN, chatId: '42' }),
    log,
  }
  return { store, fetchImpl, log, deps }
}

describe('processNotification', () => {
  it('envia os dados do agendamento criado e marca como enviado', async () => {
    const { deps, fetchImpl, store } = setup()

    expect(await processNotification(ID, deps)).toBe('sent')

    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(sent.chat_id).toBe('42')
    expect(sent.text).toContain('Maria Souza')
    expect(sent.text).toContain('Corte')
    expect(sent.text).toContain('12/10/2026')
    expect(sent.text).toContain('14:30')
    expect(sent.text).toContain('(88) 98888-7777')
    expect(store.loadAppointment).toHaveBeenCalledWith(APPT)
    expect(store.markSent).toHaveBeenCalledWith(ID)
  })

  it('não notifica agendamento que o trigger não enfileirou (inválido/não gravado)', async () => {
    const { deps, fetchImpl, store } = setup({ getNotification: vi.fn().mockResolvedValue(null) })

    expect(await processNotification(ID, deps)).toBe('not_queued')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(store.markSent).not.toHaveBeenCalled()
  })

  it('não notifica agendamento inexistente', async () => {
    const { deps, fetchImpl } = setup({ loadAppointment: vi.fn().mockResolvedValue(null) })

    expect(await processNotification(ID, deps)).toBe('skipped')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('monta a mensagem de cancelamento', async () => {
    const { deps, fetchImpl } = setup({
      getNotification: vi.fn().mockResolvedValue({ ...queued, kind: 'canceled' }),
    })

    expect(await processNotification(ID, deps)).toBe('sent')
    const { text } = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(text).toContain('AGENDAMENTO CANCELADO')
    expect(text).toContain('Maria Souza')
    expect(text).toContain('cancelou')
  })

  it('monta a mensagem de alteração com horário antes e agora', async () => {
    const { deps, fetchImpl } = setup({
      getNotification: vi.fn().mockResolvedValue({
        ...queued,
        kind: 'rescheduled',
        previousStartsAt: '2026-10-10T12:00:00Z', // 09:00 em Fortaleza
      }),
    })

    expect(await processNotification(ID, deps)).toBe('sent')
    const { text } = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(text).toContain('AGENDAMENTO ALTERADO')
    expect(text).toContain('Antes: 10/10/2026 às 09:00')
    expect(text).toContain('Agora: 12/10/2026 às 14:30')
  })

  it('não reenvia o que já foi enviado', async () => {
    const { deps, fetchImpl } = setup({
      getNotification: vi.fn().mockResolvedValue({ ...queued, status: 'sent' }),
    })

    expect(await processNotification(ID, deps)).toBe('already_sent')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('falha do Telegram não derruba nada: registra o erro e deixa pendente para reenvio', async () => {
    const { deps, store } = setup(
      {},
      async () =>
        new Response(JSON.stringify({ ok: false, error_code: 502, description: 'Bad Gateway' }), {
          status: 502,
        }),
    )

    expect(await processNotification(ID, deps)).toBe('failed')
    expect(store.markError).toHaveBeenCalledWith(ID, expect.stringContaining('502'))
    expect(store.markSent).not.toHaveBeenCalled()
  })

  it('falha de rede é tratada como falha de envio, sem lançar', async () => {
    const { deps, store } = setup({}, async () => {
      throw new TypeError('fetch failed')
    })

    expect(await processNotification(ID, deps)).toBe('failed')
    expect(store.markError).toHaveBeenCalled()
  })

  it('sem token ou chat id configurado, falha de forma registrada e sem chamar a API', async () => {
    const { deps, fetchImpl, store } = setup()
    const getConfig = () => {
      throw Object.assign(new Error('TELEGRAM_BOT_TOKEN não configurado'), {
        name: 'TelegramError',
      })
    }

    expect(await processNotification(ID, { ...deps, getConfig })).toBe('failed')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(store.markError).toHaveBeenCalled()
  })

  it('não coloca nome, telefone nem token nos logs', async () => {
    const failing = setup({}, async () => {
      throw new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`)
    })
    await processNotification(ID, failing.deps)
    const ok = setup()
    await processNotification(ID, ok.deps)

    const logged = JSON.stringify([...failing.log.mock.calls, ...ok.log.mock.calls])
    expect(logged).toContain(ID)
    expect(logged).not.toContain('Maria')
    expect(logged).not.toContain('98888')
    expect(logged).not.toContain('FAKE_TOKEN')
  })
})
