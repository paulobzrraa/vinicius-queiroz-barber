import {
  CalendarDays,
  ChevronDown,
  Globe,
  Home as HomeIcon,
  Images,
  Menu,
  MessageSquare,
  Phone,
  Scissors,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import { usePushDeviceSync } from '@/queries/pushSubscriptions'
import { cn } from '@/utils/cn'

import { AgendaEditor } from './sections/agenda/AgendaEditor'
import { BookingEditor } from './sections/BookingEditor'
import { ContactEditor } from './sections/ContactEditor'
import { FinanceEditor } from './sections/finance/FinanceEditor'
import { GalleryEditor } from './sections/GalleryEditor'
import { Home } from './sections/Home'
import { ProfessionalsEditor } from './sections/professionals/ProfessionalsEditor'
import { ServicesEditor } from './sections/ServicesEditor'
import { SiteEditor } from './sections/SiteEditor'
import { TestimonialsEditor } from './sections/TestimonialsEditor'

const sections = [
  { id: 'site', label: 'Site', icon: Globe, component: SiteEditor },
  { id: 'contato', label: 'Contato', icon: Phone, component: ContactEditor },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays, component: AgendaEditor },
  { id: 'agendamento', label: 'Agendamento', icon: SlidersHorizontal, component: BookingEditor },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, component: FinanceEditor },
  { id: 'servicos', label: 'Serviços', icon: Scissors, component: ServicesEditor },
  { id: 'profissionais', label: 'Profissionais', icon: Users, component: ProfessionalsEditor },
  { id: 'depoimentos', label: 'Depoimentos', icon: MessageSquare, component: TestimonialsEditor },
  { id: 'galeria', label: 'Galeria', icon: Images, component: GalleryEditor },
] as const

type SectionId = (typeof sections)[number]['id'] | 'home'

function pathFor(id: SectionId): string {
  return id === 'home' ? '/admin' : `/admin/${id}`
}

function SectionNav({
  activeId,
  onSelect,
  onHome,
}: {
  activeId: SectionId
  onSelect: (id: SectionId) => void
  onHome: () => void
}) {
  return (
    <ul className="border-t border-border">
      <li className="border-b border-border">
        <button
          type="button"
          onClick={onHome}
          className="flex w-full items-center gap-3 px-1 py-3 text-start text-small text-muted transition-control hover:text-foreground"
        >
          <HomeIcon aria-hidden="true" className="size-4" />
          Início
        </button>
      </li>
      {sections.map(({ id, label, icon: Icon }) => (
        <li key={id} className="border-b border-border">
          <button
            type="button"
            onClick={() => onSelect(id)}
            aria-current={id === activeId ? 'page' : undefined}
            className={cn(
              'flex w-full items-center gap-3 px-1 py-3 text-start text-small transition-control',
              id === activeId
                ? 'font-semibold text-foreground'
                : 'text-muted hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Painel de edição do conteúdo do site, protegido por login (ver RequireAuth).
 * A Home (grade de ícones) é o ponto de partida; ao abrir uma seção, um menu
 * lateral com as demais opções aparece ao lado do conteúdo (no mobile, atrás
 * de um botão de hambúrguer).
 *
 * Cada seção tem a própria rota (/admin/:section, ver AppRoutes.tsx) em vez
 * de só estado local — assim atualizar a página mantém a seção aberta, em
 * vez de voltar pra Home.
 */
export function AdminDashboard() {
  usePushDeviceSync()
  const { section } = useParams<{ section?: string }>()
  const navigate = useNavigate()
  const active: SectionId = sections.some((s) => s.id === section) ? (section as SectionId) : 'home'
  const current = sections.find((section) => section.id === active)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  function selectSection(id: SectionId) {
    navigate(pathFor(id))
    setMobileNavOpen(false)
  }

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-gutter py-5">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            aria-label="Início do admin"
            className="rounded-sm"
          >
            <Logo className="h-8" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-1.5 font-display text-title-4 transition-control hover:text-muted"
            >
              Admin
              <ChevronDown aria-hidden="true" className="size-4 text-muted" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute end-0 top-full z-10 mt-2 w-32 rounded-card border border-border bg-surface p-1 shadow-elevated"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    supabase.auth.signOut()
                  }}
                  className="block w-full rounded-control px-3 py-2 text-start text-small text-muted transition-control hover:bg-foreground/8 hover:text-foreground"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-gutter py-6 md:py-10">
        {current ? (
          <div className="md:flex md:items-start md:gap-10">
            <div className="mb-6 flex items-center justify-between gap-3 md:hidden">
              <div className="flex items-center gap-3">
                <current.icon aria-hidden="true" className="size-5 text-muted" />
                <h2 className="font-display text-title-4">{current.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menu"
                className="-me-2 p-2 text-muted transition-control hover:text-foreground"
              >
                <Menu aria-hidden="true" className="size-5" />
              </button>
            </div>

            <aside className="hidden w-44 shrink-0 md:block">
              <SectionNav
                activeId={active}
                onSelect={selectSection}
                onHome={() => navigate('/admin')}
              />
            </aside>

            {mobileNavOpen && (
              <div className="fixed inset-0 z-20 bg-background md:hidden">
                <div className="flex items-center justify-between px-gutter py-5">
                  <span className="font-display text-title-4">Menu</span>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    aria-label="Fechar menu"
                    className="-me-2 p-2 text-muted transition-control hover:text-foreground"
                  >
                    <X aria-hidden="true" className="size-5" />
                  </button>
                </div>
                <div className="px-gutter">
                  <SectionNav
                    activeId={active}
                    onSelect={selectSection}
                    onHome={() => {
                      navigate('/admin')
                      setMobileNavOpen(false)
                    }}
                  />
                </div>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="mb-6 hidden items-center gap-3 md:flex">
                <current.icon aria-hidden="true" className="size-5 text-muted" />
                <h2 className="font-display text-title-4">{current.label}</h2>
              </div>
              <current.component />
            </div>
          </div>
        ) : (
          <Home items={sections} onSelect={(id) => navigate(pathFor(id as SectionId))} />
        )}
      </main>
    </div>
  )
}
