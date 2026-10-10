import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui'
import { useCreateManualAppointment } from '@/queries/adminAppointments'
import { useActiveProfessionals } from '@/queries/professionals'
import { useActiveServices } from '@/queries/services'
import { maskPhoneInput, onlyPhoneDigits } from '@/utils/phone'

import { DateTimeInput, Field, Select, TextInput } from '../../components/Field'

interface AppointmentFormProps {
  defaultStartsAt: string
  onCreated: () => void
  onCancel: () => void
}

/** BL-083: agendamento manual (cliente que ligou ou chegou sem agendar online). */
export function AppointmentForm({ defaultStartsAt, onCreated, onCancel }: AppointmentFormProps) {
  const { data: professionals } = useActiveProfessionals()
  const { data: services } = useActiveServices()
  const create = useCreateManualAppointment()

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [startsAt, setStartsAt] = useState(defaultStartsAt)

  function toggleService(id: string) {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!professionalId || serviceIds.length === 0) return

    create.mutate(
      {
        clientName,
        clientPhone: onlyPhoneDigits(clientPhone),
        professionalId,
        serviceIds,
        startsAt: new Date(startsAt).toISOString(),
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
        <Field label="Cliente">
          <TextInput
            required
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
          />
        </Field>
        <Field label="Telefone">
          <TextInput
            required
            value={clientPhone}
            onChange={(event) => setClientPhone(maskPhoneInput(event.target.value))}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profissional">
          <Select
            required
            value={professionalId}
            onChange={(event) => setProfessionalId(event.target.value)}
          >
            <option value="" disabled>
              Selecione
            </option>
            {professionals?.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data e horário">
          <DateTimeInput
            required
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Serviços">
        <div className="mt-1 flex flex-wrap gap-3">
          {services?.map((service) => (
            <label key={service.id} className="flex items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={serviceIds.includes(service.id)}
                onChange={() => toggleService(service.id)}
              />
              {service.name}
            </label>
          ))}
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? 'Salvando…' : 'Criar agendamento'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {create.isError && (
        <p className="text-small text-muted">
          Não foi possível criar — esse profissional já tem um horário que se cruza com esse.
        </p>
      )}
    </form>
  )
}
