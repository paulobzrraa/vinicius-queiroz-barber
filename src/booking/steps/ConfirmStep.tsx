import { Button, Text } from '@/components/ui'
import type { AppointmentRow } from '@/queries/appointments'
import {
  RateLimitedError,
  SlotUnavailableError,
  useCreateAppointment,
} from '@/queries/availability'
import { useActiveProfessionals } from '@/queries/professionals'
import { useActiveServices } from '@/queries/services'
import { formatBRL } from '@/utils/currency'
import { formatPhone } from '@/utils/phone'
import { formatDateTimeLabel } from '@/utils/timezone'
import { StepShell } from '../components/StepShell'
import type { BookingState } from '../types'

interface ConfirmStepProps {
  state: BookingState
  onConfirmed: (appointment: AppointmentRow) => void
  onSlotTaken: () => void
}

/** BL-071: resumo antes de gravar. BL-073 acontece de verdade dentro de useCreateAppointment. */
export function ConfirmStep({ state, onConfirmed, onSlotTaken }: ConfirmStepProps) {
  const { data: services } = useActiveServices()
  const { data: professionals } = useActiveProfessionals()
  const create = useCreateAppointment()

  const selectedServices =
    services?.filter((service) => state.serviceIds.includes(service.id)) ?? []
  const professional = professionals?.find((p) => p.id === state.professionalId)

  const prices = selectedServices.map((service) => service.price)
  const total = prices.every((price) => price !== null)
    ? formatBRL(prices.reduce((sum, price) => sum + (price ?? 0), 0))
    : null

  async function handleConfirm() {
    if (!state.slot) return

    try {
      const appointment = await create.mutateAsync({
        clientName: state.clientName,
        clientPhone: state.clientPhone,
        clientEmail: state.clientEmail,
        clientPassword: state.clientPassword,
        serviceIds: state.serviceIds,
        startsAt: state.slot.startsAt,
        professionalId: state.professionalId,
        honeypot: state.honeypot,
      })
      onConfirmed(appointment)
    } catch (error) {
      if (error instanceof SlotUnavailableError) {
        onSlotTaken()
        return
      }
      throw error
    }
  }

  return (
    <StepShell
      title="Confira e confirme"
      footer={
        <Button onClick={handleConfirm} disabled={create.isPending || !state.slot}>
          {create.isPending ? 'Confirmando…' : 'Confirmar agendamento'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-card">
        <div>
          <Text size="caption" tone="muted" className="uppercase">
            Serviços
          </Text>
          <ul className="mt-1 flex flex-col gap-1">
            {selectedServices.map((service) => (
              <li key={service.id} className="flex items-baseline justify-between gap-4">
                <Text size="body">{service.name}</Text>
                {service.price != null && (
                  <Text size="small" tone="muted">
                    {formatBRL(service.price)}
                  </Text>
                )}
              </li>
            ))}
          </ul>
          {total && (
            <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-border pt-2">
              <Text size="small" className="font-semibold">
                Total
              </Text>
              <Text size="small" className="font-semibold">
                {total}
              </Text>
            </div>
          )}
        </div>

        <div>
          <Text size="caption" tone="muted" className="uppercase">
            Profissional
          </Text>
          <Text size="body" className="mt-1">
            {professional?.name ?? 'Sem preferência — confirmaremos quem te atende'}
          </Text>
        </div>

        <div>
          <Text size="caption" tone="muted" className="uppercase">
            Data e horário
          </Text>
          <Text size="body" className="mt-1 capitalize">
            {state.slot && formatDateTimeLabel(state.slot.startsAt)}
          </Text>
        </div>

        <div>
          <Text size="caption" tone="muted" className="uppercase">
            Seus dados
          </Text>
          <Text size="body" className="mt-1">
            {state.clientName} · {formatPhone(state.clientPhone)}
          </Text>
          {state.clientEmail && (
            <Text size="small" tone="muted" className="mt-0.5 break-all">
              {state.clientEmail}
            </Text>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {create.isError && create.error instanceof RateLimitedError && (
          <Text size="small" tone="muted">
            Você já tem agendamentos em aberto demais. Aguarde um pouco ou fale com a barbearia.
          </Text>
        )}

        {create.isError &&
          !(create.error instanceof SlotUnavailableError) &&
          !(create.error instanceof RateLimitedError) && (
            <Text size="small" tone="muted">
              Não foi possível confirmar. Tente de novo.
            </Text>
          )}
      </div>
    </StepShell>
  )
}
