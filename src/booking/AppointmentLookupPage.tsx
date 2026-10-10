import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useParams } from 'react-router-dom'

import { motion, useReducedMotion } from 'motion/react'

import { fadeInUp, sealContent } from '@/animations'
import { StatusSeal } from '@/components/StatusSeal'
import { Button, Heading, Text } from '@/components/ui'
import { useAppointmentByToken } from '@/queries/appointments'
import {
  AppointmentActionError,
  useCancelAppointment,
  useRescheduleAppointment,
} from '@/queries/appointmentActions'
import type { AvailableSlot } from '@/queries/availability'
import { formatPhone } from '@/utils/phone'
import { formatDateTimeLabel } from '@/utils/timezone'
import { updateCachedAppointment } from './accessSession'
import { BookingLayout } from './BookingLayout'
import { RescheduleFlow } from './RescheduleFlow'

const actionErrorMessages: Record<string, string> = {
  not_found: 'Agendamento não encontrado. Confira o link.',
  slot_unavailable: 'Esse horário acabou de ser ocupado. Escolha outro.',
  too_late: 'Muito perto do horário para mudar por aqui. Fale com a barbearia.',
  already_canceled: 'Esse agendamento já foi cancelado.',
}

type View = 'details' | 'reschedule' | 'confirm-cancel'

/**
 * BL-072/077: destino do link único que o cliente recebe ao confirmar o
 * agendamento, sem precisar de login (get_appointment_by_token, BL-058).
 * BL-078 (reagendar) e BL-079 (cancelar) chamam as funções do banco que
 * revalidam tudo de novo — o cliente nunca escreve direto na tabela.
 */
export function AppointmentLookupPage() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, error } = useAppointmentByToken(token)
  const cancel = useCancelAppointment(token ?? '')
  const reschedule = useRescheduleAppointment(token ?? '')

  const [view, setView] = useState<View>('details')
  const queryClient = useQueryClient()
  const animated = !useReducedMotion()

  // Veio da lista de "Meus agendamentos": o X volta para ela. Agendamento novo
  // (ou link direto) não tem essa origem, então o X leva à home.
  const location = useLocation()
  const fromList = (location.state as { from?: string } | null)?.from === 'list'

  const actionError = cancel.error ?? reschedule.error
  const actionErrorMessage =
    actionError instanceof AppointmentActionError
      ? actionErrorMessages[actionError.reason]
      : actionError
        ? 'Não foi possível concluir. Tente de novo.'
        : null

  function handleRescheduleSelect(slot: AvailableSlot) {
    reschedule.mutate(slot.startsAt, {
      onSuccess: () => {
        if (token) updateCachedAppointment(token, { startsAt: slot.startsAt })
        void queryClient.invalidateQueries({ queryKey: ['my_appointments'] })
        setView('details')
      },
    })
  }

  return (
    <BookingLayout
      closeTo={fromList ? '/meus-agendamentos' : '/'}
      closeLabel={fromList ? 'Voltar para meus agendamentos' : 'Voltar para o site'}
    >
      <div>
        {isLoading && (
          <Text size="body" tone="muted">
            Carregando…
          </Text>
        )}

        {(error || (!isLoading && !data)) && (
          <Text size="body" tone="muted">
            Agendamento não encontrado.
          </Text>
        )}

        {data && view === 'reschedule' && (
          <RescheduleFlow
            serviceIds={data.services.map((service) => service.service_id)}
            professionalId={data.appointment.professional_id}
            onSelect={handleRescheduleSelect}
            onCancel={() => setView('details')}
          />
        )}

        {data && view !== 'reschedule' && (
          <div className="flex flex-col gap-6">
            {cancel.isSuccess ? (
              // Acabou de cancelar: o mesmo selo da confirmação do agendamento, com um X.
              <div className="flex flex-col items-center gap-6 text-center">
                <StatusSeal variant="canceled" animated={animated} />
                <motion.div
                  initial={animated ? 'hidden' : false}
                  animate="visible"
                  variants={sealContent}
                  className="flex flex-col items-center gap-6"
                >
                  <motion.div variants={fadeInUp}>
                    <Heading as="h1" size="title-3">
                      Agendamento cancelado
                    </Heading>
                    <Text size="body" tone="muted" className="mt-2 capitalize">
                      {formatDateTimeLabel(data.appointment.starts_at)}
                    </Text>
                  </motion.div>
                  <motion.div variants={fadeInUp}>
                    <Button href="/agendar" variant="outline">
                      Agendar novo horário
                    </Button>
                  </motion.div>
                </motion.div>
              </div>
            ) : (
              <div>
                <Heading as="h1" size="title-3">
                  Seu agendamento
                </Heading>
                <Text size="body" tone="muted" className="mt-2 capitalize">
                  {data.appointment.status === 'canceled' ? 'Cancelado — ' : ''}
                  {formatDateTimeLabel(data.appointment.starts_at)}
                </Text>
              </div>
            )}

            <div className="rounded-card border border-border bg-surface p-card">
              <Text size="caption" tone="muted" className="uppercase">
                Serviços
              </Text>
              <ul className="mt-1 flex flex-col gap-1">
                {data.services.map((service) => (
                  <li key={service.service_id}>
                    <Text size="body">{service.name}</Text>
                  </li>
                ))}
              </ul>

              {data.professional && (
                <div className="mt-4">
                  <Text size="caption" tone="muted" className="uppercase">
                    Profissional
                  </Text>
                  <Text size="body" className="mt-1">
                    {data.professional.name}
                  </Text>
                </div>
              )}

              <div className="mt-4">
                <Text size="caption" tone="muted" className="uppercase">
                  Cliente
                </Text>
                <Text size="body" className="mt-1">
                  {data.appointment.client_name} · {formatPhone(data.appointment.client_phone)}
                </Text>
              </div>
            </div>

            <div aria-live="polite">
              {actionErrorMessage && (
                <Text size="small" tone="muted">
                  {actionErrorMessage}
                </Text>
              )}
            </div>

            {data.appointment.status !== 'canceled' && !cancel.isSuccess && (
              <div className="flex flex-wrap gap-3">
                {view !== 'confirm-cancel' ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => setView('reschedule')}>
                      Reagendar
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setView('confirm-cancel')}>
                      Cancelar agendamento
                    </Button>
                  </>
                ) : (
                  <>
                    <Text size="small">Cancelar este agendamento?</Text>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={cancel.isPending}
                      onClick={() =>
                        cancel.mutate(undefined, {
                          onSuccess: () => {
                            if (token) updateCachedAppointment(token, { canceled: true })
                            void queryClient.invalidateQueries({ queryKey: ['my_appointments'] })
                          },
                        })
                      }
                    >
                      {cancel.isPending ? 'Cancelando…' : 'Sim, cancelar'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setView('details')}>
                      Não
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </BookingLayout>
  )
}
