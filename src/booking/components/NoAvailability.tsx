import { CalendarX } from 'lucide-react'

import { Button, Text } from '@/components/ui'
import { useContactSettings } from '@/queries/contact'
import { formatPhone } from '@/utils/phone'

/**
 * BL-074: quando não há nenhum horário livre na janela visível (ex.: agenda
 * cheia por semanas), em vez de deixar o calendário vazio sem explicação,
 * oferece o WhatsApp direto — independente do provider configurado em
 * booking_settings, que é sobre o CTA da landing, não sobre este estado.
 */
export function NoAvailability() {
  const { data: contact } = useContactSettings()

  const message = encodeURIComponent(
    'Olá! Não encontrei horários disponíveis no agendamento online, vocês têm algum horário?',
  )
  const whatsappHref = contact?.whatsapp
    ? `https://wa.me/${contact.whatsapp}?text=${message}`
    : undefined

  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface p-card text-center">
      <CalendarX aria-hidden="true" className="size-8 text-muted" />
      <Text size="body" className="max-w-text">
        Sem horários livres nos próximos dias.
      </Text>

      {whatsappHref ? (
        <Button href={whatsappHref} target="_blank" rel="noopener noreferrer" variant="outline">
          Falar no WhatsApp
        </Button>
      ) : (
        contact?.phone && (
          <Text size="small" tone="muted">
            Ligue para{' '}
            <a href={`tel:+55${contact.phone}`} className="link">
              {formatPhone(contact.phone)}
            </a>
          </Text>
        )
      )}
    </div>
  )
}
