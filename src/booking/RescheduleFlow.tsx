import { useState } from 'react'

import type { AvailableSlot } from '@/queries/availability'
import { DateStep } from './steps/DateStep'
import { TimeStep } from './steps/TimeStep'

interface RescheduleFlowProps {
  serviceIds: string[]
  professionalId: string
  onSelect: (slot: AvailableSlot) => void
  onCancel: () => void
}

/** BL-078: reaproveita as etapas de data/horário do fluxo público, fixando o mesmo
 * profissional e os mesmos serviços do agendamento original — só a data/hora mudam. */
export function RescheduleFlow({
  serviceIds,
  professionalId,
  onSelect,
  onCancel,
}: RescheduleFlowProps) {
  const [date, setDate] = useState<string | null>(null)

  if (!date) {
    return (
      <DateStep
        serviceIds={serviceIds}
        professionalId={professionalId}
        date={date}
        onChange={setDate}
        onBack={onCancel}
      />
    )
  }

  return (
    <TimeStep
      serviceIds={serviceIds}
      professionalId={professionalId}
      date={date}
      onChange={onSelect}
      onBack={() => setDate(null)}
    />
  )
}
