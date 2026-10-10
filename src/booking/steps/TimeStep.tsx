import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { Text } from '@/components/ui'
import { type AvailableSlot, useAvailableSlots } from '@/queries/availability'
import { formatDayLabel, formatTimeLabel, formatWeekdayLong } from '@/utils/timezone'
import { NoAvailability } from '../components/NoAvailability'
import { StepShell } from '../components/StepShell'

interface TimeStepProps {
  serviceIds: string[]
  professionalId: string | null
  date: string
  onChange: (slot: AvailableSlot) => void
  onBack?: () => void
  /** BL-1xx: sem título/voltar próprios — usado pelo DateTimeStep, que já dá o contexto. */
  hideChrome?: boolean
}

/** BL-069: horários livres do dia escolhido. Com "sem preferência", vários profissionais podem
 * ter o mesmo horário — aqui só interessa o horário em si, um por vez (dedupe por starts_at).
 * BL-108: seta esquerda/direita move entre os horários (a grade muda de 3 para 4 colunas
 * conforme a largura da tela, então cima/baixo não teria uma coluna fixa para seguir). */
export function TimeStep({
  serviceIds,
  professionalId,
  date,
  onChange,
  onBack,
  hideChrome = false,
}: TimeStepProps) {
  const { data: slots, isLoading } = useAvailableSlots({ serviceIds, professionalId, date })

  const uniqueByTime = new Map<string, AvailableSlot>()
  for (const slot of slots ?? []) {
    if (!uniqueByTime.has(slot.startsAt)) uniqueByTime.set(slot.startsAt, slot)
  }
  const uniqueSlots = [...uniqueByTime.values()]

  const [focusedIndex, setFocusedIndex] = useState(0)
  const buttonRefs = useRef<HTMLButtonElement[]>([])

  // Sem reset de focusedIndex a outra data: TimeStep só existe enquanto step === 'time'
  // (ver BookingPage/RescheduleFlow) — trocar de data desmonta e remonta o componente,
  // o que já reinicia esse estado sozinho.
  useEffect(() => {
    buttonRefs.current[focusedIndex]?.focus()
  }, [focusedIndex])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' ? -1 : 1
    setFocusedIndex((current) => Math.min(Math.max(current + delta, 0), uniqueSlots.length - 1))
  }

  const description = `${formatWeekdayLong(date)}, ${formatDayLabel(date)}`

  const content = (
    <>
      <div aria-live="polite">
        {isLoading && (
          <Text size="small" tone="muted">
            Carregando horários…
          </Text>
        )}
        {!isLoading && uniqueSlots.length === 0 && <NoAvailability />}
      </div>

      <div
        role="listbox"
        aria-label="Horários disponíveis"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-3 gap-3 sm:grid-cols-4"
      >
        {uniqueSlots.map((slot, index) => (
          <button
            key={slot.startsAt}
            ref={(el) => {
              if (el) buttonRefs.current[index] = el
            }}
            type="button"
            role="option"
            aria-selected={false}
            tabIndex={index === focusedIndex ? 0 : -1}
            onFocus={() => setFocusedIndex(index)}
            onClick={() => onChange(slot)}
            className="rounded-control border border-border px-3 py-3 text-small font-medium text-foreground transition-control hover:border-border-strong hover:bg-foreground/5 motion-safe:active:scale-97"
          >
            {formatTimeLabel(slot.startsAt)}
          </button>
        ))}
      </div>
    </>
  )

  if (hideChrome) {
    return (
      <div className="flex flex-col gap-4">
        <Text size="small" tone="muted" className="capitalize">
          {description}
        </Text>
        {content}
      </div>
    )
  }

  return (
    <StepShell title="Escolha o horário" description={description} onBack={onBack}>
      {content}
    </StepShell>
  )
}
