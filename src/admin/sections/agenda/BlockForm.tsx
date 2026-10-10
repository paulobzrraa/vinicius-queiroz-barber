import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui'
import { useActiveProfessionals, useSaveScheduleException } from '@/queries/professionals'

import { DateTimeInput, Field, Select, TextInput } from '../../components/Field'

interface BlockFormProps {
  defaultStartsAt: string
  onCreated: () => void
  onCancel: () => void
}

/** BL-086: reserva um intervalo da agenda (almoço, compromisso) sem vincular a um cliente —
 * é uma linha em schedule_exceptions, igual às folgas (BL-090) e feriados (BL-094). */
export function BlockForm({ defaultStartsAt, onCreated, onCancel }: BlockFormProps) {
  const { data: professionals } = useActiveProfessionals()
  const save = useSaveScheduleException(null)

  const [scope, setScope] = useState<'shop' | string>('shop')
  const [startsAt, setStartsAt] = useState(defaultStartsAt)
  const [endsAt, setEndsAt] = useState(defaultStartsAt)
  const [reason, setReason] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    save.mutate(
      {
        professional_id: scope === 'shop' ? null : scope,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        reason: reason || null,
      },
      { onSuccess: onCreated },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-card border border-dashed border-border p-card"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bloquear para">
          <Select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="shop">Toda a barbearia</option>
            {professionals?.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Motivo (opcional)">
          <TextInput
            placeholder="Ex.: Almoço, compromisso"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Início">
          <DateTimeInput
            required
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </Field>
        <Field label="Fim">
          <DateTimeInput
            required
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Bloquear horário'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
