import {
  formatNotificationMessage,
  type NotificationAppointment,
  type NotificationKind,
} from './message.ts'
import { sendTelegramMessage, TelegramError, type TelegramConfig } from './telegram.ts'

export type NotifyOutcome = 'sent' | 'already_sent' | 'not_queued' | 'skipped' | 'failed'

export interface QueuedNotification {
  appointmentId: string
  kind: NotificationKind
  status: 'pending' | 'sent' | 'failed'
  previousStartsAt: string | null
}

/** Acesso a dados, injetado para o handler ser testável sem banco. */
export interface NotificationStore {
  /** Linha de telegram_notifications; null = não foi enfileirada pelo banco. */
  getNotification(notificationId: string): Promise<QueuedNotification | null>
  /** null = agendamento inexistente. */
  loadAppointment(appointmentId: string): Promise<NotificationAppointment | null>
  markSent(notificationId: string): Promise<void>
  markError(notificationId: string, error: string): Promise<void>
}

export interface NotifyDeps {
  store: NotificationStore
  getConfig: () => TelegramConfig
  fetchImpl?: typeof fetch
  timeoutMs?: number
  log?: (event: Record<string, unknown>) => void
}

/**
 * Processa UMA notificação já enfileirada pelo banco (criado/cancelado/alterado).
 * Só age sobre ids que o banco enfileirou, então um id inventado não gera
 * mensagem. Os logs levam só ids e o motivo do erro: nunca nome, telefone ou token.
 */
export async function processNotification(
  notificationId: string,
  deps: NotifyDeps,
): Promise<NotifyOutcome> {
  const { store, log = () => {} } = deps

  const notification = await store.getNotification(notificationId)
  if (notification === null) return 'not_queued'
  if (notification.status === 'sent') return 'already_sent'

  try {
    const appointment = await store.loadAppointment(notification.appointmentId)
    if (!appointment) {
      await store.markError(notificationId, 'agendamento inexistente')
      log({ event: 'telegram_skipped', notificationId })
      return 'skipped'
    }

    await sendTelegramMessage(
      deps.getConfig(),
      formatNotificationMessage(notification.kind, appointment, notification.previousStartsAt),
      { fetchImpl: deps.fetchImpl, timeoutMs: deps.timeoutMs },
    )
  } catch (error) {
    const message =
      error instanceof TelegramError ? error.message : 'erro inesperado ao montar/enviar'
    const kind = error instanceof TelegramError ? error.kind : 'unexpected'
    await store.markError(notificationId, message)
    log({ event: 'telegram_failed', notificationId, kind, error: message })
    return 'failed'
  }

  // Se este update falhar, a notificação continua "pending" e o reenvio pode duplicar a
  // mensagem: preferimos isso a perder o aviso (entrega "pelo menos uma vez").
  await store.markSent(notificationId)
  log({ event: 'telegram_sent', notificationId, kind: notification.kind })
  return 'sent'
}
