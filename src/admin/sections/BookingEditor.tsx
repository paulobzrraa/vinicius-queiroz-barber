import { type FormEvent, useState } from 'react'

import { Button, Text } from '@/components/ui'
import type { Database } from '@/lib/database.types'
import {
  useAnonymizeOldAppointments,
  useEraseClientData,
  useResetClientPassword,
} from '@/queries/adminAppointments'
import { useBookingSettings, useUpdateBookingSettings } from '@/queries/booking'
import { onlyPhoneDigits } from '@/utils/phone'

import { Field, TextInput } from '../components/Field'
import { confirmDelete } from '../components/confirmDelete'

type BookingSettings = Database['public']['Tables']['booking_settings']['Row']

function PolicyForm({ booking }: { booking: BookingSettings }) {
  const update = useUpdateBookingSettings()
  const [form, setForm] = useState({
    minAdvanceMinutes: String(booking.min_advance_minutes),
    maxAdvanceDays: String(booking.max_advance_days),
    minCancelNoticeMinutes: String(booking.min_cancel_notice_minutes),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    update.mutate({
      min_advance_minutes: Number(form.minAdvanceMinutes),
      max_advance_days: Number(form.maxAdvanceDays),
      min_cancel_notice_minutes: Number(form.minCancelNoticeMinutes),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Antecedência mínima (minutos)" hint="Não deixa agendar em cima da hora.">
          <TextInput
            required
            type="number"
            min={0}
            value={form.minAdvanceMinutes}
            onChange={(event) => setForm({ ...form, minAdvanceMinutes: event.target.value })}
          />
        </Field>
        <Field label="Antecedência máxima (dias)" hint="Até quando dá para agendar no futuro.">
          <TextInput
            required
            type="number"
            min={1}
            value={form.maxAdvanceDays}
            onChange={(event) => setForm({ ...form, maxAdvanceDays: event.target.value })}
          />
        </Field>
      </div>

      <Field
        label="Prazo mínimo para cancelar/reagendar (minutos)"
        hint="Depois desse prazo, o link único do cliente não permite mais mudar o horário."
      >
        <TextInput
          required
          type="number"
          min={0}
          className="max-w-40"
          value={form.minCancelNoticeMinutes}
          onChange={(event) => setForm({ ...form, minCancelNoticeMinutes: event.target.value })}
        />
      </Field>

      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
      {update.isSuccess && <span className="ms-3 text-small text-muted">Salvo.</span>}
    </form>
  )
}

function ResetPasswordForm() {
  const reset = useResetClientPassword()
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    reset.mutate(
      { email: email.trim(), newPassword },
      { onSuccess: (count) => count > 0 && setNewPassword('') },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <Text size="small" tone="muted">
        Cliente esqueceu a senha de &quot;Meus agendamentos&quot;? Defina uma senha nova (mínimo de
        8 caracteres) e passe para ele, por exemplo pelo WhatsApp. Isso também desbloqueia a conta.
      </Text>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="E-mail do cliente">
          <TextInput
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Nova senha">
          <TextInput
            required
            minLength={8}
            maxLength={72}
            autoComplete="off"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </Field>
      </div>
      <Button type="submit" disabled={reset.isPending}>
        {reset.isPending ? 'Salvando…' : 'Redefinir senha'}
      </Button>
      {reset.isSuccess && (
        <span className="ms-3 text-small text-muted">
          {reset.data > 0 ? 'Senha redefinida.' : 'Nenhuma conta com esse e-mail.'}
        </span>
      )}
      {reset.isError && (
        <span className="ms-3 text-small text-muted">Não foi possível redefinir.</span>
      )}
    </form>
  )
}

function PrivacyForm() {
  const anonymize = useAnonymizeOldAppointments()
  const erase = useEraseClientData()
  const [olderThanDays, setOlderThanDays] = useState('730')
  const [erasePhone, setErasePhone] = useState('')

  return (
    <div className="max-w-xl space-y-8">
      <div className="space-y-3">
        <Text size="small" tone="muted">
          Remove nome e telefone dos agendamentos mais antigos que o prazo abaixo (fica só o
          registro do horário, sem dado pessoal). Não roda sozinho — acione quando quiser.
        </Text>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Prazo (dias)">
            <TextInput
              type="number"
              min={1}
              className="w-32"
              value={olderThanDays}
              onChange={(event) => setOlderThanDays(event.target.value)}
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={anonymize.isPending}
            onClick={() =>
              window.confirm(
                `Anonimizar os agendamentos com mais de ${olderThanDays} dias? Esta ação não pode ser desfeita.`,
              ) && anonymize.mutate(Number(olderThanDays))
            }
          >
            {anonymize.isPending ? 'Processando…' : 'Anonimizar agendamentos antigos'}
          </Button>
        </div>
        {anonymize.isSuccess && (
          <Text size="small" tone="muted">
            {anonymize.data} agendamento(s) anonimizado(s).
          </Text>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <Text size="small" tone="muted">
          Cliente pediu a remoção dos próprios dados (LGPD)? Digite o telefone cadastrado.
        </Text>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Telefone do cliente">
            <TextInput
              value={erasePhone}
              onChange={(event) => setErasePhone(event.target.value)}
              className="w-48"
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={erase.isPending || !erasePhone}
            onClick={() =>
              confirmDelete('os dados deste cliente') &&
              erase.mutate(onlyPhoneDigits(erasePhone), { onSuccess: () => setErasePhone('') })
            }
          >
            {erase.isPending ? 'Removendo…' : 'Remover dados deste cliente'}
          </Button>
        </div>
        {erase.isSuccess && (
          <Text size="small" tone="muted">
            {erase.data} agendamento(s) atualizado(s).
          </Text>
        )}
      </div>
    </div>
  )
}

export function BookingEditor() {
  const { data: booking } = useBookingSettings()
  if (!booking) return null

  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-display text-title-4">Política de agendamento</h2>
        <div className="mt-5">
          <PolicyForm booking={booking} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-title-4">Senha de cliente</h2>
        <div className="mt-5">
          <ResetPasswordForm />
        </div>
      </section>

      <section>
        <h2 className="font-display text-title-4">Privacidade e retenção de dados</h2>
        <div className="mt-5">
          <PrivacyForm />
        </div>
      </section>
    </div>
  )
}
