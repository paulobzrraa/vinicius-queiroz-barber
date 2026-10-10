import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error(
    'Faltam VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY. Rode com o env do projeto de TESTE:\n' +
      '  node --env-file=.env.development.local scripts/qa/<script>.mjs',
  )
  process.exit(1)
}

// Estes scripts criam, cancelam e reagendam agendamentos de verdade: só rodam
// contra o projeto de teste (VITE_APP_ENV=test), nunca contra produção.
if (process.env.VITE_APP_ENV !== 'test') {
  console.error(
    'Recusado: estes scripts gravam dados e só rodam no projeto de teste.\n' +
      'Configure .env.development.local (ver README, "Ambiente de teste") com VITE_APP_ENV=test.',
  )
  process.exit(1)
}

export const supabase = createClient(url, key)

export function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`)
    process.exitCode = 1
    throw new Error(message)
  }
  console.log(`✓ ${message}`)
}

/** Um horário livre de verdade, hoje, para os serviços/profissional pedidos (ou null se não achar em 14 dias). */
export async function findAvailableSlot({ serviceIds, professionalId = null, daysAhead = 14 }) {
  const today = new Date().toISOString().slice(0, 10)
  const end = new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10)

  const { data: dates, error: datesError } = await supabase.rpc('get_available_dates', {
    p_service_ids: serviceIds,
    p_start_date: today,
    p_end_date: end,
    p_professional_id: professionalId,
  })
  if (datesError) throw datesError
  if (!dates?.length) return null

  const { data: slots, error: slotsError } = await supabase.rpc('get_available_slots', {
    p_service_ids: serviceIds,
    p_date: dates[0].available_date,
    p_professional_id: professionalId,
  })
  if (slotsError) throw slotsError
  return slots?.[0] ?? null
}

/** Primeiro serviço ativo cadastrado — os scripts usam o que já estiver no banco, não inventam dado. */
export async function firstActiveServiceId() {
  const { data, error } = await supabase.from('services').select('id').eq('active', true).limit(1)
  if (error) throw error
  if (!data?.length) {
    console.error(
      'Nenhum serviço ativo cadastrado — cadastre um em /admin antes de rodar os scripts de QA.',
    )
    process.exit(1)
  }
  return data[0].id
}
