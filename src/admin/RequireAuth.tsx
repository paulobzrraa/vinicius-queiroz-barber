import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useSession } from './useSession'

/** Protege as rotas do admin: sem sessão, manda para o login. */
export function RequireAuth() {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted">Carregando…</div>
  }

  // Guarda o destino: um aviso push abre /admin/agenda, e o login volta para lá.
  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}
