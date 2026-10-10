import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui'
import { supabase } from '@/lib/supabase'

import { useSession } from './useSession'

/** Tela de login do admin. Um único usuário, criado à mão no painel do Supabase. */
export function AdminLogin() {
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    const to = (location.state as { from?: string } | null)?.from ?? '/admin'
    return <Navigate to={to} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)
    if (signInError) {
      setError('Email ou senha incorretos.')
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-gutter">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="font-display text-title-4">Admin — Vinicius Queiroz Barber</h1>
          <p className="mt-1 text-small text-muted">Entre para editar o conteúdo do site.</p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-small text-muted">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-surface px-4 py-2.5 text-body text-foreground outline-none transition-control focus:border-border-strong"
            />
          </label>

          <label className="block">
            <span className="text-small text-muted">Senha</span>
            <PasswordInput
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-card border border-border bg-surface px-4 py-2.5 text-body text-foreground outline-none transition-control focus:border-border-strong"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-small text-foreground">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
