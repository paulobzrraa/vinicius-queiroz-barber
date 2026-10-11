import { ChevronLeft, ChevronRight, Scissors } from 'lucide-react'
import { motion } from 'motion/react'

import { fadeInUp } from '@/animations'
import { Card, Container, Heading, IconButton, Reveal, Section, Text } from '@/components/ui'
import { sectionIds } from '@/data'
import { useCarousel } from '@/hooks/useCarousel'
import { type ServiceRow, useActiveServices } from '@/queries/services'
import { cn } from '@/utils/cn'
import { formatBRL } from '@/utils/currency'

function ServiceCard({ service }: { service: ServiceRow }) {
  return (
    <Card className="group flex h-full flex-col transition-control hover:border-border-strong hover:bg-surface-raised hover:shadow-elevated">
      <div className="flex items-start justify-between gap-4">
        <Scissors
          aria-hidden="true"
          className="size-6 text-muted transition-control group-hover:text-foreground motion-safe:group-hover:rotate-12"
        />
        {service.price != null && (
          <Text size="small" className="font-semibold whitespace-nowrap">
            {formatBRL(service.price)}
          </Text>
        )}
      </div>

      <Heading as="h3" size="title-4" className="mt-6">
        {service.name}
      </Heading>
      <Text size="small" tone="muted" className="mt-2">
        {service.description}
      </Text>
      <Text size="caption" tone="muted" className="mt-auto pt-4">
        {service.duration_minutes} min
      </Text>
    </Card>
  )
}

/**
 * Carousel com os principais serviços da barbearia (lógica em useCarousel,
 * a mesma dos Depoimentos) — em vez de um grid, pra não empilhar a página
 * toda quando há muitos serviços cadastrados. Nome, descrição e preço vêm do
 * admin; o preço só aparece quando o serviço tiver um.
 *
 * A lista fica vazia até a barbearia confirmar serviços e preços reais — a
 * seção some da página nesse meio-tempo, em vez de mostrar cards fictícios.
 * Sem autoplay: diferente de um depoimento, o cliente decide o próprio ritmo
 * pra olhar os serviços.
 */
export function Services() {
  const { data: services } = useActiveServices()
  const total = services?.length ?? 0
  const { trackRef, index, scrollToIndex, next, prev, canPrev, canNext, pauseHandlers } =
    useCarousel({ itemCount: total })

  if (!services || services.length === 0) return null

  return (
    <Section id={sectionIds.services} topDivider aria-labelledby={`${sectionIds.services}-title`}>
      <Container>
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <Heading id={`${sectionIds.services}-title`} className="text-center sm:col-start-2">
            Serviços
          </Heading>

          {total > 1 && (
            <div className="hidden shrink-0 items-center gap-2 sm:col-start-3 sm:flex sm:justify-self-end">
              <IconButton aria-label="Serviço anterior" onClick={prev} disabled={!canPrev}>
                <ChevronLeft />
              </IconButton>
              <IconButton aria-label="Próximo serviço" onClick={next} disabled={!canNext}>
                <ChevronRight />
              </IconButton>
            </div>
          )}
        </div>

        <Reveal amount={0.4}>
          <motion.div variants={fadeInUp} className="mt-block" {...pauseHandlers}>
            <ul
              ref={trackRef}
              role="region"
              aria-roledescription="carousel"
              aria-label="Serviços"
              className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth"
            >
              {services.map((service, i) => (
                <li
                  key={service.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} de ${total}`}
                  className="w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[30%]"
                >
                  <ServiceCard service={service} />
                </li>
              ))}
            </ul>

            <span className="sr-only" aria-live="polite">
              Serviço {index + 1} de {total}
            </span>

            {total > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                {services.map((service, i) => (
                  <button
                    key={service.id}
                    type="button"
                    aria-label={`Ir para o serviço ${i + 1}`}
                    aria-current={i === index}
                    onClick={() => scrollToIndex(i)}
                    className={cn(
                      'size-2 rounded-full transition-control',
                      i === index ? 'bg-foreground' : 'bg-border-strong hover:bg-muted',
                    )}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </Reveal>
      </Container>
    </Section>
  )
}
