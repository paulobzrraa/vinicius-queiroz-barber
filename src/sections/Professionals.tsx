import { ChevronLeft, ChevronRight } from 'lucide-react'
import { m } from 'motion/react'

import { fadeInUp } from '@/animations'
import { Container, Heading, IconButton, Reveal, Section, Text } from '@/components/ui'
import { sectionIds } from '@/data'
import { useCarousel } from '@/hooks/useCarousel'
import { type ProfessionalRow, useActiveProfessionals } from '@/queries/professionals'
import { cn } from '@/utils/cn'

/**
 * BL-022: hover no card inteiro (`group`) em vez de só na foto — a foto ganha
 * um zoom sutil (sem vazar do círculo, `overflow-hidden`) e a bio fica mais
 * viva. Nada some por padrão: em touch (sem hover) continua tudo visível, só
 * sem a animação extra. Layout horizontal (foto à esquerda, texto ocupando o
 * resto do card) em vez de empilhado, para a bio ter bem mais espaço — exceto
 * com `centered` (só um profissional cadastrado): aí volta ao layout
 * original, foto acima do texto, tudo centralizado.
 */
function ProfessionalCard({
  professional,
  centered = false,
}: {
  professional: ProfessionalRow
  centered?: boolean
}) {
  return (
    <div
      className={cn(
        'group flex h-full items-center gap-6',
        centered && 'mx-auto max-w-xs flex-col text-center',
      )}
    >
      <div
        className={cn(
          'shrink-0 overflow-hidden rounded-full bg-surface-raised',
          centered ? 'size-32' : 'size-28 sm:size-36',
        )}
      >
        {professional.photo_url ? (
          <img
            src={professional.photo_url}
            alt={professional.name}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-title-3 text-muted">
            {professional.name.charAt(0)}
          </div>
        )}
      </div>

      <div className={cn('min-w-0', centered && 'mt-4')}>
        <Heading as="h3" size="title-4">
          {professional.name}
        </Heading>
        {professional.bio && (
          <Text
            size="small"
            tone="muted"
            className={cn(
              'opacity-75 transition-opacity duration-500 ease-out group-hover:opacity-100',
              centered ? 'mt-1' : 'mt-2',
            )}
          >
            {professional.bio}
          </Text>
        )}
      </div>
    </div>
  )
}

/**
 * BL-092: seção opcional apresentando os profissionais. Só aparece quando há
 * pelo menos um profissional ativo cadastrado — a barbearia ainda não
 * confirmou a equipe real (BL-099), então some da página até então, mesmo
 * princípio das outras seções que dependem de conteúdo confirmado.
 *
 * Carrossel (lógica em useCarousel, a mesma de Serviços/Depoimentos) com
 * exatamente dois profissionais visíveis por vez a partir do breakpoint sm —
 * card mais largo que antes, para caber um layout horizontal com a bio sem
 * apertar. Com um único profissional, não faz sentido ter carrossel: mostra
 * o card sozinho, centralizado, no layout original (ver `centered` em
 * ProfessionalCard).
 */
export function Professionals() {
  const { data: professionals } = useActiveProfessionals()
  const total = professionals?.length ?? 0
  const { trackRef, index, scrollToIndex, next, prev, canPrev, canNext, pauseHandlers } =
    useCarousel({ itemCount: total })

  if (!professionals || professionals.length === 0) return null

  if (total === 1) {
    return (
      <Section id={sectionIds.professionals} aria-labelledby={`${sectionIds.professionals}-title`}>
        <Container>
          <Heading id={`${sectionIds.professionals}-title`} className="text-center">
            Nossa equipe
          </Heading>

          <Reveal amount={0.4}>
            <m.div variants={fadeInUp} className="mt-block">
              <ProfessionalCard professional={professionals[0]} centered />
            </m.div>
          </Reveal>
        </Container>
      </Section>
    )
  }

  return (
    <Section id={sectionIds.professionals} aria-labelledby={`${sectionIds.professionals}-title`}>
      <Container>
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <Heading id={`${sectionIds.professionals}-title`} className="text-center sm:col-start-2">
            Nossa equipe
          </Heading>

          {total > 2 && (
            <div className="hidden shrink-0 items-center gap-2 sm:col-start-3 sm:flex sm:justify-self-end">
              <IconButton aria-label="Profissional anterior" onClick={prev} disabled={!canPrev}>
                <ChevronLeft />
              </IconButton>
              <IconButton aria-label="Próximo profissional" onClick={next} disabled={!canNext}>
                <ChevronRight />
              </IconButton>
            </div>
          )}
        </div>

        <Reveal amount={0.4}>
          <m.div variants={fadeInUp} className="mt-block" {...pauseHandlers}>
            <ul
              ref={trackRef}
              role="region"
              aria-roledescription="carousel"
              aria-label="Nossa equipe"
              className="no-scrollbar flex snap-x snap-mandatory gap-10 overflow-x-auto scroll-smooth"
            >
              {professionals.map((professional, i) => (
                <li
                  key={professional.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} de ${total}`}
                  className="w-full shrink-0 snap-start sm:w-[calc(50%-1.25rem)]"
                >
                  <ProfessionalCard professional={professional} />
                </li>
              ))}
            </ul>

            <span className="sr-only" aria-live="polite">
              Profissional {index + 1} de {total}
            </span>

            {total > 2 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                {professionals.map((professional, i) => (
                  <button
                    key={professional.id}
                    type="button"
                    aria-label={`Ir para o profissional ${i + 1}`}
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
          </m.div>
        </Reveal>
      </Container>
    </Section>
  )
}
