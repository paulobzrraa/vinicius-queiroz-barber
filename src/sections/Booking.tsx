import { m } from 'motion/react'

import { fadeInUp } from '@/animations'
import { BookingButton } from '@/components/BookingButton'
import { Container, Heading, Reveal, Section, Text } from '@/components/ui'
import { sectionIds } from '@/data'

/**
 * CTA de agendamento. O site não tem backend próprio, então não há
 * formulário aqui — a seção só encaminha para o destino já configurado em
 * src/data/booking.ts (hoje, o agendamento online oficial da barbearia),
 * pelo mesmo BookingButton usado no Header e no Hero.
 *
 * `tone="light"` inverte as cores: é a única seção clara da página, para o
 * convite para agendar se destacar das demais.
 */
export function Booking() {
  return (
    <Section id={sectionIds.booking} tone="light" aria-labelledby={`${sectionIds.booking}-title`}>
      <Container size="narrow">
        <Reveal amount={0.4} className="flex flex-col items-center gap-6 text-center">
          <m.div variants={fadeInUp}>
            <Heading id={`${sectionIds.booking}-title`} size="title-1">
              Pronto para o próximo corte?
            </Heading>
          </m.div>

          <m.div variants={fadeInUp}>
            <Text size="lead" tone="muted" className="scroll-reveal max-w-text">
              Escolha o dia e o horário no nosso agendamento online.
            </Text>
          </m.div>

          <m.div variants={fadeInUp} className="mt-4 flex w-full flex-col items-center gap-4">
            <BookingButton size="lg" className="w-full sm:w-auto" />
          </m.div>
        </Reveal>
      </Container>
    </Section>
  )
}
