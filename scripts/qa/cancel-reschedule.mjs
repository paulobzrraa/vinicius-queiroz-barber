// BL-113: cancelamento e reagendamento pelo link único (cancel_appointment/
// reschedule_appointment, BL-078/079). Não cobre o caso "prazo mínimo
// esgotado" (too_late) — para testar isso, baixe temporariamente
// booking_settings.min_cancel_notice_minutes no admin e ajuste este script
// para usar um horário mais próximo.
//
//   node --env-file=.env.local scripts/qa/cancel-reschedule.mjs
import { assert, findAvailableSlot, firstActiveServiceId, supabase } from './_client.mjs'

async function main() {
  const serviceIds = [await firstActiveServiceId()]

  const firstSlot = await findAvailableSlot({ serviceIds })
  assert(firstSlot !== null, 'existe um horário livre para criar o agendamento de teste')

  const { data: appointment, error: createError } = await supabase.rpc('create_appointment', {
    p_client_name: 'QA Cancelamento',
    p_client_phone: '11900000004',
    p_service_ids: serviceIds,
    p_starts_at: firstSlot.startsAt,
  })
  assert(!createError, 'agendamento de teste criado')

  // reagendar: precisa de outro horário livre do MESMO profissional (BL-078 não troca quem atende)
  const secondSlot = await findAvailableSlot({
    serviceIds,
    professionalId: appointment.professional_id,
    daysAhead: 21,
  })

  if (secondSlot && secondSlot.startsAt !== appointment.starts_at) {
    const { data: rescheduled, error: rescheduleError } = await supabase.rpc(
      'reschedule_appointment',
      { p_token: appointment.access_token, p_starts_at: secondSlot.startsAt },
    )
    assert(
      !rescheduleError,
      `reschedule_appointment não deu erro (${rescheduleError?.message ?? 'ok'})`,
    )
    assert(
      rescheduled?.starts_at === secondSlot.startsAt,
      'o horário do agendamento mudou para o novo horário escolhido',
    )
    assert(
      rescheduled?.professional_id === appointment.professional_id,
      'o profissional continua o mesmo depois de reagendar',
    )
  } else {
    console.log(
      '(sem um segundo horário livre do mesmo profissional para testar reagendamento — pulando essa parte)',
    )
  }

  // reagendar para um horário inexistente deve falhar com slot_unavailable
  const bogusDate = new Date(Date.now() + 400 * 86_400_000).toISOString()
  const { error: bogusError } = await supabase.rpc('reschedule_appointment', {
    p_token: appointment.access_token,
    p_starts_at: bogusDate,
  })
  assert(
    bogusError?.code === 'P0001',
    'reagendar para um horário sem vaga falha com slot_unavailable',
  )

  // cancelar
  const { data: canceled, error: cancelError } = await supabase.rpc('cancel_appointment', {
    p_token: appointment.access_token,
  })
  assert(!cancelError, 'cancel_appointment não deu erro')
  assert(canceled?.status === 'canceled', 'o status virou canceled')

  // cancelar de novo é idempotente (não deve dar erro, só devolve o mesmo status)
  const { data: canceledAgain, error: secondCancelError } = await supabase.rpc(
    'cancel_appointment',
    {
      p_token: appointment.access_token,
    },
  )
  assert(!secondCancelError, 'cancelar um agendamento já cancelado não dá erro')
  assert(canceledAgain?.status === 'canceled', 'continua canceled na segunda tentativa')

  // token inválido -> not_found
  const { error: notFoundError } = await supabase.rpc('cancel_appointment', {
    p_token: '00000000-0000-0000-0000-000000000000',
  })
  assert(notFoundError?.code === 'P0002', 'token que não existe falha com not_found')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
