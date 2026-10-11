import { ArrowUpRight } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui'
import { useBookingLink } from '@/utils/booking'

interface BookingButtonProps extends Omit<ComponentPropsWithoutRef<'a'>, 'href'> {
  variant?: ButtonVariant
  size?: ButtonSize
  iconStart?: ReactNode
  iconEnd?: ReactNode
}

/**
 * Botão de agendar. O destino vem de src/data/booking.ts; quando ele sai do
 * site (agendamento externo ou WhatsApp), mostra uma seta de saída — quem vê
 * sabe que vai abrir outra aba antes de clicar.
 */
export function BookingButton({
  children = 'Reservar horário',
  iconEnd,
  ...props
}: BookingButtonProps) {
  const { href, external } = useBookingLink()

  return (
    <Button
      href={href}
      iconEnd={iconEnd ?? (external ? <ArrowUpRight /> : undefined)}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
      {...props}
    >
      {children}
      {external && <span className="sr-only"> (abre em nova aba)</span>}
    </Button>
  )
}
