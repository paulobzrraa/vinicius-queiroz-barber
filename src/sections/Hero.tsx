import { ChevronDown } from 'lucide-react'
import {
  type AnimationPlaybackControls,
  animate,
  m,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import { type PointerEvent, useEffect, useRef } from 'react'

import { fadeIn, fadeInUp, staggerContainer } from '@/animations'
import { Button, Container, Section } from '@/components/ui'
import { sectionIds } from '@/data'
import { LOGO_SRC } from '@/data/brand'
import { useSiteSettings } from '@/queries/site'
import { type HeroFocus, heroFocusStyle, parseHeroFocus } from '@/utils/heroPhoto'

/**
 * Mola que leva a logo até o ponteiro e de volta ao repouso. Amortecida o
 * suficiente para não passar do alvo: a logo acompanha, sem pular.
 */
const LOGO_FOLLOW = { stiffness: 60, damping: 18 }

/** Sem interação por este tempo (ms), a logo volta à posição original. */
const LOGO_IDLE_DELAY = 2000

/** Duração da volta lenta à posição original (s). */
const LOGO_RETURN = { duration: 1, ease: 'easeInOut' } as const

/** Mola do giro de rolagem: alcança o alvo sem passar dele, então o giro sai liso. */
const SPIN_FOLLOW = { stiffness: 90, damping: 24, mass: 0.8 }

/** Graus que a logo gira por pixel de distância do topo (cerca de 270° ao descer uma tela inteira). */
const SPIN_DEG_PER_PX = 0.3

/**
 * Camada decorativa de fundo. Por padrão não há foto: o fundo é o tratamento
 * gráfico (um brilho assimétrico e um grão sutil). Se o admin enviar uma foto em
 * `hero_image_url`, ela entra com leve parallax, escurecida para o texto
 * continuar legível, com `bg-gradient-scrim-top` reforçando a leitura do header.
 *
 * O deslocamento é um pouco mais devagar que a rolagem (parallax sutil, só
 * `transform` — roda fora da thread principal); desligado para quem prefere
 * menos movimento.
 */
function HeroBackdrop({
  imageUrl,
  desktop,
  mobile,
}: {
  imageUrl: string | null
  desktop: HeroFocus
  mobile: HeroFocus
}) {
  const reducedMotion = useReducedMotion()
  const { scrollY } = useScroll()
  const glowY = useTransform(scrollY, [0, 1000], [0, reducedMotion ? 0 : 70])

  if (imageUrl) {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Uma <img> por tamanho de tela, cada uma com o enquadramento que o admin definiu. O parallax move as duas juntas. */}
        <m.div style={{ y: glowY }} className="absolute inset-0">
          <img
            src={imageUrl}
            alt=""
            style={heroFocusStyle(desktop)}
            className="absolute inset-0 size-full object-cover max-md:hidden"
          />
          <img
            src={imageUrl}
            alt=""
            style={heroFocusStyle(mobile)}
            className="absolute inset-0 size-full object-cover md:hidden"
          />
        </m.div>
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-scrim-top" />
      </div>
    )
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <m.div style={{ y: glowY }} className="absolute inset-0 bg-hero-glow" />
      {/* Grão em imagem de fundo (utilitário `grain`), não um filtro SVG inline: o navegador o rasteriza uma vez. */}
      <div className="absolute inset-0 grain opacity-[0.05]" />
    </div>
  )
}

/**
 * Primeira seção da página. Comunica só o que é certo — sem slogan, endereço,
 * telefone ou preço inventados.
 *
 * Centro: a logo redonda (public/brand/logo-color.webp), que o ponteiro (mouse
 * ou dedo) gira na horizontal e inclina na vertical. Os CTAs ficam na base. O nome
 * da marca vai só num h1 para leitores de tela.
 *
 * Ocupa a tela toda (min-h-dvh); o header fica por cima, transparente, com
 * o próprio degradê de legibilidade (ver Header.tsx). `pt-header` garante
 * que o conteúdo nunca comece colado no header em telas muito baixas.
 */
export function Hero() {
  const { data: site } = useSiteSettings()
  // O ponteiro (mouse ou dedo) percorre o hero inteiro: a posição horizontal dele gira
  // a logo em torno do eixo vertical e a vertical em torno do horizontal, ambas de
  // −180° a 180°. A mola leva a logo até o alvo com um atraso, sem pular. Os valores
  // vivem fora do React, sem re-renderizar.
  const targetY = useMotionValue(0)
  const targetX = useMotionValue(0)
  const rotateY = useSpring(targetY, LOGO_FOLLOW)
  const rotateX = useSpring(targetX, LOGO_FOLLOW)
  // Giro de rolagem: soma-se à inclinação do ponteiro. Só o eixo vertical (a logo gira de lado).
  const spinTarget = useMotionValue(0)
  const spinY = useSpring(spinTarget, SPIN_FOLLOW)
  const turnY = useTransform([rotateY, spinY], (values: number[]) => values[0] + values[1])
  // Brilho atrás da logo: anda na direção do ponteiro (até 18% da largura do halo), cresce e
  // acende mais quanto mais a logo inclina. Vem da mesma mola da rotação, então volta sozinho.
  const tiltRatio = (v: number) => Math.max(-1, Math.min(1, v / 180))
  const glowX = useTransform(rotateY, (v) => `${tiltRatio(v) * 18}%`)
  const glowY = useTransform(rotateX, (v) => `${-tiltRatio(v) * 18}%`)
  const glowLift = useTransform([rotateX, rotateY], (values: number[]) =>
    Math.min(1, Math.hypot(values[0], values[1]) / 180),
  )
  const glowScale = useTransform(glowLift, (t) => 1 + t * 0.15)
  const glowOpacity = useTransform(glowLift, (t) => 0.8 + t * 0.2)
  const reducedMotion = useReducedMotion()
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const returning = useRef<AnimationPlaybackControls[]>([])
  const lastPointer = useRef<{ x: number; y: number } | null>(null)

  // Cancela a espera e a volta em andamento: o usuário voltou a interagir.
  function stopReturn() {
    clearTimeout(idleTimer.current)
    returning.current.forEach((control) => control.stop())
    returning.current = []
  }

  function turnLogo(event: PointerEvent<HTMLElement>) {
    if (reducedMotion) return
    // Ao rolar, o navegador manda pointermove com o mouse parado, e a posição dele dentro do hero
    // muda. Só conta quando o ponteiro de fato saiu do lugar.
    const last = lastPointer.current
    lastPointer.current = { x: event.clientX, y: event.clientY }
    if (last && last.x === event.clientX && last.y === event.clientY) return
    stopReturn()
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))
    targetY.set((x - 0.5) * 360)
    targetX.set((0.5 - y) * 360)
    scheduleReturn()
  }

  // Quando o usuário para (ou sai do hero), espera 3 s e leva a logo de volta à posição
  // original, devagar. Qualquer movimento antes disso reinicia a espera.
  function scheduleReturn() {
    stopReturn()
    idleTimer.current = setTimeout(() => {
      returning.current = [animate(targetY, 0, LOGO_RETURN), animate(targetX, 0, LOGO_RETURN)]
    }, LOGO_IDLE_DELAY)
  }

  // Ao desmontar o Hero, para o temporizador e qualquer volta pendente.
  useEffect(() => stopReturn, [])

  // Rolagem gira a logo conforme a distância do topo. Ao sair do topo sorteia um sentido, e ao
  // voltar ao topo a logo volta ao estado original. Quem prefere menos movimento não tem giro.
  useEffect(() => {
    if (reducedMotion) return
    let direction = 1
    let atTop = true
    function onScroll() {
      const y = window.scrollY
      // Menos de 2px conta como topo (o navegador às vezes para a alguns pixels de distância).
      if (y < 2) {
        atTop = true
        spinTarget.set(0)
        return
      }
      if (atTop) {
        direction = Math.random() < 0.5 ? -1 : 1
        atTop = false
      }
      // Depois de uma tela de distância a logo já saiu da tela: o giro para de crescer.
      spinTarget.set(direction * Math.min(y, window.innerHeight) * SPIN_DEG_PER_PX)
    }
    // Página que carrega já rolada (o navegador restaura a posição): começa do ponto em que está.
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reducedMotion, spinTarget])

  if (!site) return null

  return (
    <Section
      id={sectionIds.hero}
      padded={false}
      aria-labelledby={`${sectionIds.hero}-title`}
      onPointerMove={turnLogo}
      onPointerLeave={scheduleReturn}
      onPointerCancel={scheduleReturn}
      className="relative touch-pan-y overflow-hidden"
    >
      <HeroBackdrop
        imageUrl={site.hero_image_url}
        desktop={parseHeroFocus(site.hero_focus_desktop)}
        mobile={parseHeroFocus(site.hero_focus_mobile)}
      />

      {/* stagger: logo, CTAs e a seta descem em sequência ao carregar a página. */}
      <m.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="relative z-10 grid min-h-dvh grid-cols-1 grid-rows-[1fr_auto]"
      >
        <Container className="row-start-1 flex flex-col items-center justify-center pt-header pb-16 text-center">
          {/* Nome da marca só para leitores de tela: o título visual não aparece no Hero. */}
          <h1 id={`${sectionIds.hero}-title`} className="sr-only">
            {site.name}
          </h1>

          {/* Logo redonda no centro: o ponteiro controla o giro horizontal (360° de borda a borda). Com movimento reduzido, não gira. */}
          <m.div variants={fadeInUp} className="relative">
            <m.div
              aria-hidden="true"
              style={{ x: glowX, y: glowY, scale: glowScale, opacity: glowOpacity }}
              className="absolute inset-[-12%] rounded-full bg-glow-bloom"
            />
            <m.img
              src={LOGO_SRC}
              alt=""
              width={600}
              height={600}
              fetchPriority="high"
              style={{ rotateX, rotateY: turnY, transformPerspective: 900 }}
              className="relative size-72 rounded-full select-none sm:size-80 lg:size-[28rem]"
            />
          </m.div>
          <m.div variants={fadeInUp} className="mt-10 flex w-72 max-w-full flex-col gap-4">
            <div className="relative">
              {/* Brilho teal atrás da placa principal, fora do recorte para não ser cortado. */}
              <div
                aria-hidden="true"
                className="absolute inset-x-4 top-1/2 -bottom-3 -z-10 rounded-full bg-glow-halo opacity-80 blur-xl"
              />
              <Button href={`#${sectionIds.booking}`} size="lg" className="w-full">
                Reservar horário
              </Button>
            </div>

            <Button href={`#${sectionIds.about}`} variant="outline" size="lg" className="w-full">
              Sobre nós
            </Button>
          </m.div>
        </Container>

        {/* Indicação para continuar navegando: só entra com fade, sem loop — nada pulando na tela sem motivo. */}
        <m.a
          href={`#${sectionIds.about}`}
          variants={fadeIn}
          aria-label="Rolar para a próxima seção"
          className="row-start-2 mb-[max(2rem,env(safe-area-inset-bottom))] flex size-11 items-center justify-center justify-self-center rounded-control text-muted transition-control hover:text-foreground"
        >
          <ChevronDown aria-hidden="true" className="size-5" />
        </m.a>
      </m.div>
    </Section>
  )
}
