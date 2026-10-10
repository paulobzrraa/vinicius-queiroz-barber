import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FaWhatsapp } from 'react-icons/fa6'

import { Button } from '@/components/ui'
import type { AppointmentStatus, PaymentMethod } from '@/lib/database.types'
import {
  type AppointmentWithDetails,
  useDeleteAppointment,
  useMoveAppointment,
  useUpdateAppointmentStatus,
  useUpdatePaymentMethod,
} from '@/queries/adminAppointments'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/queries/finance'
import { useActiveProfessionals } from '@/queries/professionals'
import { useActiveServices } from '@/queries/services'
import { formatPhone, whatsappLink } from '@/utils/phone'

import { DateTimeInput, Select } from '../../components/Field'
import { formatTime, toDatetimeLocalValue } from './dateUtils'
import { confirmDelete } from '../../components/confirmDelete'

const statusLabels: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  canceled: 'Cancelado',
  no_show: 'Não compareceu',
}

const statusOptions = Object.keys(statusLabels) as AppointmentStatus[]

function EditForm({
  appointment,
  onDone,
}: {
  appointment: AppointmentWithDetails
  onDone: () => void
}) {
  const { data: professionals } = useActiveProfessionals()
  const { data: services } = useActiveServices()
  const move = useMoveAppointment()

  const [professionalId, setProfessionalId] = useState(appointment.professional_id)
  const [startsAt, setStartsAt] = useState(toDatetimeLocalValue(appointment.starts_at))
  const [serviceIds, setServiceIds] = useState<string[]>(appointment.serviceIds)

  function toggleService(id: string) {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
    )
  }

  function handleSave() {
    if (serviceIds.length === 0) return
    move.mutate(
      {
        id: appointment.id,
        professionalId,
        startsAt: new Date(startsAt).toISOString(),
        serviceIds,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
          {professionals?.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.name}
            </option>
          ))}
        </Select>
        <DateTimeInput value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
      </div>

      <div className="flex flex-wrap gap-3">
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

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={handleSave} disabled={move.isPending}>
          {move.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      {move.isError && (
        <p className="text-small text-muted">
          Esse profissional já tem um horário que se cruza com esse.
        </p>
      )}
    </div>
  )
}

/** BL-084 (editar/mover) e BL-085 (status) de um agendamento na Agenda do admin. */
export function AppointmentRow({ appointment }: { appointment: AppointmentWithDetails }) {
  const updateStatus = useUpdateAppointmentStatus()
  const updatePaymentMethod = useUpdatePaymentMethod()
  const deleteAppointment = useDeleteAppointment()
  const [editing, setEditing] = useState(false)

  return (
    <li className="rounded-card border border-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-small font-semibold text-foreground">
            {formatTime(appointment.starts_at)} – {formatTime(appointment.ends_at)} ·{' '}
            {appointment.client_name}
          </p>
          <p className="mt-0.5 text-small text-muted">
            {appointment.professionalName} · {formatPhone(appointment.client_phone)}
          </p>
          <p className="mt-0.5 text-caption text-muted">{appointment.serviceNames.join(', ')}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={whatsappLink(appointment.client_phone)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Enviar WhatsApp para ${appointment.client_name}`}
            className="mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] transition-control hover:bg-[#25D366]/15 motion-safe:active:scale-95"
          >
            <FaWhatsapp aria-hidden="true" className="size-5" />
          </a>

          <button
            type="button"
            aria-label="Editar agendamento"
            onClick={() => setEditing((current) => !current)}
            className="text-muted transition-control hover:text-foreground"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </button>

          <button
            type="button"
            aria-label="Remover agendamento"
            onClick={() =>
              confirmDelete('este agendamento') && deleteAppointment.mutate(appointment.id)
            }
            className="text-muted transition-control hover:text-foreground"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {/* Mesma grade em qualquer status: o pagamento só fica ativo após o atendimento, mas o espaço é sempre reservado. */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
        <Select
          value={appointment.status}
          onChange={(event) =>
            updateStatus.mutate({
              id: appointment.id,
              status: event.target.value as AppointmentStatus,
            })
          }
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </Select>

        {/* BL-098: forma de pagamento só faz sentido depois do atendimento — alimenta o módulo financeiro. */}
        <Select
          value={appointment.payment_method ?? ''}
          disabled={appointment.status !== 'completed'}
          className="disabled:opacity-50"
          onChange={(event) =>
            updatePaymentMethod.mutate({
              id: appointment.id,
              paymentMethod: (event.target.value || null) as PaymentMethod | null,
            })
          }
        >
          <option value="">Pagamento</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </Select>
      </div>

      {editing && <EditForm appointment={appointment} onDone={() => setEditing(false)} />}
    </li>
  )
}
