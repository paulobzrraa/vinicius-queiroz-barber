import { useRef, useState } from 'react'

import { Logo } from '@/components/Logo'
import { Container, IconButton } from '@/components/ui'
import { myAppointmentsLink, navigation, sectionIds } from '@/data'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useScrolled } from '@/hooks/useScrolled'
import { cn } from '@/utils/cn'
import { MenuIcon } from './MenuIcon'
import { MobileMenu } from './MobileMenu'

/** Seções do menu, para marcar a atual enquanto a página rola. */
const menuSections = navigation.map((item) => item.href.slice(1))

/** "Agendamento" aparece só no menu hambúrguer (mobile); no header desktop fica de fora. */
const desktopNavigation = navigation.filter((item) => item.href !== `#${sectionIds.booking}`)

const MOBILE_MENU_ID = 'menu-mobile'

/**
 * Cabeçalho fixo. No topo é transparente, com um degradê que garante a
 * leitura sobre o Hero; ao rolar, vira um material translúcido com desfoque.
 * Fica fixo (não esconde ao rolar) para o menu — com o link Agendamento —
 * estar sempre ao alcance.
 *
 * Abaixo de `lg` o menu vira um painel em tela cheia (MobileMenu).
 */
export function Header() {
  const sentinel = useRef<HTMLDivElement>(null)
  const scrolled = useScrolled(sentinel)
  const activeSection = useActiveSection(menuSections)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* Marca o topo da página: quando sai da tela, o header muda de aparência. */}
      <div
        ref={sentinel}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-6"
      />

      <header className="fixed inset-x-0 top-0 z-50">
        <a
          href="#conteudo"
          className="fixed top-3 left-gutter z-10 -translate-y-24 rounded-control bg-accent px-5 py-3 text-small font-semibold text-accent-foreground focus-visible:translate-y-0"
        >
          Pular para o conteúdo
        </a>

        {/* Fundo em duas camadas que trocam por opacidade (só compositor). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-[175%] bg-gradient-scrim-top transition-opacity duration-250 ease-out',
              scrolled && 'opacity-0',
            )}
          />
          <div
            className={cn(
              'absolute inset-0 bg-background/80 opacity-0 backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-250 ease-out reduced-transparency:bg-background reduced-transparency:backdrop-blur-none',
              scrolled && 'opacity-100',
            )}
          >
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-hairline" />
          </div>
        </div>

        <Container className="relative flex h-header items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          {/* Só aparece a partir da seção Sobre Nós: no Hero, a marca já está grande na tela,
              a logo do header aqui seria redundante. */}
          <a
            href={`#${sectionIds.hero}`}
            aria-hidden={activeSection === null}
            tabIndex={activeSection === null ? -1 : undefined}
            className={cn(
              'justify-self-start rounded-sm opacity-0 transition-opacity duration-250 ease-out',
              activeSection === null && 'pointer-events-none',
              activeSection !== null && 'opacity-100',
            )}
          >
            <Logo className="h-7 lg:h-8" />
          </a>

          <nav aria-label="Principal" className="hidden lg:block">
            <ul className="flex items-center gap-10">
              {desktopNavigation.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={item.href === `#${activeSection}` ? 'true' : undefined}
                    className="link-nav rounded-md text-small font-medium [--link-nav-color:color-mix(in_oklab,var(--color-foreground)_82%,transparent)]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={myAppointmentsLink.href}
                  className="link-nav rounded-md text-small font-medium [--link-nav-color:color-mix(in_oklab,var(--color-foreground)_82%,transparent)]"
                >
                  {myAppointmentsLink.label}
                </a>
              </li>
            </ul>
          </nav>

          <div className="flex items-center gap-1 justify-self-end">
            <IconButton
              aria-label="Abrir menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls={MOBILE_MENU_ID}
              onClick={() => setMenuOpen(true)}
              className="lg:hidden"
            >
              <MenuIcon />
            </IconButton>
          </div>
        </Container>

        <MobileMenu id={MOBILE_MENU_ID} open={menuOpen} onClose={() => setMenuOpen(false)} />
      </header>
    </>
  )
}
