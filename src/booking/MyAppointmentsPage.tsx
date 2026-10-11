import { ChevronRight } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { GoogleButton } from '@/components/GoogleButton'
import { PasswordInput } from '@/components/PasswordInput'
import { Button, Text } from '@/components/ui'
import {
  AccountLockedError,
  type AccessAppointment,
  InvalidCredentialsError,
  useChangeClientPassword,
  useClientLogin,
} from '@/queries/appointmentAccess'
import { signOutClient, useClientSession, useMyAppointments } from '@/queries/clientAuth'
import { formatWait } from '@/utils/duration'
import { isValidEmail } from '@/utils/email'
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '@/utils/password'
import { loadSavedEmail } from '@/utils/savedEmail'
import { formatDateTimeLabel } from '@/utils/timezone'
import { clearAccessSession, loadAccessSession, saveAccessSession } from './accessSession'
import { BookingLayout } from './BookingLayout'
import { StepShell } from './components/StepShell'

const inputClasses =
  'mt-1 w-full rounded-control border border-border bg-surface px-4 py-3 text-body text-foreground outline-none transition-control focus:border-border-strong'

/** Conta regressiva em segundos até a conta bloqueada liberar. */
function useCountdown() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setTimeout(() => setSeconds((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])

  return { seconds, start: setSeconds }
}

function LoginStep({
  onLoggedIn,
  notice,
}: {
  onLoggedIn: (email: string, appointments: AccessAppointment[]) => void
  notice?: string | null
}) {
  const login = useClientLogin()
  const lock = useCountdown()
  const [email, setEmail] = useState(loadSavedEmail)
  const [password, setPassword] = useState('')
  const trimmed = email.trim().toLowerCase()
  const canSubmit = isValidEmail(trimmed) && password.length > 0

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    login.mutate(
      { email: trimmed, password },
      {
        onSuccess: (appointments) => onLoggedIn(trimmed, appointments),
        onError: (error) => {
          if (error instanceof AccountLockedError) lock.start(error.retryAfterSeconds)
        },
      },
    )
  }

  const isLocked = lock.seconds > 0

  return (
    <StepShell
      align="center"
      title="Meus agendamentos"
      description="Entre com o Google ou com o e-mail e a senha do seu agendamento."
    >
      {notice && (
        <Text size="small" tone="muted" role="status" className="text-center">
          {notice}
        </Text>
      )}

      <GoogleButton returnPath="/meus-agendamentos" />

      <div className="flex items-center gap-3 text-caption text-muted">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className="text-small text-muted">E-mail</span>
          <input
            required
            autoFocus
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClasses}
          />
        </label>

        <label className="block">
          <span className="text-small text-muted">Senha</span>
          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClasses}
          />
        </label>

        <div aria-live="polite" className="text-center">
          {isLocked && (
            <Text size="small" tone="muted">
              Muitas tentativas. Tente de novo em {formatWait(lock.seconds)}.
            </Text>
          )}
          {login.error instanceof InvalidCredentialsError && !isLocked && (
            <Text size="small" tone="muted">
              E-mail ou senha incorretos.
            </Text>
          )}
          {login.isError &&
            !(login.error instanceof InvalidCredentialsError) &&
            !(login.error instanceof AccountLockedError) && (
              <Text size="small" tone="muted">
                Não foi possível entrar. Tente de novo.
              </Text>
            )}
        </div>

        <Button
          type="submit"
          disabled={!canSubmit || login.isPending || isLocked}
          className="self-center"
        >
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <Text size="caption" tone="muted" className="text-center">
        Com e-mail, a conta é criada ao agendar. Esqueceu a senha? Fale com a barbearia.
      </Text>
    </StepShell>
  )
}

function ListStep({
  appointments,
  onLeave,
  onChangePassword,
}: {
  appointments: AccessAppointment[]
  onLeave: () => void
  /** Só para quem entrou com e-mail + senha (quem entrou com Google não tem senha). */
  onChangePassword?: () => void
}) {
  return (
    <StepShell align="center" title="Seus próximos horários">
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <Text size="body" tone="muted">
            Você não tem agendamentos futuros.
          </Text>
          <Button href="/agendar">Reservar um horário</Button>
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {appointments.map((appointment) => (
            <li key={appointment.access_token}>
              <Link
                to={`/agendamento/${appointment.access_token}`}
                // "from" faz o X do detalhe voltar para esta lista (e não para a home).
                state={{ from: 'list' }}
                className="group flex items-center justify-between gap-4 py-4 transition-control"
              >
                <div className="min-w-0">
                  <Text size="body" className="font-semibold capitalize">
                    {formatDateTimeLabel(appointment.starts_at)}
                  </Text>
                  <Text size="small" tone="muted" className="mt-0.5">
                    {appointment.services.join(', ')} · {appointment.professional_name}
                  </Text>
                  {appointment.status === 'pending' && (
                    <Text size="caption" tone="muted" className="mt-0.5">
                      Aguardando confirmação
                    </Text>
                  )}
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted transition-control motion-safe:group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col items-center gap-3 text-center">
        <Text size="caption" tone="muted">
          Toque para ver, reagendar ou cancelar.
        </Text>
        <div className="flex items-center gap-4">
          {onChangePassword && (
            <button type="button" className="text-small link" onClick={onChangePassword}>
              Alterar senha
            </button>
          )}
          <button type="button" className="text-small link" onClick={onLeave}>
            Sair
          </button>
        </div>
      </div>
    </StepShell>
  )
}

function ChangePasswordStep({
  email,
  onDone,
  onCancel,
}: {
  email: string
  onDone: () => void
  onCancel: () => void
}) {
  const change = useChangeClientPassword()
  const lock = useCountdown()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit = current.length > 0 && next.length >= PASSWORD_MIN_LENGTH && next === confirm
  const result = change.data
  const isLocked = lock.seconds > 0

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    change.mutate(
      { email, currentPassword: current, newPassword: next },
      {
        onSuccess: (data) => {
          if (data.status === 'ok') onDone()
          if (data.status === 'locked') lock.start(data.retry_after_seconds)
        },
      },
    )
  }

  function field(
    label: string,
    value: string,
    onChange: (value: string) => void,
    autoComplete: string,
  ) {
    return (
      <label className="block">
        <span className="text-small text-muted">{label}</span>
        <PasswordInput
          required
          autoComplete={autoComplete}
          maxLength={72}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            change.reset()
          }}
          className={inputClasses}
        />
      </label>
    )
  }

  return (
    <StepShell align="center" title="Alterar senha" description={`Conta ${email}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {field('Senha atual', current, setCurrent, 'current-password')}
        {field('Nova senha', next, setNext, 'new-password')}
        <Text size="caption" tone="muted" className="-mt-2 text-center">
          {PASSWORD_HINT}
        </Text>
        {field('Repita a nova senha', confirm, setConfirm, 'new-password')}

        <div aria-live="polite" className="text-center">
          {mismatch && (
            <Text size="small" tone="muted">
              As senhas não são iguais.
            </Text>
          )}
          {result?.status === 'invalid' && (
            <Text size="small" tone="muted">
              Senha atual incorreta.
            </Text>
          )}
          {isLocked && (
            <Text size="small" tone="muted">
              Muitas tentativas. Tente de novo em {formatWait(lock.seconds)}.
            </Text>
          )}
          {result?.status === 'weak' && (
            <Text size="small" tone="muted">
              Senha fraca. {PASSWORD_HINT}
            </Text>
          )}
          {result?.status === 'same' && (
            <Text size="small" tone="muted">
              A nova senha precisa ser diferente da atual.
            </Text>
          )}
          {change.isError && (
            <Text size="small" tone="muted">
              Não foi possível alterar. Tente de novo.
            </Text>
          )}
        </div>

        <Button
          type="submit"
          disabled={!canSubmit || change.isPending || isLocked}
          className="self-center"
        >
          {change.isPending ? 'Salvando…' : 'Alterar senha'}
        </Button>
      </form>

      <div className="text-center">
        <button type="button" className="text-small link" onClick={onCancel}>
          Voltar
        </button>
      </div>
    </StepShell>
  )
}

/**
 * Consulta de agendamentos com conta simples (e-mail + senha). Depois de
 * entrar, a lista fica guardada só nesta aba por 30 minutos (accessSession):
 * abrir um agendamento e voltar, ou recarregar, não pede a senha de novo.
 * "Sair" apaga esse cache.
 */
export function MyAppointmentsPage() {
  const [cached, setCached] = useState(loadAccessSession)
  const [changingPassword, setChangingPassword] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const google = useClientSession()
  const googleAppointments = useMyAppointments(google.verifiedEmail !== null)

  // Volta do Google ou sessão ainda sendo checada: evita piscar a tela de login.
  const checking = google.loading || (google.verifiedEmail !== null && googleAppointments.isLoading)

  // O resultado do Google fica em cache no React Query mesmo depois do logout: só vale com sessão ativa.
  const googleList = google.verifiedEmail ? googleAppointments.data : null
  const appointments = googleList ?? cached?.appointments ?? null
  // Trocar senha só existe para conta de e-mail + senha (não para quem entrou com Google).
  const passwordEmail = googleList ? null : (cached?.email ?? null)

  function leave() {
    clearAccessSession()
    setCached(null)
    setChangingPassword(false)
    queryClient.removeQueries({ queryKey: ['my_appointments'] })
    if (google.session) void signOutClient()
  }

  return (
    <BookingLayout>
      {checking ? (
        <Text size="body" tone="muted" className="text-center">
          Carregando…
        </Text>
      ) : appointments && changingPassword && passwordEmail ? (
        <ChangePasswordStep
          email={passwordEmail}
          onCancel={() => setChangingPassword(false)}
          onDone={() => {
            // Senha trocada: encerra a sessão guardada e pede o login com a nova senha.
            leave()
            setNotice('Senha alterada. Entre com a nova senha.')
          }}
        />
      ) : appointments ? (
        <ListStep
          appointments={appointments}
          onLeave={leave}
          onChangePassword={passwordEmail ? () => setChangingPassword(true) : undefined}
        />
      ) : (
        <LoginStep
          notice={notice}
          onLoggedIn={(email, found) => {
            const next = { email, appointments: found }
            saveAccessSession(next)
            setCached(next)
            setNotice(null)
          }}
        />
      )}
    </BookingLayout>
  )
}
