import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { Container } from '@/components/ui'

interface BookingLayoutProps {
  children: ReactNode
  /** Destino do X do cabeçalho (padrão: a home). */
  closeTo?: string
  closeLabel?: string
  /** Roda ao tocar no X (ex.: descartar o rascunho do agendamento). */
  onClose?: () => void
}

/**
 * Casca do fluxo de agendamento: sem o Header/menu da landing page (é uma
 * jornada própria, não uma seção da página) — só a marca e um jeito de
 * saída. O progresso das etapas é o próprio acordeão da página (BookingPage),
 * não uma barra separada — por isso não recebe mais a etapa atual.
 */
export function BookingLayout({
  children,
  closeTo = '/',
  closeLabel = 'Cancelar agendamento e voltar ao site',
  onClose,
}: BookingLayoutProps) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <Container className="flex h-header items-center justify-between">
          <a href="/" aria-label="Voltar para o site" className="rounded-sm">
            <Logo className="h-8" />
          </a>
          <Link
            to={closeTo}
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-foreground transition-control hover:bg-foreground/8"
          >
            <X aria-hidden="true" />
          </Link>
        </Container>
      </header>

      <Container size="narrow" className="py-10">
        {children}
      </Container>
    </div>
  )
}
