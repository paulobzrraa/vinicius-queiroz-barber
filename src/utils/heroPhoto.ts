import type { CSSProperties } from 'react'

/**
 * Enquadramento da foto de fundo do Hero. Usado pelo site (sections/Hero.tsx) e
 * pela prévia do admin (admin/components/HeroFraming.tsx), para o que o admin
 * ajusta ser exatamente o que aparece no site.
 *
 * A foto é desenhada com object-fit: cover (preenche a tela sem distorcer) e
 * depois ampliada com `transform: scale`, com a origem no próprio ponto de foco.
 * Por isso `x`/`y` funcionam como foco: o trecho da foto nesse ponto continua
 * no mesmo lugar quando se dá zoom.
 */

export interface HeroFocus {
  /** Posição horizontal da foto, em % (0 = esquerda, 100 = direita). */
  x: number
  /** Posição vertical da foto, em % (0 = topo, 100 = base). */
  y: number
  /** Zoom sobre o enquadramento padrão: 1 = padrão, até MAX_HERO_ZOOM. */
  zoom: number
}

export interface PhotoSize {
  width: number
  height: number
}

export const DEFAULT_HERO_FOCUS: HeroFocus = { x: 50, y: 50, zoom: 1 }

export const MAX_HERO_ZOOM = 3

/**
 * Escala fixa que o Hero sempre aplicou à foto (antes era `scale-110`): a folga
 * evita que o parallax mostre a borda da imagem.
 */
export const HERO_PHOTO_BASE_SCALE = 1.1

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Converte o valor vindo do banco (jsonb, sem tipo garantido) num HeroFocus válido. */
export function parseHeroFocus(value: unknown): HeroFocus {
  if (!value || typeof value !== 'object') return DEFAULT_HERO_FOCUS
  const { x, y, zoom } = value as Partial<Record<keyof HeroFocus, unknown>>
  return {
    x: typeof x === 'number' && Number.isFinite(x) ? clamp(x, 0, 100) : DEFAULT_HERO_FOCUS.x,
    y: typeof y === 'number' && Number.isFinite(y) ? clamp(y, 0, 100) : DEFAULT_HERO_FOCUS.y,
    zoom:
      typeof zoom === 'number' && Number.isFinite(zoom)
        ? clamp(zoom, 1, MAX_HERO_ZOOM)
        : DEFAULT_HERO_FOCUS.zoom,
  }
}

/** Estilo da <img> da foto, igual no site e na prévia do admin. */
export function heroFocusStyle(focus: HeroFocus): CSSProperties {
  const origin = `${focus.x}% ${focus.y}%`
  return {
    objectPosition: origin,
    transformOrigin: origin,
    transform: `scale(${HERO_PHOTO_BASE_SCALE * focus.zoom})`,
  }
}

/**
 * Quanto a foto sobra da moldura em cada eixo, em px (antes do transform). É a
 * folga que o arrastar percorre; zero num eixo significa que esse eixo não se mexe.
 */
export function heroPhotoOverflow(photo: PhotoSize, frame: PhotoSize, zoom: number) {
  const cover = Math.max(frame.width / photo.width, frame.height / photo.height)
  const scale = HERO_PHOTO_BASE_SCALE * zoom
  return {
    x: photo.width * cover - frame.width / scale,
    y: photo.height * cover - frame.height / scale,
  }
}

/**
 * Novo foco depois de arrastar a foto `dx`/`dy` px dentro da moldura. A foto
 * acompanha o ponteiro: arrastar para a direita mostra a parte esquerda dela.
 */
export function panHeroFocus(
  focus: HeroFocus,
  delta: { dx: number; dy: number },
  photo: PhotoSize,
  frame: PhotoSize,
): HeroFocus {
  const overflow = heroPhotoOverflow(photo, frame, focus.zoom)
  const scale = HERO_PHOTO_BASE_SCALE * focus.zoom
  const next = { ...focus }
  if (overflow.x > 0) {
    next.x = clamp(focus.x - (delta.dx * 100) / (scale * overflow.x), 0, 100)
  }
  if (overflow.y > 0) {
    next.y = clamp(focus.y - (delta.dy * 100) / (scale * overflow.y), 0, 100)
  }
  return next
}

export function sameHeroFocus(a: HeroFocus, b: HeroFocus) {
  return a.x === b.x && a.y === b.y && a.zoom === b.zoom
}
