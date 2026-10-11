import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { motion } from 'motion/react'

import { fadeInUp } from '@/animations'
import { Card, Container, Heading, IconButton, Reveal, Section, Text } from '@/components/ui'
import { useCarousel } from '@/hooks/useCarousel'
import { type TestimonialRow, useTestimonials } from '@/queries/testimonials'
import { cn } from '@/utils/cn'

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'size-4',
            i < rating ? 'fill-foreground text-foreground' : 'text-border-strong',
          )}
        />
      ))}
    </div>
  )
}

function TestimonialCard({ testimonial }: { testimonial: TestimonialRow }) {
  return (
    <Card className="flex h-full flex-col gap-4">
      <Stars rating={testimonial.rating} />
      <Text size="body" className="flex-1 text-balance">
        “{testimonial.quote}”
      </Text>
      <Text size="small" tone="muted" className="font-semibold">
        {testimonial.client_name}
      </Text>
    </Card>
  )
}

/**
 * BL-023/BL-024: depoimentos reais em carousel (lógica em useCarousel, a
 * mesma de Serviços — sem autoplay: o cliente decide o próprio ritmo). Só
 * aparece quando existe pelo menos um cadastrado — nada de avaliação
 * inventada.
 */
export function Testimonials() {
  const { data: testimonials } = useTestimonials()
  const total = testimonials?.length ?? 0
  const { trackRef, index, scrollToIndex, next, prev, canPrev, canNext, pauseHandlers } =
    useCarousel({ itemCount: total })

  if (!testimonials || testimonials.length === 0) return null

  return (
    <Section id="depoimentos" aria-labelledby="depoimentos-title">
      <Container>
        <div className="flex items-end justify-between gap-4">
          <Heading id="depoimentos-title">O que dizem nossos clientes</Heading>

          {total > 1 && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <IconButton aria-label="Depoimento anterior" onClick={prev} disabled={!canPrev}>
                <ChevronLeft />
              </IconButton>
              <IconButton aria-label="Próximo depoimento" onClick={next} disabled={!canNext}>
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
              aria-label="Depoimentos de clientes"
              className="no-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth"
            >
              {testimonials.map((testimonial, i) => (
                <li
                  key={testimonial.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} de ${total}`}
                  className="w-[85%] shrink-0 snap-start sm:w-[60%] lg:w-[38%]"
                >
                  <TestimonialCard testimonial={testimonial} />
                </li>
              ))}
            </ul>

            <span className="sr-only" aria-live="polite">
              Depoimento {index + 1} de {total}
            </span>

            {total > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                {testimonials.map((testimonial, i) => (
                  <button
                    key={testimonial.id}
                    type="button"
                    aria-label={`Ir para o depoimento ${i + 1}`}
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
