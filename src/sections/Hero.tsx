import { ChevronDown } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useId } from 'react'

import { fadeIn, fadeInUp, staggerContainer } from '@/animations'
import logoHero from '@/assets/brand/logo-hero.png'
import { Button, Container, Section } from '@/components/ui'
import { sectionIds } from '@/data'
import { useSiteSettings } from '@/queries/site'

/** Proporção real do PNG (branco, fundo transparente) já recortado nas bordas do conteúdo. */
const LOGO_HERO_ASPECT = 868 / 273

/**
 * Camada decorativa de fundo. Com `hero_image_url` preenchido no admin, é a
 * foto (leve parallax + escurecida para o texto branco continuar legível, com
 * `bg-gradient-scrim-top` reforçando a leitura do header). Sem foto, cai no
 * tratamento gráfico: um brilho assimétrico e um grão fotográfico sutil, para
 * dar profundidade cinematográfica sem depender de imagem — útil até a
 * barbearia ter uma foto real em alta resolução (mínimo ~2400px; as do
 * Instagram oficial vão no máximo a 672px, baixas demais para tela cheia).
 *
 * Em ambos os casos, o deslocamento é um pouco mais devagar que a rolagem
 * (parallax sutil, só `transform` — roda fora da thread principal); desligado
 * para quem prefere menos movimento.
 */
function HeroBackdrop({ imageUrl }: { imageUrl: string | null }) {
  const filterId = useId()
  const reducedMotion = useReducedMotion()
  const { scrollY } = useScroll()
  const glowY = useTransform(scrollY, [0, 1000], [0, reducedMotion ? 0 : 70])

  if (imageUrl) {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.img
          src={imageUrl}
          alt=""
          style={{ y: glowY }}
          className="absolute inset-0 size-full scale-110 object-cover"
        />
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-scrim-top" />
      </div>
    )
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <motion.div style={{ y: glowY }} className="absolute inset-0 bg-hero-glow" />
      <svg className="absolute inset-0 size-full opacity-[0.05]">
        <filter id={filterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves={3}
            stitchTiles="stitch"
          />
          {/* Mantém as letras em branco e usa só o ruído da turbulência como alpha: vira grão. */}
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  )
}

/**
 * Primeira seção da página. Comunica só o que é certo — a marca — sem
 * slogan, endereço, telefone ou preço inventados.
 *
 * A logo aparece como imagem (src/assets/brand/logo-hero.png): um PNG branco,
 * fundo transparente, extraído de uma foto em qualidade bem maior que a do
 * Instagram (1584×672 contra os 384×140 de antes) — suficiente pra o tamanho
 * que ela ocupa aqui sem borrar, mesmo em tela retina.
 *
 * Ocupa a tela toda (min-h-dvh); o header fica por cima, transparente, com
 * o próprio degradê de legibilidade (ver Header.tsx). `pt-header` garante
 * que o conteúdo nunca comece colado no header em telas muito baixas.
 */
export function Hero() {
  const { data: site } = useSiteSettings()
  if (!site) return null

  return (
    <Section
      id={sectionIds.hero}
      padded={false}
      aria-labelledby={`${sectionIds.hero}-title`}
      className="relative overflow-hidden"
    >
      <HeroBackdrop imageUrl={site.hero_image_url} />

      {/* stagger: logo, CTAs e a seta descem em sequência ao carregar a página. */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="relative z-10 grid min-h-dvh grid-rows-[1fr_auto]"
      >
        <Container className="row-start-1 flex flex-col justify-center pt-header pb-16">
          <motion.div variants={fadeInUp}>
            <img
              id={`${sectionIds.hero}-title`}
              src={logoHero}
              alt={site.name}
              style={{ aspectRatio: LOGO_HERO_ASPECT }}
              className="h-16 w-auto sm:h-24 md:h-32 lg:h-40"
            />
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button href={`#${sectionIds.booking}`} size="lg" className="w-full sm:w-auto">
              Agendar horário
            </Button>
            <Button
              href={`#${sectionIds.about}`}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              Conhecer a barbearia
            </Button>
          </motion.div>
        </Container>

        {/* Indicação para continuar navegando: só entra com fade, sem loop — nada pulando na tela sem motivo. */}
        <motion.a
          href={`#${sectionIds.about}`}
          variants={fadeIn}
          aria-label="Rolar para a próxima seção"
          className="row-start-2 mb-[max(2rem,env(safe-area-inset-bottom))] flex size-11 items-center justify-center justify-self-center rounded-control text-muted transition-control hover:text-foreground"
        >
          <ChevronDown aria-hidden="true" className="size-5" />
        </motion.a>
      </motion.div>
    </Section>
  )
}
