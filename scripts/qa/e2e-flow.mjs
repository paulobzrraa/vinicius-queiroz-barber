// BL-112: serviço -> profissional -> data -> horário -> dados -> confirmação
// -> notificação, exercitando as mesmas RPCs que a UI usa (sem browser —
// isso não substitui abrir /agendar de verdade pelo menos uma vez, só cobre
// a parte que dá para automatizar sem Playwright).
//
//   node --env-file=.env.local scripts/qa/e2e-flow.mjs
import { assert, findAvailableSlot, firstActiveServiceId, supabase } from './_client.mjs'

async function main() {
  const serviceIds = [await firstActiveServiceId()]

  // serviço -> profissional (aqui: "sem preferência", o caminho do BL-061) -> data -> horário
  const slot = await findAvailableSlot({ serviceIds })
  assert(slot !== null, 'existe um horário livre nos próximos 14 dias')

  // dados do cliente -> confirmação (create_appointment revalida tudo de novo, BL-073)
  const { data: appointment, error: createError } = await supabase.rpc('create_appointment', {
    p_client_name: 'QA Fluxo Completo',
    p_client_phone: '11900000003',
    p_service_ids: serviceIds,
    p_starts_at: slot.startsAt,
  })
  assert(!createError, `create_appointment não deu erro (${createError?.message ?? 'ok'})`)
  assert(Boolean(appointment?.access_token), 'o agendamento criado tem um access_token')
  assert(appointment.status === 'pending', 'o status inicial é pending')

  // "notificação": o link único (get_appointment_by_token, BL-058/077) devolve os mesmos dados
  const { data: found, error: findError } = await supabase.rpc('get_appointment_by_token', {
    token: appointment.access_token,
  })
  assert(!findError, 'get_appointment_by_token não deu erro')
  assert(found?.[0]?.id === appointment.id, 'o link único encontra o mesmo agendamento')

  const { data: services, error: servicesError } = await supabase
    .from('appointment_services')
    .select('service_id')
    .eq('appointment_id', appointment.id)
  assert(!servicesError, 'appointment_services não deu erro')
  assert(
    services?.length === serviceIds.length,
    `todos os serviços escolhidos foram gravados (${services?.length}/${serviceIds.length})`,
  )

  // limpeza
  const { error: cancelError } = await supabase.rpc('cancel_appointment', {
    p_token: appointment.access_token,
  })
  assert(!cancelError, 'agendamento de teste cancelado (limpeza)')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
