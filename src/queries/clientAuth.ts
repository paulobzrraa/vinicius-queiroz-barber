import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { clientSupabase } from '@/lib/supabase'
import type { AccessAppointment } from './appointmentAccess'

interface ClientSessionState {
  session: Session | null
  /** true só durante a checagem inicial (inclui a volta do redirecionamento do Google). */
  loading: boolean
  /** E-mail do Google, só quando o provedor o confirmou. */
  verifiedEmail: string | null
  /** Nome que o Google informou, para pré-preencher o formulário. */
  name: string | null
}

/** Sessão do login social do cliente, atualizada em tempo real (login, logout, expiração). */
export function useClientSession(): ClientSessionState {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({
    session: null,
    loading: true,
  })

  useEffect(() => {
    clientSupabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })

    const { data: subscription } = clientSupabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const user = state.session?.user
  const metadata = user?.user_metadata as { full_name?: string; name?: string } | undefined

  return {
    ...state,
    verifiedEmail: user?.email && user.email_confirmed_at ? user.email.toLowerCase() : null,
    name: metadata?.full_name ?? metadata?.name ?? null,
  }
}

/** Abre o login do Google e volta para `returnPath` já logado. */
export async function signInWithGoogle(returnPath: string) {
  const { error } = await clientSupabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${returnPath}` },
  })
  if (error) throw error
}

export async function signOutClient() {
  await clientSupabase.auth.signOut()
}

/**
 * Próximos agendamentos de quem entrou com Google, pelo e-mail confirmado
 * (my_appointments no banco). `null` = sem sessão válida.
 */
export function useMyAppointments(enabled: boolean) {
  return useQuery({
    queryKey: ['my_appointments'],
    queryFn: async (): Promise<AccessAppointment[] | null> => {
      const { data, error } = await clientSupabase.rpc('my_appointments')
      if (error) throw error
      return data.ok ? data.appointments : null
    },
    enabled,
  })
}
