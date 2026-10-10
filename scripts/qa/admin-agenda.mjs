// BL-114: criar, editar/mover, mudar status, bloquear e cancelar agendamentos
// pelo painel admin (mesmas operações de src/queries/adminAppointments.ts),
// direto contra a tabela — é o que o admin autenticado tem permissão de
// fazer (BL-058/103), sem passar pelas RPCs do fluxo público.
//
// Precisa de um login real de /admin (ver README, "Configurar um projeto do
// zero"). As credenciais NUNCA vão num arquivo — só em variável de ambiente,
// na hora de rodar:
//
//   ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD=senha \
//     node --env-file=.env.local scripts/qa/admin-agenda.mjs
import { assert, firstActiveServiceId, supabase } from './_client.mjs'

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.error(
      'Defina ADMIN_EMAIL e ADMIN_PASSWORD (login do /admin) antes de rodar este script.',
    )
    process.exit(1)
  }

  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
  assert(!loginError, `login como admin funcionou (${loginError?.message ?? 'ok'})`)

  const serviceId = await firstActiveServiceId()
  const { data: professionals, error: professionalsError } = await supabase
    .from('professionals')
    .select('id')
    .eq('active', true)
    .limit(1)
  assert(!professionalsError, 'busca de profissionais não deu erro')
  assert(professionals?.length > 0, 'existe pelo menos um profissional ativo cadastrado')
  const professionalId = professionals[0].id

  // BL-083: criar manualmente (o admin insere direto — não passa por create_appointment)
  const startsAt = new Date(Date.now() + 5 * 86_400_000).toISOString()
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .single()
  const endsAt = new Date(
    new Date(startsAt).getTime() + service.duration_minutes * 60_000,
  ).toISOString()

  const { data: appointment, error: insertError } = await supabase
    .from('appointments')
    .insert({
      client_name: 'QA Admin Agenda',
      client_phone: '11900000005',
      professional_id: professionalId,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'confirmed',
      source: 'admin',
    })
    .select()
    .single()
  assert(!insertError, `agendamento manual criado (${insertError?.message ?? 'ok'})`)

  await supabase
    .from('appointment_services')
    .insert({ appointment_id: appointment.id, service_id: serviceId })

  // BL-081: aparece numa busca por período
  const dayStart = startsAt.slice(0, 10) + 'T00:00:00.000Z'
  const { data: inRange, error: rangeError } = await supabase
    .from('appointments')
    .select('id')
    .gte('starts_at', dayStart)
    .lt('starts_at', new Date(new Date(dayStart).getTime() + 86_400_000).toISOString())
  assert(!rangeError, 'busca por período não deu erro')
  assert(
    inRange?.some((row) => row.id === appointment.id),
    'o agendamento aparece na busca por dia',
  )

  // BL-085: mudar status
  const { error: statusError } = await supabase
    .from('appointments')
    .update({ status: 'completed' })
    .eq('id', appointment.id)
  assert(!statusError, 'mudar o status não deu erro')

  // BL-084: mover para outro horário (mesmo profissional, +1h)
  const movedStart = new Date(new Date(startsAt).getTime() + 3600_000).toISOString()
  const movedEnd = new Date(new Date(endsAt).getTime() + 3600_000).toISOString()
  const { error: moveError } = await supabase
    .from('appointments')
    .update({ starts_at: movedStart, ends_at: movedEnd })
    .eq('id', appointment.id)
  assert(!moveError, 'mover o agendamento não deu erro')

  // BL-086: bloquear um horário (schedule_exceptions, sem cliente)
  const { data: block, error: blockError } = await supabase
    .from('schedule_exceptions')
    .insert({
      professional_id: professionalId,
      starts_at: new Date(Date.now() + 6 * 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 6 * 86_400_000 + 3600_000).toISOString(),
      reason: 'QA bloqueio manual',
    })
    .select()
    .single()
  assert(!blockError, 'criar um bloqueio manual não deu erro')

  // limpeza
  await supabase.from('appointment_services').delete().eq('appointment_id', appointment.id)
  await supabase.from('appointments').delete().eq('id', appointment.id)
  await supabase.from('schedule_exceptions').delete().eq('id', block.id)
  await supabase.auth.signOut()
  console.log('Limpeza concluída.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
