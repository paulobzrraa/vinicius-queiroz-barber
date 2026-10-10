// BL-110: dois clientes tentando o mesmo horário ao mesmo tempo. Confirma que
// a constraint de exclusão (BL-060) + a revalidação em create_appointment
// (BL-073) deixam só um vencer.
//
//   node --env-file=.env.local scripts/qa/concurrency.mjs
//
// Não roda em CI: precisa do schema já aplicado num projeto Supabase real e
// de pelo menos um serviço ativo cadastrado. Cria e cancela um agendamento
// de teste (não deixa lixo no banco).
import { assert, findAvailableSlot, firstActiveServiceId, supabase } from './_client.mjs'

async function createAppointment(clientPhone, startsAt, serviceIds) {
  return supabase.rpc('create_appointment', {
    p_client_name: 'QA Concorrência',
    p_client_phone: clientPhone,
    p_service_ids: serviceIds,
    p_starts_at: startsAt,
  })
}

async function main() {
  const serviceIds = [await firstActiveServiceId()]
  const slot = await findAvailableSlot({ serviceIds })
  assert(slot !== null, 'existe um horário livre nos próximos 14 dias para testar')

  console.log(`Disputando o horário ${slot.startsAt} (profissional ${slot.professionalId})…`)

  const [a, b] = await Promise.all([
    createAppointment('11900000001', slot.startsAt, serviceIds),
    createAppointment('11900000002', slot.startsAt, serviceIds),
  ])

  const results = [a, b]
  const succeeded = results.filter((r) => !r.error)
  const failed = results.filter((r) => r.error)

  assert(succeeded.length === 1, 'exatamente um dos dois pedidos foi criado')
  assert(failed.length === 1, 'exatamente um dos dois pedidos foi rejeitado')

  const rejectionCode = failed[0]?.error?.code
  assert(
    rejectionCode === 'P0001' || rejectionCode === '23P01',
    `a rejeição veio com o motivo esperado (slot_unavailable ou exclusion_violation), veio "${rejectionCode}"`,
  )

  // limpeza: cancela o agendamento criado, usando o próprio token que create_appointment devolveu
  const created = succeeded[0]?.data
  if (created) {
    const { error } = await supabase.rpc('cancel_appointment', { p_token: created.access_token })
    assert(!error, 'agendamento de teste cancelado (limpeza)')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
