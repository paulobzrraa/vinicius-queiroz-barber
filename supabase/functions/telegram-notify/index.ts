// Edge Function do Supabase (Deno). Chamada só pelo trigger do banco via pg_net
// (supabase/schema.sql, seção "Notificação de novo agendamento por Telegram").
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase injeta sozinho).
import { createClient } from 'npm:@supabase/supabase-js@2'

import { processNotification, type NotificationStore } from './handler.ts'
import type { NotificationAppointment } from './message.ts'
import { loadTelegramConfig } from './telegram.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

const store: NotificationStore = {
  async getNotification(notificationId) {
    const { data, error } = await supabase
      .from('telegram_notifications')
      .select('appointment_id, kind, status, previous_starts_at')
      .eq('id', notificationId)
      .maybeSingle()
    if (error) throw new Error('falha ao ler telegram_notifications')
    if (!data) return null
    return {
      appointmentId: data.appointment_id,
      kind: data.kind,
      status: data.status,
      previousStartsAt: data.previous_starts_at,
    }
  },

  async loadAppointment(appointmentId) {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        'client_name, client_phone, starts_at, professionals(name), appointment_services(price, services(name))',
      )
      .eq('id', appointmentId)
      .maybeSingle()
    if (error) throw new Error('falha ao ler o agendamento')
    if (!data) return null

    const professional = data.professionals as { name: string } | null
    const services = (data.appointment_services ?? []) as {
      price: number | null
      services: { name: string } | null
    }[]

    return {
      clientName: data.client_name,
      clientPhone: data.client_phone,
      startsAt: data.starts_at,
      professionalName: professional?.name ?? null,
      services: services.flatMap((row) =>
        row.services ? [{ name: row.services.name, price: row.price }] : [],
      ),
    } satisfies NotificationAppointment
  },

  async markSent(notificationId) {
    await supabase
      .from('telegram_notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
      .eq('id', notificationId)
  },

  async markError(notificationId, error) {
    await supabase
      .from('telegram_notifications')
      .update({ last_error: error })
      .eq('id', notificationId)
  },
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  const provided = request.headers.get('x-webhook-secret') ?? ''
  if (request.method !== 'POST' || !secret || !safeEqual(provided, secret)) {
    return new Response('unauthorized', { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const notificationId = body?.notification_id
  if (typeof notificationId !== 'string' || !UUID.test(notificationId)) {
    return new Response('bad request', { status: 400 })
  }

  const outcome = await processNotification(notificationId, {
    store,
    getConfig: () => loadTelegramConfig(Deno.env.toObject()),
    log: (event) => console.log(JSON.stringify(event)),
  }).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'telegram_error',
        notificationId,
        error: error instanceof Error ? error.message : 'erro desconhecido',
      }),
    )
    return 'failed' as const
  })

  // 5xx deixa a falha visível em net._http_response; o reenvio vem do pg_cron.
  return new Response(outcome, { status: outcome === 'failed' ? 502 : 200 })
})
