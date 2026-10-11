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

/** Converte graus em radianos (para as funções trigonométricas da sombra). */
const toRad = (deg: number) => (deg * Math.PI) / 180

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
  // Sombra no chão, como a de um disco girando sobre uma superfície: de perfil ela fica
  // quase um traço, e a luz de cima a empurra para o lado oposto ao giro. A penumbra
  // desliza mais que o núcleo, porque está mais longe do ponto de contato. Só
  // transformações, então não re-rasteriza a cada frame.
  const shadowScaleX = useTransform(rotateY, (v) => Math.max(0.15, Math.abs(Math.cos(toRad(v)))))
  const shadowScaleY = useTransform(rotateX, (v) => Math.max(0.45, Math.abs(Math.cos(toRad(v)))))
  const coreX = useTransform(rotateY, (v) => -Math.sin(toRad(v)) * 40)
  const penumbraX = useTransform(rotateY, (v) => -Math.sin(toRad(v)) * 75)
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

  // Cancela a espera e a volta em andamento: o usuário voltou a interagir.
  function stopReturn() {
    clearTimeout(idleTimer.current)
    returning.current.forEach((control) => control.stop())
    returning.current = []
  }

  function turnLogo(event: PointerEvent<HTMLElement>) {
    if (reducedMotion) return
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
            {/* Sombra no chão em duas camadas, sem filtro fixo na imagem: a penumbra larga e suave,
                e por cima um núcleo escuro colado na base da logo. */}
            <m.div
              aria-hidden="true"
              style={{ scaleX: shadowScaleX, scaleY: shadowScaleY, x: penumbraX }}
              className="pointer-events-none absolute inset-x-[2%] -bottom-[10%] h-[24%] rounded-full bg-black/55 blur-2xl"
            />
            <m.div
              aria-hidden="true"
              style={{ scaleX: shadowScaleX, scaleY: shadowScaleY, x: coreX }}
              className="pointer-events-none absolute inset-x-[10%] -bottom-[4%] h-[12%] rounded-full bg-black/90 blur-md"
            />
            <m.img
              src={LOGO_SRC}
              alt=""
              width={600}
              height={600}
              fetchPriority="high"
              style={{ rotateX, rotateY, transformPerspective: 900 }}
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
