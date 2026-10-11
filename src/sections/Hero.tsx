import { ChevronDown } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useId } from 'react'

import { badgeReveal, fadeIn, fadeInUp, staggerContainer } from '@/animations'
import logo from '@/assets/brand/logo-color.png'
import { Button, Container, Section } from '@/components/ui'
import { sectionIds } from '@/data'
import { useSiteSettings } from '@/queries/site'

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
 * O emblema colorido (src/assets/brand/logo-color.png) fica no centro, com um
 * halo teal que pulsa devagar e um brilho de cromo que atravessa a marca uma
 * vez ao carregar. Tudo com movimento só quando o usuário permite.
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
        <Container className="row-start-1 flex flex-col items-center justify-center pt-header pb-16 text-center">
          <motion.div variants={badgeReveal} className="relative">
            {/* Halo de luz atrás do emblema: pulsa devagar, só com movimento permitido. */}
            <div
              aria-hidden="true"
              className="absolute inset-[-12%] rounded-full bg-glow-halo motion-safe:animate-glow-pulse"
            />

            {/* Anel elétrico: um aro azul que respira ao redor do emblema. */}
            <div
              aria-hidden="true"
              className="absolute inset-[-4%] rounded-full border border-accent/60 edge-glow motion-safe:animate-edge-pulse"
            />

            {/* Faísca que orbita a borda do emblema (um ponto de luz girando). */}
            <div
              aria-hidden="true"
              className="absolute inset-[-4%] motion-safe:animate-spark-orbit motion-reduce:hidden"
            >
              <span className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-accent shadow-glow" />
            </div>

            <div className="relative overflow-hidden rounded-full">
              <img
                id={`${sectionIds.hero}-title`}
                src={logo}
                alt={site.name}
                width={600}
                height={600}
                fetchPriority="high"
                className="size-56 sm:size-72 lg:size-96"
              />
              {/* Brilho de cromo que atravessa o emblema uma vez ao carregar. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-chrome-sheen motion-safe:animate-chrome-sheen"
              />
            </div>
          </motion.div>

          {/* Faixa de barbearia (listras que deslizam, como o poste) separa o emblema dos botões. */}
          <motion.div
            variants={fadeInUp}
            aria-hidden="true"
            className="mt-10 h-2 w-56 rounded-full pole-band edge-glow motion-safe:animate-pole-slide sm:w-72"
          />

          <motion.div
            variants={fadeInUp}
            className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center"
          >
            <div className="relative">
              {/* Brilho teal atrás da placa principal, fora do recorte para não ser cortado. */}
              <div
                aria-hidden="true"
                className="absolute inset-x-4 top-1/2 -bottom-3 -z-10 rounded-full bg-glow-halo opacity-80 blur-xl"
              />
              <Button href={`#${sectionIds.booking}`} size="lg" className="w-full sm:w-auto">
                Reserve sua cadeira
              </Button>
            </div>

            {/* Divisor ornamental: losango entre dois fios, na horizontal no desktop. */}
            <span aria-hidden="true" className="hidden items-center gap-3 text-accent sm:flex">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-accent" />
              <span className="size-2 rotate-45 border border-accent" />
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-accent" />
            </span>

            <Button
              href={`#${sectionIds.about}`}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              Conheça a casa
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
