import { X } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { GoogleButton } from '@/components/GoogleButton'
import { PasswordInput } from '@/components/PasswordInput'
import { Button, Text } from '@/components/ui'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCheckClientCredentials, useClientAccountExists } from '@/queries/appointmentAccess'
import { signOutClient, useClientSession } from '@/queries/clientAuth'
import { formatWait } from '@/utils/duration'
import { isValidEmail } from '@/utils/email'
import { clearSavedEmail, loadSavedEmail } from '@/utils/savedEmail'
import { PASSWORD_HINT } from '@/utils/password'
import { maskPhoneInput, onlyPhoneDigits } from '@/utils/phone'
import { StepShell } from '../components/StepShell'

interface ClientStepProps {
  clientName: string
  clientPhone: string
  clientEmail: string
  clientPassword: string
  onSubmit: (values: {
    clientName: string
    clientPhone: string
    clientEmail: string
    clientPassword: string
    honeypot: string
  }) => void
}

const inputClasses =
  'mt-1 w-full rounded-control border border-border bg-surface px-4 py-3 text-body text-foreground outline-none transition-control focus:border-border-strong'

/** BL-070: nome e telefone, para o profissional saber quem chega e para o link de confirmação (BL-077). */
export function ClientStep({
  clientName,
  clientPhone,
  clientEmail,
  clientPassword,
  onSubmit,
}: ClientStepProps) {
  // null = o cliente ainda não digitou: mostra o nome que o Google informou, se houver.
  const [typedName, setTypedName] = useState<string | null>(clientName || null)
  const [phone, setPhone] = useState(clientPhone ? maskPhoneInput(clientPhone) : '')
  const [email, setEmail] = useState(() => clientEmail || loadSavedEmail())
  const [password, setPassword] = useState(clientPassword)
  const [honeypot, setHoneypot] = useState('')
  const check = useCheckClientCredentials()
  const google = useClientSession()
  // Entrou com Google: o e-mail já foi provado pelo provedor, sem senha nem conta.
  const verifiedEmail = google.verifiedEmail

  const name = typedName ?? google.name ?? ''

  const digits = onlyPhoneDigits(phone)
  const trimmedEmail = verifiedEmail ?? email.trim()
  // O e-mail é opcional, mas se vier preenchido precisa ser válido.
  const isEmailValid = trimmedEmail === '' || isValidEmail(trimmedEmail)
  // Consulta se o e-mail já tem conta (com uma pausa depois da digitação): quem já tem
  // não precisa de senha; quem não tem cria uma agora.
  const lookupEmail =
    !verifiedEmail && trimmedEmail !== '' && isEmailValid ? trimmedEmail.toLowerCase() : ''
  const debouncedEmail = useDebouncedValue(lookupEmail, 400)
  const account = useClientAccountExists(debouncedEmail)
  const lookupSettled =
    lookupEmail === '' ||
    (debouncedEmail === lookupEmail &&
      !account.isFetching &&
      (account.isSuccess || account.isError))
  const isRegistered = lookupEmail !== '' && lookupSettled && account.data === true
  // Se a consulta falhar, trata como conta nova e pede a senha (o banco confere de qualquer forma).
  const needsPassword = lookupEmail !== '' && lookupSettled && !isRegistered
  // O tamanho mínimo de senha NOVA é checado no banco (check_client_credentials), porque contas
  // antigas podem ter senhas menores; aqui só exige que algo tenha sido digitado.
  const isPasswordValid = !needsPassword || (password.length >= 1 && password.length <= 72)
  const isValid =
    name.trim().length > 1 &&
    digits.length === 11 &&
    isEmailValid &&
    lookupSettled &&
    isPasswordValid

  function submit() {
    onSubmit({
      clientName: name.trim(),
      clientPhone: digits,
      clientEmail: trimmedEmail.toLowerCase(),
      clientPassword: needsPassword ? password : '',
      honeypot,
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid) return

    if (!needsPassword) {
      submit()
      return
    }

    // E-mail sem conta: confere a senha nova agora (tamanho e senhas óbvias) antes de
    // seguir; o agendamento cria a conta. Se a conta surgiu nesse meio-tempo ("valid"/
    // "invalid"), o banco confere a senha dela.
    check.mutate(
      { email: trimmedEmail.toLowerCase(), password },
      { onSuccess: (result) => (result.status === 'new' || result.status === 'valid') && submit() },
    )
  }

  return (
    <StepShell title="Seus dados">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!verifiedEmail && (
          <>
            <GoogleButton returnPath="/agendar" />
            <div className="flex items-center gap-3 text-caption text-muted">
              <span className="h-px flex-1 bg-border" />
              ou preencha
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <label className="block">
          <span className="text-small text-muted">Nome</span>
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setTypedName(event.target.value)}
            className={inputClasses}
          />
        </label>

        <label className="block">
          <span className="text-small text-muted">WhatsApp</span>
          <input
            required
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(88) 99999-9999"
            value={phone}
            onChange={(event) => setPhone(maskPhoneInput(event.target.value))}
            className={inputClasses}
          />
          <Text size="caption" tone="muted" className="mt-1.5">
            Usado só para confirmar seu horário.
          </Text>
        </label>

        {verifiedEmail ? (
          <div>
            <span className="text-small text-muted">E-mail</span>
            <div className="mt-1 flex items-center justify-between gap-3 rounded-control border border-border bg-surface py-1 ps-4 pe-1.5">
              <span className="min-w-0 truncate text-body">{verifiedEmail}</span>
              <button
                type="button"
                onClick={() => void signOutClient()}
                className="shrink-0 rounded-control px-3 py-2 text-small text-muted transition-control hover:text-foreground"
              >
                Trocar
              </button>
            </div>
            <Text size="caption" tone="muted" className="mt-1.5">
              Sem senha: seus agendamentos aparecem em Meus agendamentos ao entrar com o Google.
            </Text>
          </div>
        ) : (
          <label className="block">
            <span className="text-small text-muted">E-mail (opcional)</span>
            <div className="relative">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  check.reset()
                }}
                aria-invalid={!isEmailValid}
                className={`${inputClasses} ${email ? 'pe-12' : ''}`}
              />
              {email && (
                <button
                  type="button"
                  aria-label="Limpar e-mail"
                  onClick={() => {
                    setEmail('')
                    clearSavedEmail()
                  }}
                  className="absolute end-1.5 top-1/2 mt-0.5 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-control hover:text-foreground"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
            <Text size="caption" tone="muted" className="mt-1.5">
              {isEmailValid
                ? 'Para consultar seus agendamentos depois.'
                : 'E-mail inválido. Confira ou deixe em branco.'}
            </Text>
          </label>
        )}

        {needsPassword && (
          <label className="block">
            <span className="text-small text-muted">Senha</span>
            <PasswordInput
              required
              autoComplete="current-password"
              maxLength={72}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                check.reset()
              }}
              className={inputClasses}
            />
            <Text size="caption" tone="muted" className="mt-1.5">
              Crie uma senha para sua conta. {PASSWORD_HINT}
            </Text>
          </label>
        )}

        {/* BL-104: campo isca. Some visualmente e do fluxo de tab de quem usa mouse/teclado,
            mas continua no DOM — bots que preenchem todo formulário caem aqui. */}
        <label className="absolute -left-full opacity-0" aria-hidden="true">
          Não preencha este campo
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </label>

        <div aria-live="polite">
          {check.data?.status === 'invalid' && (
            <Text size="small" tone="muted">
              Senha incorreta para esse e-mail. Confira, ou deixe o e-mail em branco.
            </Text>
          )}
          {check.data?.status === 'weak' && (
            <Text size="small" tone="muted">
              Senha fraca. {PASSWORD_HINT}
            </Text>
          )}
          {check.data?.status === 'locked' && (
            <Text size="small" tone="muted">
              Muitas tentativas. Tente de novo em {formatWait(check.data.retry_after_seconds)}.
            </Text>
          )}
          {check.isError && (
            <Text size="small" tone="muted">
              Não foi possível verificar. Tente de novo.
            </Text>
          )}
        </div>

        <Button type="submit" disabled={!isValid || check.isPending} className="self-end">
          {check.isPending ? 'Verificando…' : 'Continuar'}
        </Button>
      </form>
    </StepShell>
  )
}
