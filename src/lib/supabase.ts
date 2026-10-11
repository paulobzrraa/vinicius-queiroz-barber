import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY precisam estar definidas (ver .env.example).',
  )
}

/**
 * Cliente único do Supabase. A publishable key é segura para o bundle do
 * front-end: leitura é pública (RLS) e escrita exige sessão autenticada.
 */
export const supabase = createClient<Database>(url, publishableKey, {
  // O login social dos clientes usa o outro cliente (clientSupabase); este só
  // faz o login por senha do admin, então não precisa ler sessão da URL.
  auth: { detectSessionInUrl: false },
})

/**
 * Cliente do login social (Google) dos CLIENTES, com sessão guardada em outra
 * chave: nunca se mistura com a sessão do admin (`supabase`). Mesmo estando
 * `authenticated` no Supabase Auth, quem entra por aqui não é admin — admin é
 * só quem está na tabela `admins` (is_admin(), ver supabase/schema.sql).
 */
export const clientSupabase = createClient<Database>(url, publishableKey, {
  auth: { storageKey: 'vinicius-queiroz-barber-client-auth', detectSessionInUrl: true },
})

export const GALLERY_BUCKET = 'gallery'

/**
 * Cache das fotos enviadas (1 ano). O nome de cada arquivo leva um timestamp e nunca é
 * reutilizado, então o conteúdo não muda sob a mesma URL. O padrão do Storage é 1 hora.
 */
export const PHOTO_CACHE_CONTROL = '31536000'
