import { Check, ChevronDown } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useRef } from 'react'

import { Text } from '@/components/ui'
import { cn } from '@/utils/cn'

export type SectionStatus = 'done' | 'active' | 'upcoming'

interface AccordionSectionProps {
  index: number
  label: string
  status: SectionStatus
  summary?: string
  summaryClassName?: string
  onEdit?: () => void
  /** Ao ficar ativa (depois de montar), rola até levar o topo desta etapa ao topo da tela. */
  scrollToOnActive?: boolean
  children?: ReactNode
}

/**
 * Uma etapa do agendamento em uma tela só: a lista inteira fica visível de
 * uma vez, cada etapa concluída colapsa num resumo e a próxima abre embaixo
 * — sem trocar de tela nem usar o "voltar" do navegador. Editar uma etapa
 * anterior é só tocar no cabeçalho dela.
 */
export function AccordionSection({
  index,
  label,
  status,
  summary,
  summaryClassName,
  onEdit,
  scrollToOnActive = false,
  children,
}: AccordionSectionProps) {
  const isDone = status === 'done'
  const isActive = status === 'active'
  const isUpcoming = status === 'upcoming'

  const rootRef = useRef<HTMLDivElement>(null)
  const previousStatus = useRef(status)
  const reducedMotion = useReducedMotion()

  // Não rola na montagem (rascunho restaurado já nesta etapa): só quando a etapa anterior
  // acabou de ser concluída e esta abriu embaixo, possivelmente fora da tela.
  useEffect(() => {
    if (scrollToOnActive && status === 'active' && previousStatus.current !== 'active') {
      rootRef.current?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    }
    previousStatus.current = status
  }, [status, scrollToOnActive, reducedMotion])

  const header = (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full border text-caption font-semibold transition-control',
          isDone && 'border-accent bg-accent text-accent-foreground',
          isActive && 'border-foreground text-foreground',
          isUpcoming && 'border-border text-muted',
        )}
      >
        {isDone ? <Check className="size-3.5" strokeWidth={3} /> : index}
      </span>

      <div className="min-w-0 flex-1 text-left">
        <Text
          size="small"
          className={cn('font-semibold', isUpcoming ? 'text-muted' : 'text-foreground')}
        >
          {label}
        </Text>
        {isDone && summary && (
          <Text size="caption" tone="muted" className={cn('mt-0.5 truncate', summaryClassName)}>
            {summary}
          </Text>
        )}
      </div>

      {isDone && <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted" />}
    </div>
  )

  return (
    <div
      ref={rootRef}
      className={cn(
        'scroll-mt-4 py-5 first:pt-0',
        isUpcoming && 'opacity-50',
        // Altura de uma tela: sem conteúdo sobrando abaixo, o navegador não rola até o topo da etapa.
        scrollToOnActive && isActive && 'min-h-[calc(100dvh-1rem)]',
      )}
    >
      {isDone ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${label.toLowerCase()}`}
          className="-mx-2 flex w-[calc(100%+1rem)] rounded-control px-2 py-1 text-left transition-control hover:bg-foreground/5"
        >
          {header}
        </button>
      ) : (
        header
      )}

      {isActive && <div className="mt-5 ps-9">{children}</div>}
    </div>
  )
}
