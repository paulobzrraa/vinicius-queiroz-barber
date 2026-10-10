import type { NavItem } from '@/types'

/**
 * IDs das secoes da pagina. Fonte unica para as ancoras do menu e para o
 * atributo `id` de cada secao, para que os dois nunca saiam de sincronia.
 */
export const sectionIds = {
  hero: 'inicio',
  about: 'sobre-nos',
  services: 'servicos',
  professionals: 'nossa-equipe',
  gallery: 'galeria',
  booking: 'agendamento',
  contact: 'contato',
} as const

/** Menu principal, na mesma ordem em que as seções aparecem na página (Header e Footer). */
export const navigation: NavItem[] = [
  { label: 'Sobre Nós', href: `#${sectionIds.about}` },
  { label: 'Serviços', href: `#${sectionIds.services}` },
  { label: 'Nossa Equipe', href: `#${sectionIds.professionals}` },
  { label: 'Galeria', href: `#${sectionIds.gallery}` },
  { label: 'Agendamento', href: `#${sectionIds.booking}` },
  { label: 'Contato', href: `#${sectionIds.contact}` },
]

/**
 * Página própria (não é uma âncora da landing, por isso fica fora de
 * `navigation`, que também alimenta o realce da seção atual e o Footer).
 * Aparece como último item do menu do Header e do menu mobile.
 */
export const myAppointmentsLink = {
  label: 'Meus Agendamentos',
  href: '/meus-agendamentos',
}
