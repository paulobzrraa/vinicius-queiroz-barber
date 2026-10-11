import { useParams } from 'react-router-dom'

import { Button, Text } from '@/components/ui'
import { useAppointmentByToken } from '@/queries/appointments'
import { BookingLayout } from './BookingLayout'
import { SuccessStep } from './steps/SuccessStep'

/**
 * Tela de confirmação com URL própria (/agendar/confirmado/:token): os dados
 * vêm do banco pelo token, então recarregar a página (F5) ou reabrir o link
 * mostra a mesma confirmação em vez de voltar ao início do agendamento.
 */
export function BookingConfirmedPage() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading } = useAppointmentByToken(token)

  const isActive = data && data.appointment.status !== 'canceled'

  return (
    <BookingLayout>
      {isLoading && (
        <Text size="body" tone="muted">
          Carregando…
        </Text>
      )}

      {isActive && (
        <SuccessStep
          appointment={data.appointment}
          serviceNames={data.services.map((service) => service.name)}
          professionalName={data.professional?.name ?? ''}
        />
      )}

      {!isLoading && !isActive && (
        <div className="flex flex-col items-start gap-4">
          <Text size="body" tone="muted">
            {data
              ? 'Esse agendamento foi cancelado.'
              : 'Agendamento não encontrado. Confira o link.'}
          </Text>
          <Button href="/agendar">Reservar outro horário</Button>
        </div>
      )}
    </BookingLayout>
  )
}
