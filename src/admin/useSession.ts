import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

interface SessionState {
  session: Session | null
  /** true só durante a checagem inicial da sessão. */
  loading: boolean
}

/** Sessão de autenticação atual, atualizada em tempo real (login, logout, expiração). */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  return state
}
