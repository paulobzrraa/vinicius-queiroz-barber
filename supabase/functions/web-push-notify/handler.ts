import { formatPushMessage, type PushAppointment, type PushKind } from './message.ts'
import {
  sendWebPush,
  WebPushError,
  type PushSubscriptionKeys,
  type VapidConfig,
} from './webpush.ts'

export type PushOutcome = 'sent' | 'already_sent' | 'not_queued' | 'skipped' | 'failed'

export interface QueuedPush {
  appointmentId: string
  kind: PushKind
  status: 'pending' | 'sent' | 'failed' | 'skipped'
}

export interface PushDevice extends PushSubscriptionKeys {
  id: string
}

/** Acesso a dados, injetado para o handler ser testável sem banco. */
export interface PushStore {
  /** Linha de push_notifications; null = não foi enfileirada pelo banco. */
  getNotification(notificationId: string): Promise<QueuedPush | null>
  /** null = agendamento inexistente. */
  loadAppointment(appointmentId: string): Promise<PushAppointment | null>
  /** Só aparelhos ativos de quem ainda é admin. */
  listActiveDevices(): Promise<PushDevice[]>
  markNotification(
    notificationId: string,
    status: 'sent' | 'failed' | 'skipped',
    detail: { devices?: number; error?: string },
  ): Promise<void>
  /** Serviço de push respondeu 404/410: o aparelho não recebe mais envios. */
  deactivateDevice(deviceId: string, reason: string): Promise<void>
  recordDeviceError(deviceId: string, reason: string): Promise<void>
}

export interface PushDeps {
  store: PushStore
  getVapid: () => VapidConfig
  send?: (device: PushSubscriptionKeys, payload: string, vapid: VapidConfig) => Promise<number>
  log?: (event: Record<string, unknown>) => void
}

/**
 * Envia UM evento já enfileirado pelo banco para todos os aparelhos ativos de
 * admin. Só age sobre ids que o banco enfileirou. Logs levam só ids, tipo e
 * motivo: nunca nome do cliente, endpoint ou chaves.
 */
export async function processPushNotification(
  notificationId: string,
  deps: PushDeps,
): Promise<PushOutcome> {
  const { store, log = () => {}, send = sendWebPush } = deps

  const queued = await store.getNotification(notificationId)
  if (queued === null) return 'not_queued'
  if (queued.status === 'sent') return 'already_sent'

  try {
    const appointment = await store.loadAppointment(queued.appointmentId)
    if (!appointment) {
      await store.markNotification(notificationId, 'skipped', { error: 'agendamento inexistente' })
      log({ event: 'push_skipped', notificationId })
      return 'skipped'
    }

    const devices = await store.listActiveDevices()
    if (devices.length === 0) {
      await store.markNotification(notificationId, 'skipped', { error: 'nenhum aparelho ativo' })
      log({ event: 'push_skipped', notificationId, reason: 'no_devices' })
      return 'skipped'
    }

    const message = formatPushMessage(queued.kind, appointment)
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: '/admin/agenda',
    })
    const vapid = deps.getVapid()

    let delivered = 0
    for (const device of devices) {
      try {
        await send(device, payload, vapid)
        delivered++
      } catch (error) {
        const status = error instanceof WebPushError ? error.status : null
        const reason = error instanceof Error ? error.message : 'erro desconhecido'
        if (status === 404 || status === 410) {
          await store.deactivateDevice(device.id, `assinatura expirou (${status})`)
        } else {
          await store.recordDeviceError(device.id, reason)
        }
        log({ event: 'push_device_failed', notificationId, deviceId: device.id, status })
      }
    }

    if (delivered === 0) {
      await store.markNotification(notificationId, 'failed', {
        error: 'nenhum aparelho recebeu o aviso',
      })
      log({ event: 'push_failed', notificationId, kind: queued.kind })
      return 'failed'
    }

    await store.markNotification(notificationId, 'sent', { devices: delivered })
    log({ event: 'push_sent', notificationId, kind: queued.kind, devices: delivered })
    return 'sent'
  } catch (error) {
    // Erro de banco ou de configuração: a notificação fica "failed" com o motivo, sem
    // tocar no agendamento. Quem chama responde 502 para deixar a falha visível nos logs.
    const message = error instanceof Error ? error.message : 'erro inesperado'
    await store.markNotification(notificationId, 'failed', { error: message }).catch(() => {})
    log({ event: 'push_error', notificationId, error: message })
    return 'failed'
  }
}
