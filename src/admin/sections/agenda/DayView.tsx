import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Button, IconButton, Text } from '@/components/ui'
import type { AppointmentStatus } from '@/lib/database.types'
import { useAppointmentsInRange } from '@/queries/adminAppointments'
import { useActiveProfessionals } from '@/queries/professionals'

import { Select, TextInput } from '../../components/Field'
import { AppointmentForm } from './AppointmentForm'
import { AppointmentRow } from './AppointmentRow'
import { BlockForm } from './BlockForm'
import { addDays, dayRangeIso, formatDateLabel, todayKey } from './dateUtils'

const statusLabels: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  canceled: 'Cancelado',
  no_show: 'Não compareceu',
}

interface DayViewProps {
  dateKey: string
  onDateChange: (dateKey: string) => void
}

/** BL-081 (agenda do dia por profissional) e BL-087 (busca/filtro). */
export function DayView({ dateKey, onDateChange }: DayViewProps) {
  const { startIso, endIso } = dayRangeIso(dateKey)
  const { data: appointments, isLoading } = useAppointmentsInRange(startIso, endIso)
  const { data: professionals } = useActiveProfessionals()

  const [adding, setAdding] = useState<'appointment' | 'block' | null>(null)
  const [search, setSearch] = useState('')
  const [professionalFilter, setProfessionalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = appointments?.filter((appointment) => {
    if (search && !appointment.client_name.toLowerCase().includes(search.toLowerCase()))
      return false
    if (professionalFilter && appointment.professional_id !== professionalFilter) return false
    if (statusFilter && appointment.status !== statusFilter) return false
    return true
  })

  const defaultStartsAt = `${dateKey}T09:00`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconButton aria-label="Dia anterior" onClick={() => onDateChange(addDays(dateKey, -1))}>
            <ChevronLeft />
          </IconButton>
          <Text size="body" className="font-semibold capitalize">
            {formatDateLabel(dateKey)}
          </Text>
          <IconButton aria-label="Dia seguinte" onClick={() => onDateChange(addDays(dateKey, 1))}>
            <ChevronRight />
          </IconButton>
        </div>

        {dateKey !== todayKey() && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onDateChange(todayKey())}>
            Hoje
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <TextInput
          placeholder="Buscar cliente…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-48"
        />
        <Select
          value={professionalFilter}
          onChange={(event) => setProfessionalFilter(event.target.value)}
          className="sm:w-auto"
        >
          <option value="">Todos os profissionais</option>
          {professionals?.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.name}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="sm:w-auto"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusLabels).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && (
        <Text size="small" tone="muted">
          Carregando…
        </Text>
      )}

      <ul className="space-y-3">
        {filtered?.map((appointment) => (
          <AppointmentRow key={appointment.id} appointment={appointment} />
        ))}
      </ul>

      {filtered?.length === 0 && !isLoading && (
        <Text size="small" tone="muted">
          Nenhum agendamento para esse filtro.
        </Text>
      )}

      {adding === 'appointment' && (
        <AppointmentForm
          defaultStartsAt={defaultStartsAt}
          onCreated={() => setAdding(null)}
          onCancel={() => setAdding(null)}
        />
      )}
      {adding === 'block' && (
        <BlockForm
          defaultStartsAt={defaultStartsAt}
          onCreated={() => setAdding(null)}
          onCancel={() => setAdding(null)}
        />
      )}

      {!adding && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => setAdding('appointment')}>
            Novo agendamento
          </Button>
          <Button type="button" variant="outline" onClick={() => setAdding('block')}>
            Bloquear horário
          </Button>
        </div>
      )}
    </div>
  )
}
