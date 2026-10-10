import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useActiveProfessionals, type ProfessionalRow } from '@/queries/professionals'
import { useActiveServices, type ServiceRow } from '@/queries/services'
import { formatPhone } from '@/utils/phone'
import { saveEmail } from '@/utils/savedEmail'
import { formatDateTimeLabel } from '@/utils/timezone'
import { BookingLayout } from './BookingLayout'
import { clearBookingDraft, loadBookingDraft, saveBookingDraft } from './bookingDraft'
import { AccordionSection } from './components/AccordionSection'
import { ClientStep } from './steps/ClientStep'
import { ConfirmStep } from './steps/ConfirmStep'
import { DateTimeStep } from './steps/DateTimeStep'
import { ProfessionalStep } from './steps/ProfessionalStep'
import { ServiceStep } from './steps/ServiceStep'
import {
  type BookingState,
  type BookingStep,
  initialBookingState,
  stepLabels,
  stepOrder,
} from './types'

function summarizeServices(ids: string[], services?: ServiceRow[]): string {
  return (
    services
      ?.filter((service) => ids.includes(service.id))
      .map((service) => service.name)
      .join(', ') ?? ''
  )
}

function summarizeProfessional(id: string | null, professionals?: ProfessionalRow[]): string {
  return professionals?.find((professional) => professional.id === id)?.name ?? ''
}

function summarizeClient(name: string, phone: string): string {
  return phone ? `${name} · ${formatPhone(phone)}` : name
}

/**
 * BL-064 (revisão): fluxo de agendamento em uma tela só, em formato de
 * acordeão — cada etapa concluída colapsa num resumo e a próxima abre embaixo,
 * tudo na mesma página (sem trocar de tela nem usar o "voltar" do navegador;
 * voltar a uma etapa anterior é só tocar no cabeçalho dela).
 */
export function BookingPage() {
  // Lido uma vez na montagem: F5 ou "voltar" retomam de onde o cliente parou.
  const [draft] = useState(loadBookingDraft)
  const [activeStep, setActiveStep] = useState<BookingStep>(draft?.step ?? 'services')
  const [state, setState] = useState<BookingState>(draft?.state ?? initialBookingState)
  const navigate = useNavigate()

  const { data: services } = useActiveServices()
  const { data: professionals } = useActiveProfessionals()

  useEffect(() => {
    saveBookingDraft({ step: activeStep, state })
  }, [activeStep, state])

  const currentIndex = stepOrder.indexOf(activeStep)

  function statusOf(step: BookingStep) {
    const index = stepOrder.indexOf(step)
    if (index < currentIndex) return 'done' as const
    if (index === currentIndex) return 'active' as const
    return 'upcoming' as const
  }

  return (
    <BookingLayout onClose={clearBookingDraft}>
      <div className="divide-y divide-border">
        <AccordionSection
          index={1}
          label={stepLabels.services}
          status={statusOf('services')}
          summary={summarizeServices(state.serviceIds, services)}
          onEdit={() => setActiveStep('services')}
        >
          <ServiceStep
            serviceIds={state.serviceIds}
            onChange={(serviceIds) =>
              setState((current) => ({
                ...current,
                serviceIds,
                professionalId: null,
                date: null,
                slot: null,
              }))
            }
            onNext={() => setActiveStep('professional')}
          />
        </AccordionSection>

        <AccordionSection
          index={2}
          label={stepLabels.professional}
          status={statusOf('professional')}
          summary={summarizeProfessional(state.professionalId, professionals)}
          onEdit={() => setActiveStep('professional')}
        >
          <ProfessionalStep
            serviceIds={state.serviceIds}
            professionalId={state.professionalId}
            onChange={(professionalId) =>
              setState((current) => ({ ...current, professionalId, date: null, slot: null }))
            }
            onNext={() => setActiveStep('datetime')}
          />
        </AccordionSection>

        <AccordionSection
          index={3}
          label={stepLabels.datetime}
          status={statusOf('datetime')}
          summary={state.slot ? formatDateTimeLabel(state.slot.startsAt) : ''}
          summaryClassName="capitalize"
          onEdit={() => setActiveStep('datetime')}
        >
          <DateTimeStep
            serviceIds={state.serviceIds}
            professionalId={state.professionalId}
            date={state.date}
            onDateChange={(date) => setState((current) => ({ ...current, date, slot: null }))}
            onSlotChange={(slot) => {
              setState((current) => ({ ...current, slot }))
              setActiveStep('client')
            }}
          />
        </AccordionSection>

        <AccordionSection
          index={4}
          label={stepLabels.client}
          status={statusOf('client')}
          summary={summarizeClient(state.clientName, state.clientPhone)}
          onEdit={() => setActiveStep('client')}
          scrollToOnActive
        >
          <ClientStep
            clientName={state.clientName}
            clientPhone={state.clientPhone}
            clientEmail={state.clientEmail}
            clientPassword={state.clientPassword}
            onSubmit={({ clientName, clientPhone, clientEmail, clientPassword, honeypot }) => {
              setState((current) => ({
                ...current,
                clientName,
                clientPhone,
                clientEmail,
                clientPassword,
                honeypot,
              }))
              setActiveStep('review')
            }}
          />
        </AccordionSection>

        <AccordionSection index={5} label={stepLabels.review} status={statusOf('review')}>
          <ConfirmStep
            state={state}
            onConfirmed={(created) => {
              if (created.client_email) saveEmail(created.client_email)
              clearBookingDraft()
              // A confirmação tem URL própria (com o token): F5 não perde a tela.
              navigate(`/agendar/confirmado/${created.access_token}`, { replace: true })
            }}
            onSlotTaken={() => {
              setState((current) => ({ ...current, slot: null }))
              setActiveStep('datetime')
            }}
          />
        </AccordionSection>
      </div>
    </BookingLayout>
  )
}
