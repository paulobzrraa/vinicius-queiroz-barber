import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { m } from 'motion/react'

import { fadeInUp } from '@/animations'
import { Heading, IconButton, Text } from '@/components/ui'
import { cn } from '@/utils/cn'

interface StepShellProps {
  title: string
  description?: string
  onBack?: () => void
  /** Alinhamento do título e da descrição (telas avulsas, como "Meus agendamentos", centralizam). */
  align?: 'start' | 'center'
  children: ReactNode
  /** Ações da etapa (normalmente o botão "Continuar"), fora do fluxo de entrada do conteúdo. */
  footer?: ReactNode
}

/**
 * Moldura comum a cada etapa do agendamento: botão de voltar, título e
 * conteúdo. BL-108: ao trocar de etapa, o foco vai para o título — quem usa
 * leitor de tela ouve para onde a navegação levou, em vez de ficar parado no
 * botão "Continuar" da etapa anterior (que nem existe mais no DOM).
 */
export function StepShell({
  title,
  description,
  onBack,
  align = 'start',
  children,
  footer,
}: StepShellProps) {
  const headingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [title])

  return (
    <m.div
      key={title}
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      className="flex flex-col gap-6"
    >
      <div
        className={cn(
          'flex items-center gap-3',
          align === 'center' && 'justify-center text-center',
        )}
      >
        {onBack && (
          <IconButton aria-label="Voltar" onClick={onBack} className="-ms-2">
            <ArrowLeft />
          </IconButton>
        )}
        <div ref={headingRef} tabIndex={-1} className="outline-none">
          <Heading as="h1" size="title-3">
            {title}
          </Heading>
          {description && (
            <Text size="small" tone="muted" className="mt-1">
              {description}
            </Text>
          )}
        </div>
      </div>

      {children}

      {footer && <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">{footer}</div>}
    </m.div>
  )
}
