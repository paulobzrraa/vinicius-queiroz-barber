import { useEffect, useRef, type CSSProperties } from 'react'

import { BookingButton } from '@/components/BookingButton'
import { Logo } from '@/components/Logo'
import { Container, IconButton } from '@/components/ui'
import { myAppointmentsLink, navigation, sectionIds } from '@/data'
import { MenuIcon } from './MenuIcon'

interface MobileMenuProps {
  id: string
  open: boolean
  onClose: () => void
}

/**
 * Menu mobile em tela cheia, sobre o <dialog> nativo: o navegador já cuida
 * do foco preso, do Esc, de tornar o resto da página inerte e de devolver o
 * foco ao botão que abriu. A animação é em CSS (utilitário `sheet`).
 */
export function MobileMenu({ id, open, onClose }: MobileMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)

  // Abre e fecha conforme a prop. Fechar por dentro (Esc, links) dispara `close`.
  useEffect(() => {
    const element = dialog.current
    if (!element) return

    if (open && !element.open) {
      element.showModal()
      closeButton.current?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  // Se a tela crescer até o layout desktop com o menu aberto, ele fecha.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)')
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) dialog.current?.close()
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  const close = () => dialog.current?.close()

  return (
    <dialog
      ref={dialog}
      id={id}
      aria-label="Menu"
      onClose={onClose}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none sheet overflow-y-auto overscroll-contain bg-background text-foreground"
    >
      <Container className="flex min-h-dvh flex-col pb-8">
        {/* Mesma linha do header: a logo e o botão ficam onde já estavam. */}
        <div className="flex h-header shrink-0 items-center justify-between">
          <a href={`#${sectionIds.hero}`} onClick={close} className="rounded-sm">
            <Logo className="h-9" />
          </a>
          <IconButton ref={closeButton} aria-label="Fechar menu" onClick={close}>
            <MenuIcon open />
          </IconButton>
        </div>

        <nav aria-label="Principal" className="mt-6 flex-1">
          <ul className="border-t border-border">
            {navigation.map((item, index) => (
              <li
                key={item.href}
                className="sheet-item border-b border-border"
                style={{ '--sheet-index': index } as CSSProperties}
              >
                <a
                  href={item.href}
                  onClick={close}
                  className="flex min-h-16 items-center py-4 text-title-3 transition-control hover:text-muted"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li
              className="sheet-item border-b border-border"
              style={{ '--sheet-index': navigation.length } as CSSProperties}
            >
              <a
                href={myAppointmentsLink.href}
                className="flex min-h-16 items-center py-4 text-title-3 transition-control hover:text-muted"
              >
                {myAppointmentsLink.label}
              </a>
            </li>
          </ul>
        </nav>

        <div
          className="mt-8 sheet-item"
          style={{ '--sheet-index': navigation.length + 1 } as CSSProperties}
        >
          <BookingButton size="lg" className="w-full" onClick={close} />
        </div>
      </Container>
    </dialog>
  )
}
