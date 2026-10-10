// Edge Function do Supabase (Deno). Chamada só pelo trigger do banco via pg_net
// (supabase/schema.sql, seção "Notificações push para o admin").
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WEB_PUSH_WEBHOOK_SECRET
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase injeta sozinho).
import { createClient } from 'npm:@supabase/supabase-js@2'

import { processPushNotification, type PushStore } from './handler.ts'
import type { PushAppointment, PushKind } from './message.ts'
import type { VapidConfig } from './webpush.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false },
  },
)

const store: PushStore = {
  async getNotification(notificationId) {
    const { data, error } = await supabase
      .from('push_notifications')
      .select('appointment_id, kind, status')
      .eq('id', notificationId)
      .maybeSingle()
    if (error) throw new Error('falha ao ler push_notifications')
    if (!data) return null
    return {
      appointmentId: data.appointment_id,
      kind: data.kind as PushKind,
      status: data.status,
    }
  },

  async loadAppointment(appointmentId) {
    const { data, error } = await supabase
      .from('appointments')
      .select('client_name, starts_at, status, appointment_services(services(name))')
      .eq('id', appointmentId)
      .maybeSingle()
    if (error) throw new Error('falha ao ler o agendamento')
    if (!data) return null

    const rows = (data.appointment_services ?? []) as { services: { name: string } | null }[]
    return {
      clientName: data.client_name,
      startsAt: data.starts_at,
      status: data.status,
      serviceNames: rows.flatMap((row) => (row.services ? [row.services.name] : [])),
    } satisfies PushAppointment
  },

  async listActiveDevices() {
    // Só admins: se alguém deixar de ser admin, os aparelhos dele param de receber.
    const { data: admins, error: adminsError } = await supabase.from('admins').select('user_id')
    if (adminsError) throw new Error('falha ao ler admins')
    const userIds = (admins ?? []).map((row) => row.user_id)
    if (userIds.length === 0) return []

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth_secret')
      .eq('active', true)
      .in('user_id', userIds)
    if (error) throw new Error('falha ao ler push_subscriptions')
    return (data ?? []).map((row) => ({
      id: row.id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth_secret,
    }))
  },

  async markNotification(notificationId, status, detail) {
    await supabase
      .from('push_notifications')
      .update({
        status,
        devices: detail.devices ?? 0,
        last_error: detail.error ?? null,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', notificationId)
  },

  async deactivateDevice(deviceId, reason) {
    await supabase
      .from('push_subscriptions')
      .update({ active: false, last_error: reason })
      .eq('id', deviceId)
  },

  async recordDeviceError(deviceId, reason) {
    await supabase.from('push_subscriptions').update({ last_error: reason }).eq('id', deviceId)
  },
}

function loadVapid(): VapidConfig {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.trim()
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.trim()
  const subject = Deno.env.get('VAPID_SUBJECT')?.trim()
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT não configurados')
  }
  return { publicKey, privateKey, subject }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (request) => {
  const secret = Deno.env.get('WEB_PUSH_WEBHOOK_SECRET')
  const provided = request.headers.get('x-webhook-secret') ?? ''
  if (request.method !== 'POST' || !secret || !safeEqual(provided, secret)) {
    return new Response('unauthorized', { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const notificationId = body?.notification_id
  if (typeof notificationId !== 'string' || !UUID.test(notificationId)) {
    return new Response('bad request', { status: 400 })
  }

  const outcome = await processPushNotification(notificationId, {
    store,
    getVapid: loadVapid,
    log: (event) => console.log(JSON.stringify(event)),
  }).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'push_error',
        notificationId,
        error: error instanceof Error ? error.message : 'erro desconhecido',
      }),
    )
    return 'failed' as const
  })

  // 502 deixa a falha visível em net._http_response; a fila já marcou "failed".
  return new Response(outcome, { status: outcome === 'failed' ? 502 : 200 })
})
