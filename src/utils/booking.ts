export interface BookingLink {
  href: string
  /** Abre fora do site (WhatsApp ou sistema externo): o link deve abrir em nova aba. */
  external: boolean
}

/**
 * Destino dos CTAs de agendamento. Fonte única: todo botão de agendar usa
 * este hook, então trocar o destino é uma edição aqui, não em cada botão.
 *
 * Aponta para o fluxo próprio (src/booking, BL-064). booking_settings
 * (provider/external_url/whatsapp_message, editáveis em /admin) não afeta
 * mais os CTAs — ficaram sem efeito até o BL-100/BL-101 decidirem o que
 * fazer com esses campos (reaproveitar como fallback, ou remover do admin).
 */
export function useBookingLink(): BookingLink {
  return { href: '/agendar', external: false }
}
