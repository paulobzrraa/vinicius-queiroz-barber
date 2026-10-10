import { useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { type AvailableSlot, useAvailableSlots } from '@/queries/availability'
import { StepShell } from '../components/StepShell'
import { DateStep } from './DateStep'
import { TimeStep } from './TimeStep'

interface DateTimeStepProps {
  serviceIds: string[]
  professionalId: string | null
  date: string | null
  onDateChange: (date: string) => void
  onSlotChange: (slot: AvailableSlot) => void
}

/**
 * Junta calendário e grade de horários numa seção só (fluxo em uma tela):
 * o horário aparece embaixo do calendário assim que um dia é escolhido, sem
 * trocar de tela — o calendário continua visível, então trocar de dia é só
 * clicar em outro. DateStep/TimeStep continuam existindo à parte com sua
 * própria moldura (título + voltar) para o RescheduleFlow, que ainda mostra
 * um de cada vez.
 */
export function DateTimeStep({
  serviceIds,
  professionalId,
  date,
  onDateChange,
  onSlotChange,
}: DateTimeStepProps) {
  const timesRef = useRef<HTMLDivElement>(null)
  const previousDate = useRef(date)
  const pendingScroll = useRef(false)
  const reducedMotion = useReducedMotion()
  // Mesma consulta do TimeStep (o React Query reaproveita): só para saber quando a grade já carregou.
  const slots = useAvailableSlots({ serviceIds, professionalId, date })

  // Ao escolher (ou trocar) o dia, marca que falta rolar até os horários. Não marca na montagem
  // (rascunho restaurado com dia já escolhido).
  useEffect(() => {
    if (date && date !== previousDate.current) pendingScroll.current = true
    previousDate.current = date
  }, [date])

  // Rola só depois que os horários carregaram: com a grade no tamanho final, o topo dela
  // chega ao topo da tela (antes, só com "Carregando…", a seção ainda era curta demais).
  useEffect(() => {
    if (!pendingScroll.current || !slots.isSuccess || slots.isFetching) return
    pendingScroll.current = false
    timesRef.current?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [date, slots.isSuccess, slots.isFetching, reducedMotion])

  return (
    <StepShell title="Escolha o dia e o horário">
      <div className="flex flex-col gap-6">
        <DateStep
          hideChrome
          serviceIds={serviceIds}
          professionalId={professionalId}
          date={date}
          onChange={onDateChange}
        />

        {date && (
          <div
            ref={timesRef}
            className="min-h-[calc(100dvh-1rem)] scroll-mt-4 border-t border-border pt-6"
          >
            {/* min-h: sem altura sobrando abaixo da grade, o navegador não consegue rolar até o topo
              dela (a página acabaria antes). A folga some quando um horário é escolhido e a seção recolhe. */}
            {/* key={date}: força remontar ao trocar de dia (o calendário continua visível
                acima, então dá pra trocar sem sair da seção) — sem isso, o foco por teclado
                do TimeStep (BL-108) ficaria com índice e refs de botões da grade anterior. */}
            <TimeStep
              key={date}
              hideChrome
              serviceIds={serviceIds}
              professionalId={professionalId}
              date={date}
              onChange={onSlotChange}
            />
          </div>
        )}
      </div>
    </StepShell>
  )
}
