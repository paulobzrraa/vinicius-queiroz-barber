import { ArrowRight, ArrowUpRight, CalendarDays, Scissors } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'

import { Logo } from '@/components/Logo'
import { Button, Card, Container, Eyebrow, Heading, Text } from '@/components/ui'
import { navigation } from '@/data'
import { cn } from '@/utils/cn'

/*
 * Referência visual do design system. Os valores mostrados (cores, tamanhos,
 * larguras) são lidos do navegador, no tom e no viewport atuais: a página
 * nunca fica desatualizada em relação aos tokens.
 */

// ------------------------------------------------------------------ dados

// Principais: as duas cores da logo oficial e o fundo do tom escuro.
const primaryColors = [
  { name: 'Preto da marca', variable: '--gray-900', role: 'Texto da logo' },
  { name: 'Branco', variable: '--white', role: 'Fundo da logo' },
  { name: 'Preto profundo', variable: '--gray-950', role: 'Fundo do tom escuro' },
]

const secondaryColors = [
  { name: 'Gray 850', variable: '--gray-850', role: 'Superfície elevada' },
  { name: 'Gray 800', variable: '--gray-800', role: 'Divisória' },
  { name: 'Gray 700', variable: '--gray-700', role: 'Texto de apoio (claro)' },
  { name: 'Gray 600', variable: '--gray-600', role: 'Borda de controle' },
  { name: 'Gray 500', variable: '--gray-500', role: 'Borda de controle (claro)' },
  { name: 'Gray 400', variable: '--gray-400', role: 'Texto de apoio' },
  { name: 'Gray 300', variable: '--gray-300', role: 'Escala' },
  { name: 'Gray 200', variable: '--gray-200', role: 'Divisória (claro)' },
  { name: 'Gray 100', variable: '--gray-100', role: 'Hover do destaque' },
  { name: 'Gray 50', variable: '--gray-50', role: 'Texto / superfície (claro)' },
]

const semanticColors = [
  { token: 'background', className: 'bg-background' },
  { token: 'surface', className: 'bg-surface' },
  { token: 'surface-raised', className: 'bg-surface-raised' },
  { token: 'border', className: 'bg-border' },
  { token: 'border-strong', className: 'bg-border-strong' },
  { token: 'foreground', className: 'bg-foreground' },
  { token: 'muted', className: 'bg-muted' },
  { token: 'accent', className: 'bg-accent' },
  { token: 'accent-hover', className: 'bg-accent-hover' },
  { token: 'accent-foreground', className: 'bg-accent-foreground' },
]

const typeScale = [
  { token: 'display', className: 'text-display', sample: 'Vinicius Queiroz Barber' },
  { token: 'title-1', className: 'text-title-1', sample: 'Título de página' },
  { token: 'title-2', className: 'text-title-2', sample: 'Título de seção' },
  { token: 'title-3', className: 'text-title-3', sample: 'Subtítulo de seção' },
  { token: 'title-4', className: 'text-title-4', sample: 'Título de card' },
  {
    token: 'lead',
    className: 'text-lead',
    sample: 'Texto de abertura das seções, um pouco maior que o corpo de texto.',
  },
  {
    token: 'body',
    className: 'text-body',
    sample: 'Corpo de texto em 17px, com entrelinha confortável para leitura no celular.',
  },
  { token: 'small', className: 'text-small', sample: 'Texto secundário, botões e navegação.' },
  { token: 'caption', className: 'text-caption', sample: 'Legendas e informações de apoio.' },
  { token: 'eyebrow', className: 'text-eyebrow uppercase', sample: 'Rótulo de seção' },
]

const buttonVariants = ['primary', 'secondary', 'outline', 'ghost'] as const
const buttonSizes = ['sm', 'md', 'lg'] as const

const spacingTokens = [
  { token: 'gutter', className: 'w-gutter', use: 'Respiro lateral da página' },
  { token: 'card', className: 'w-card', use: 'Respiro interno dos cards' },
  { token: 'block', className: 'w-block', use: 'Entre o título e o conteúdo' },
  { token: 'section', className: 'w-section', use: 'Entre seções' },
]

const containerTokens = [
  { token: 'text', className: 'max-w-text', use: '42rem: texto corrido (~70 caracteres)' },
  { token: 'narrow', className: 'max-w-narrow', use: '56rem: blocos centralizados' },
  { token: 'content', className: 'max-w-content', use: '80rem: largura padrão' },
  { token: 'wide', className: 'max-w-wide', use: '100rem: galerias e imagens' },
]

const breakpoints = [
  { name: 'base', from: '0', widths: '320' },
  { name: 'xs', from: '375px', widths: '375, 390, 430' },
  { name: 'sm', from: '640px', widths: 'celular deitado' },
  { name: 'md', from: '768px', widths: '768, 820' },
  { name: 'lg', from: '1024px', widths: '1024' },
  { name: 'xl', from: '1280px', widths: '1280, 1440' },
  { name: '2xl', from: '1536px', widths: 'monitores grandes' },
  { name: '3xl', from: '1920px', widths: '1920' },
]

const states = [
  ['Hover', 'Troca de cor em 200ms (ease). Só em aparelhos com mouse.'],
  ['Pressionar', 'Botões encolhem para 97% em 160ms (ease-out); cards para 99%.'],
  ['Foco', 'Contorno de 2px na cor de destaque, só na navegação por teclado.'],
  ['Movimento reduzido', 'Sem deslocamentos nem escala; ficam só as trocas de cor.'],
  ['Desabilitado', '40% de opacidade e sem interação.'],
]

// ----------------------------------------------------- leitura de valores

/** Lê um valor calculado pelo navegador no elemento, no tom e no viewport atuais. */
function useComputedValue(read: (el: HTMLElement) => string) {
  const [value, setValue] = useState('')
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (el) setValue(read(el))
    },
    [read],
  )
  return [ref, value] as const
}

function toHex(color: string) {
  const [r, g, b] = color.match(/[\d.]+/g)?.map(Number) ?? []
  if (r === undefined || g === undefined || b === undefined) return color
  return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
}

const readBackground = (el: HTMLElement) => toHex(getComputedStyle(el).backgroundColor)

const readWidth = (el: HTMLElement) => `${Math.round(el.getBoundingClientRect().width)}px`

function readType(el: HTMLElement) {
  const style = getComputedStyle(el)
  const size = parseFloat(style.fontSize)
  const leading = style.lineHeight.endsWith('px')
    ? parseFloat(style.lineHeight) / size
    : parseFloat(style.lineHeight)
  const tracking = style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing) / size
  return `${Math.round(size)}px · peso ${style.fontWeight} · entrelinha ${leading.toFixed(2)} · tracking ${tracking.toFixed(3)}em`
}

// ------------------------------------------------------------ blocos base

function DocSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="border-t border-border py-block">
      <Container>
        <Heading as="h2" size="title-3">
          {title}
        </Heading>
        {description && (
          <Text tone="muted" className="mt-3 max-w-text">
            {description}
          </Text>
        )}
        <div className="mt-10">{children}</div>
      </Container>
    </section>
  )
}

/** Mostra o mesmo conteúdo no tom escuro e no claro, lado a lado. */
function BothTones({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="min-w-0 rounded-card border border-border p-card">
        <Text size="caption" tone="muted" className="mb-6">
          Tom escuro (padrão)
        </Text>
        {children}
      </div>
      <div className="min-w-0 rounded-card border border-border tone-light p-card">
        <Text size="caption" tone="muted" className="mb-6">
          Tom claro (Section tone="light")
        </Text>
        {children}
      </div>
    </div>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-caption text-foreground">{children}</code>
}

// ------------------------------------------------------------------ cores

function PaletteSwatch({
  name,
  variable,
  role,
  large = false,
}: {
  name: string
  variable: string
  role: string
  large?: boolean
}) {
  const read = useCallback(
    (el: HTMLElement) => getComputedStyle(el).getPropertyValue(variable).trim(),
    [variable],
  )
  const [ref, hex] = useComputedValue(read)

  return (
    <li className="min-w-0">
      <div
        ref={ref}
        className={cn('rounded-media border border-foreground/10', large ? 'h-32' : 'h-16')}
        style={{ backgroundColor: `var(${variable})` }}
      />
      <p className="mt-3 text-small font-semibold">{name}</p>
      <p className="text-caption text-muted">
        {role} · {hex}
      </p>
    </li>
  )
}

function SemanticSwatch({ token, className }: { token: string; className: string }) {
  const [ref, hex] = useComputedValue(readBackground)

  return (
    <li className="flex min-w-0 items-center gap-3">
      <span
        ref={ref}
        className={cn('size-10 shrink-0 rounded-full border border-foreground/15', className)}
      />
      <span className="min-w-0">
        <Code>{token}</Code>
        <span className="block text-caption text-muted">{hex}</span>
      </span>
    </li>
  )
}

// ------------------------------------------------------------- tipografia

function TypeRow({
  token,
  className,
  sample,
}: {
  token: string
  className: string
  sample: string
}) {
  const [ref, metrics] = useComputedValue(readType)

  return (
    <div className="grid gap-3 py-6 lg:grid-cols-[14rem_1fr] lg:gap-8">
      <div>
        <Code>text-{token}</Code>
        <p className="mt-1 text-caption text-muted">{metrics}</p>
      </div>
      <p ref={ref} className={cn('min-w-0', className)}>
        {sample}
      </p>
    </div>
  )
}

// ------------------------------------------------------ espaço e larguras

function MeasuredBar({
  label,
  use,
  className,
  stacked = false,
}: {
  label: string
  use: string
  className: string
  /** Barra abaixo do rótulo, na largura toda: para medir larguras máximas sem a coluna limitar. */
  stacked?: boolean
}) {
  const [ref, width] = useComputedValue(readWidth)

  return (
    <li
      className={cn('grid gap-2', !stacked && 'sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-8')}
    >
      <div>
        <Code>{label}</Code>
        <p className="text-caption text-muted">
          {use} · agora {width}
        </p>
      </div>
      <div ref={ref} className={cn('h-2 rounded-full bg-accent', className)} />
    </li>
  )
}

function BreakpointBadge() {
  return (
    <span className="font-semibold text-foreground">
      <span className="xs:hidden">base</span>
      <span className="hidden xs:inline sm:hidden">xs</span>
      <span className="hidden sm:inline md:hidden">sm</span>
      <span className="hidden md:inline lg:hidden">md</span>
      <span className="hidden lg:inline xl:hidden">lg</span>
      <span className="hidden xl:inline 2xl:hidden">xl</span>
      <span className="hidden 2xl:inline 3xl:hidden">2xl</span>
      <span className="hidden 3xl:inline">3xl</span>
    </span>
  )
}

// ------------------------------------------------------------------ página

export function DesignSystemPreview() {
  const interFont = new URLSearchParams(window.location.search).get('fonte') === 'inter'

  return (
    <>
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between gap-4">
          <span className="text-title-4">Vinicius Queiroz Barber</span>
          <span className="text-caption text-muted">
            breakpoint <BreakpointBadge />
          </span>
        </Container>
      </header>

      <main>
        <Container className="py-block">
          <Eyebrow>Design System</Eyebrow>
          <Heading as="h1" className="mt-4">
            Tokens e componentes
          </Heading>
          <Text size="lead" tone="muted" className="mt-6 max-w-text">
            Referência visual da Vinicius Queiroz Barber. Esta página só existe em desenvolvimento e não entra
            no build de produção.
          </Text>
          <Text size="small" tone="muted" className="mt-4 max-w-text">
            {interFont ? 'Mostrando a Inter, como Android e Windows veem. ' : ''}A fonte é o SF Pro
            em aparelhos Apple e a Inter nos demais.{' '}
            <a className="link" href={interFont ? '?' : '?fonte=inter'}>
              {interFont ? 'Voltar para a fonte do sistema' : 'Ver com a Inter'}
            </a>
          </Text>
        </Container>

        <DocSection
          id="logo"
          title="Logo"
          description="Uma imagem só, pintada com a cor do texto do tom: branca no escuro, preta (#191919) no claro. O arquivo veio da foto de perfil do Instagram, que só existe em 150px; um original em alta resolução melhora a nitidez nos tamanhos grandes."
        >
          <BothTones>
            <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
              {['h-8', 'h-10', 'h-14'].map((height) => (
                <div key={height}>
                  <Logo className={height} />
                  <p className="mt-3 text-caption text-muted">{height}</p>
                </div>
              ))}
            </div>
          </BothTones>
        </DocSection>

        <DocSection
          id="cores"
          title="Cores"
          description="A paleta vem da logo oficial, que é preto e branco, sem nenhuma cor. Por isso o destaque é a inversão: branco no tom escuro, preto no claro."
        >
          <Text size="small" tone="muted" className="mb-4">
            Principais
          </Text>
          <ul className="grid gap-4 sm:grid-cols-3">
            {primaryColors.map((color) => (
              <PaletteSwatch key={color.variable} large {...color} />
            ))}
          </ul>

          <Text size="small" tone="muted" className="mt-10 mb-4">
            Secundárias
          </Text>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {secondaryColors.map((color) => (
              <PaletteSwatch key={color.variable} {...color} />
            ))}
          </ul>

          <Text size="small" tone="muted" className="mt-10 mb-4">
            Tokens semânticos (é o que os componentes usam)
          </Text>
          <BothTones>
            <ul className="grid gap-4 xs:grid-cols-2">
              {semanticColors.map((color) => (
                <SemanticSwatch key={color.token} {...color} />
              ))}
            </ul>
          </BothTones>
        </DocSection>

        <DocSection
          id="tipografia"
          title="Tipografia"
          description="Títulos pesados com tracking negativo, que aperta conforme o tamanho cresce. Os tamanhos são fluidos entre o celular e o desktop; os valores abaixo são os do viewport atual."
        >
          <div className="divide-y divide-border">
            {typeScale.map((type) => (
              <TypeRow key={type.token} {...type} />
            ))}
          </div>
        </DocSection>

        <DocSection
          id="botoes"
          title="Botões"
          description="Pílulas em quatro variantes e três tamanhos. O ícone depois do texto desliza no hover."
        >
          <BothTones>
            <div className="flex flex-col gap-6">
              {buttonVariants.map((variant) => (
                <div key={variant} className="flex flex-wrap items-center gap-3">
                  <Code>{variant}</Code>
                  {buttonSizes.map((size) => (
                    <Button key={size} variant={variant} size={size}>
                      Botão {size}
                    </Button>
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" iconEnd={<ArrowRight />}>
                  Agendar horário
                </Button>
                <Button variant="secondary" iconStart={<CalendarDays />}>
                  Ver horários
                </Button>
                <Button variant="outline" disabled>
                  Desabilitado
                </Button>
              </div>
            </div>
          </BothTones>
        </DocSection>

        <DocSection
          id="links"
          title="Links"
          description="Link no texto é sempre sublinhado. Link de navegação acende no hover e marca a seção atual."
        >
          <BothTones>
            <Text className="max-w-text">
              Um link no meio do texto fica assim:{' '}
              <a className="link" href="#links">
                conheça os serviços
              </a>
              , com sublinhado discreto que ganha a cor de destaque no hover.
            </Text>
            <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {navigation.map((item, index) => (
                <li key={item.href}>
                  <a
                    className="link-nav text-small"
                    href="#links"
                    aria-current={index === 0 ? 'true' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </BothTones>
        </DocSection>

        <DocSection
          id="cards"
          title="Cards"
          description="Superfície com borda e sombra do tom atual. O interativo sobe no hover e responde ao toque."
        >
          <BothTones>
            <ul className="grid gap-4 sm:grid-cols-2">
              <Card as="li">
                <Scissors aria-hidden="true" className="size-6" />
                <Heading as="h3" size="title-4" className="mt-6">
                  Card estático
                </Heading>
                <Text size="small" tone="muted" className="mt-2">
                  Para conteúdo informativo.
                </Text>
              </Card>
              <Card as="li" interactive>
                <ArrowUpRight aria-hidden="true" className="size-6" />
                <Heading as="h3" size="title-4" className="mt-6">
                  Card interativo
                </Heading>
                <Text size="small" tone="muted" className="mt-2">
                  Para conteúdo clicável, com um link dentro.
                </Text>
              </Card>
            </ul>
          </BothTones>
        </DocSection>

        <DocSection id="forma" title="Raios, sombras e proporções">
          <div className="grid gap-10 lg:grid-cols-3">
            <div>
              <Text size="small" tone="muted" className="mb-4">
                Raios
              </Text>
              <div className="flex flex-wrap items-end gap-4">
                <div className="h-11 w-28 rounded-control border border-border-strong bg-surface-raised" />
                <div className="size-24 rounded-card border border-border bg-surface-raised" />
                <div className="size-24 rounded-media border border-border bg-surface-raised" />
              </div>
              <p className="mt-3 text-caption text-muted">
                control (pílula) · card 20px · media 16px
              </p>
            </div>
            <div>
              <Text size="small" tone="muted" className="mb-4">
                Sombras
              </Text>
              <div className="flex flex-wrap gap-4">
                <div className="size-24 rounded-card bg-surface shadow-card" />
                <div className="size-24 rounded-card bg-surface shadow-elevated" />
                <div className="size-24 rounded-card bg-surface shadow-glow" />
              </div>
              <p className="mt-3 text-caption text-muted">card · elevated · glow</p>
            </div>
            <div>
              <Text size="small" tone="muted" className="mb-4">
                Proporções de imagem
              </Text>
              <div className="flex flex-wrap items-end gap-4">
                <div className="aspect-portrait w-16 rounded-media border border-border-strong bg-surface-raised" />
                <div className="aspect-landscape w-24 rounded-media border border-border-strong bg-surface-raised" />
                <div className="aspect-cinema w-32 rounded-media border border-border-strong bg-surface-raised" />
              </div>
              <p className="mt-3 text-caption text-muted">
                portrait 4:5 · landscape 3:2 · cinema 21:9
              </p>
            </div>
          </div>
        </DocSection>

        <DocSection
          id="espacos"
          title="Espaçamentos e larguras"
          description="Espaços de layout fluidos, com bastante respiro. Dentro dos componentes vale a escala de 4px do Tailwind."
        >
          <ul className="flex flex-col gap-6">
            {spacingTokens.map((space) => (
              <MeasuredBar
                key={space.token}
                label={space.token}
                use={space.use}
                className={space.className}
              />
            ))}
          </ul>

          <Text size="small" tone="muted" className="mt-12 mb-6">
            Larguras máximas (Container size)
          </Text>
          <ul className="flex flex-col gap-6">
            {containerTokens.map((container) => (
              <MeasuredBar
                key={container.token}
                label={container.token}
                use={container.use}
                className={cn('w-full', container.className)}
                stacked
              />
            ))}
          </ul>
        </DocSection>

        <DocSection
          id="breakpoints"
          title="Breakpoints"
          description="Mobile first: as classes sem prefixo valem a partir de 320px, e cada prefixo vale do seu início em diante."
        >
          <p className="mb-6 text-small">
            Breakpoint atual: <BreakpointBadge />
          </p>
          <ul className="divide-y divide-border border-y border-border">
            {breakpoints.map((breakpoint) => (
              <li key={breakpoint.name} className="grid grid-cols-3 gap-4 py-3 text-small">
                <Code>{breakpoint.name}</Code>
                <span className="text-muted">a partir de {breakpoint.from}</span>
                <span className="text-muted">{breakpoint.widths}</span>
              </li>
            ))}
          </ul>
        </DocSection>

        <DocSection
          id="estados"
          title="Estados de hover e foco"
          description="Use Tab para percorrer os controles desta página e ver o foco."
        >
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[12rem_1fr]">
            {states.map(([state, description]) => (
              <div key={state} className="contents">
                <dt className="text-small font-semibold">{state}</dt>
                <dd className="text-small text-muted">{description}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button iconEnd={<ArrowRight />}>Primário</Button>
            <Button variant="outline">Contorno</Button>
            <a className="link" href="#estados">
              Link
            </a>
          </div>
        </DocSection>
      </main>
    </>
  )
}
