import { describe, expect, it, vi } from 'vitest'

import { processPushNotification, type PushStore, type QueuedPush } from './handler.ts'
import { formatPushMessage, type PushAppointment } from './message.ts'
import { WebPushError, type VapidConfig } from './webpush.ts'

const ID = '11111111-1111-1111-1111-111111111111'
const APPT = '22222222-2222-2222-2222-222222222222'
const VAPID: VapidConfig = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:x@y.test' }

const queued: QueuedPush = { appointmentId: APPT, kind: 'created', status: 'pending' }
const appointment: PushAppointment = {
  clientName: 'Maria Souza',
  startsAt: '2026-10-12T17:30:00Z', // 14:30 em Fortaleza
  status: 'pending',
  serviceNames: ['Corte'],
}
const devices = [
  { id: 'd1', endpoint: 'https://fcm.googleapis.com/fcm/send/a', p256dh: 'p', auth: 'a' },
  { id: 'd2', endpoint: 'https://web.push.apple.com/b', p256dh: 'p', auth: 'a' },
]

function setup(overrides: Partial<PushStore> = {}) {
  const store = {
    getNotification: vi.fn().mockResolvedValue(queued),
    loadAppointment: vi.fn().mockResolvedValue(appointment),
    listActiveDevices: vi.fn().mockResolvedValue(devices),
    markNotification: vi.fn().mockResolvedValue(undefined),
    deactivateDevice: vi.fn().mockResolvedValue(undefined),
    recordDeviceError: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies PushStore
  const send = vi.fn().mockResolvedValue(201)
  const log = vi.fn()
  return { store, send, log, deps: { store, send, getVapid: () => VAPID, log } }
}

describe('formatPushMessage', () => {
  it('novo agendamento: título só o tipo; corpo com cliente e horário em destaque, depois o serviço', () => {
    const message = formatPushMessage('created', appointment)
    expect(message.title).toBe('Novo agendamento')
    expect(message.body).toBe('Maria Souza · 12/10/2026 às 14:30\nServiço: Corte')
  })

  it('cancelamento: título só o tipo; corpo com cliente e horário, sem serviço', () => {
    const message = formatPushMessage('canceled', appointment)
    expect(message.title).toBe('Agendamento cancelado')
    expect(message.body).toBe('Maria Souza · 12/10/2026 às 14:30')
  })

  it('edição: título só o tipo; corpo com cliente, novo horário e serviços', () => {
    const message = formatPushMessage('updated', {
      ...appointment,
      serviceNames: ['Corte', 'Barba'],
    })
    expect(message.title).toBe('Agendamento atualizado')
    expect(message.body).toBe('Maria Souza · 12/10/2026 às 14:30\nServiço: Corte, Barba')
  })

  it('sem serviço cadastrado, não mostra a linha de serviço', () => {
    const message = formatPushMessage('created', { ...appointment, serviceNames: [] })
    expect(message.body).toBe('Maria Souza · 12/10/2026 às 14:30')
  })

  it('não inclui telefone nem valor', () => {
    const message = formatPushMessage('created', appointment)
    expect(JSON.stringify(message)).not.toMatch(/telefone|R\$|\d{4,}-\d{4}/)
  })
})

describe('processPushNotification', () => {
  it('envia para todos os aparelhos ativos e marca como enviado', async () => {
    const { deps, send, store } = setup()

    expect(await processPushNotification(ID, deps)).toBe('sent')

    expect(send).toHaveBeenCalledTimes(2)
    const payload = JSON.parse(send.mock.calls[0][1])
    expect(payload.title).toBe('Novo agendamento')
    expect(payload.url).toBe('/admin/agenda')
    expect(store.markNotification).toHaveBeenCalledWith(ID, 'sent', { devices: 2 })
  })

  it('evento que não foi enfileirado pelo banco não envia nada', async () => {
    const { deps, send } = setup({ getNotification: vi.fn().mockResolvedValue(null) })

    expect(await processPushNotification(ID, deps)).toBe('not_queued')
    expect(send).not.toHaveBeenCalled()
  })

  it('evento já enviado não envia de novo (um evento, uma notificação)', async () => {
    const { deps, send } = setup({
      getNotification: vi.fn().mockResolvedValue({ ...queued, status: 'sent' }),
    })

    expect(await processPushNotification(ID, deps)).toBe('already_sent')
    expect(send).not.toHaveBeenCalled()
  })

  it('agendamento inexistente é ignorado', async () => {
    const { deps, send, store } = setup({ loadAppointment: vi.fn().mockResolvedValue(null) })

    expect(await processPushNotification(ID, deps)).toBe('skipped')
    expect(send).not.toHaveBeenCalled()
    expect(store.markNotification).toHaveBeenCalledWith(ID, 'skipped', {
      error: 'agendamento inexistente',
    })
  })

  it('sem nenhum aparelho ativo, marca como ignorado sem tentar enviar', async () => {
    const { deps, send, store } = setup({ listActiveDevices: vi.fn().mockResolvedValue([]) })

    expect(await processPushNotification(ID, deps)).toBe('skipped')
    expect(send).not.toHaveBeenCalled()
    expect(store.markNotification).toHaveBeenCalledWith(ID, 'skipped', {
      error: 'nenhum aparelho ativo',
    })
  })

  it('aparelho com assinatura expirada (410) é desativado e os outros continuam recebendo', async () => {
    const { deps, send, store } = setup()
    send.mockRejectedValueOnce(new WebPushError('serviço de push recusou (410)', 410))

    expect(await processPushNotification(ID, deps)).toBe('sent')
    expect(store.deactivateDevice).toHaveBeenCalledWith('d1', 'assinatura expirou (410)')
    expect(store.recordDeviceError).not.toHaveBeenCalled()
    expect(store.markNotification).toHaveBeenCalledWith(ID, 'sent', { devices: 1 })
  })

  it('404 também desativa o aparelho', async () => {
    const { deps, send, store } = setup()
    send.mockRejectedValueOnce(new WebPushError('serviço de push recusou (404)', 404))
    await processPushNotification(ID, deps)
    expect(store.deactivateDevice).toHaveBeenCalledWith('d1', 'assinatura expirou (404)')
  })

  it('erro temporário do serviço de push só registra o motivo, sem desativar', async () => {
    const { deps, send, store } = setup()
    send.mockRejectedValueOnce(new WebPushError('serviço de push recusou (503)', 503))

    await processPushNotification(ID, deps)
    expect(store.deactivateDevice).not.toHaveBeenCalled()
    expect(store.recordDeviceError).toHaveBeenCalledWith('d1', 'serviço de push recusou (503)')
  })

  it('se nenhum aparelho recebe, a notificação fica failed (sem tocar no agendamento)', async () => {
    const { deps, store } = setup()
    const send = vi.fn().mockRejectedValue(new WebPushError('falha de rede no envio de push'))

    expect(await processPushNotification(ID, { ...deps, send })).toBe('failed')
    expect(store.markNotification).toHaveBeenCalledWith(ID, 'failed', {
      error: 'nenhum aparelho recebeu o aviso',
    })
    expect(store.loadAppointment).toHaveBeenCalled()
  })

  it('VAPID não configurado vira falha registrada, nunca um envio parcial', async () => {
    const { deps, send, store } = setup()
    const failing = {
      ...deps,
      getVapid: () => {
        throw new Error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT não configurados')
      },
    }

    expect(await processPushNotification(ID, failing)).toBe('failed')
    expect(send).not.toHaveBeenCalled()
    expect(store.markNotification).toHaveBeenCalledWith(ID, 'failed', {
      error: 'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT não configurados',
    })
  })

  it('logs não carregam nome do cliente, endpoint nem chaves', async () => {
    const { deps, send, log } = setup()
    send.mockRejectedValueOnce(new WebPushError('serviço de push recusou (500)', 500))

    await processPushNotification(ID, deps)
    const logged = JSON.stringify(log.mock.calls)
    expect(logged).not.toContain('Maria')
    expect(logged).not.toContain('fcm.googleapis.com')
    expect(logged).not.toContain('"p"')
  })
})
