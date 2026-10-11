import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HERO_FOCUS,
  HERO_PHOTO_BASE_SCALE,
  heroFocusStyle,
  heroPhotoOverflow,
  panHeroFocus,
  parseHeroFocus,
} from './heroPhoto'

// Foto do Hero (pôster) e uma tela desktop 16:10, como na prévia do admin.
const photo = { width: 996, height: 1331 }
const desktop = { width: 1440, height: 900 }

describe('parseHeroFocus', () => {
  it('usa o padrão quando o valor do banco não é um objeto', () => {
    expect(parseHeroFocus(null)).toEqual(DEFAULT_HERO_FOCUS)
    expect(parseHeroFocus('x')).toEqual(DEFAULT_HERO_FOCUS)
  })

  it('mantém valores válidos e limita os fora da faixa', () => {
    expect(parseHeroFocus({ x: 30, y: 120, zoom: 9 })).toEqual({ x: 30, y: 100, zoom: 3 })
    expect(parseHeroFocus({ x: -5, y: 40, zoom: 0.2 })).toEqual({ x: 0, y: 40, zoom: 1 })
  })

  it('cai no padrão campo a campo quando um valor não é número', () => {
    expect(parseHeroFocus({ x: 'meio', y: 20 })).toEqual({ x: 50, y: 20, zoom: 1 })
  })
})

describe('heroFocusStyle', () => {
  it('no padrão, mantém o enquadramento antigo (centro + escala 110%)', () => {
    expect(heroFocusStyle(DEFAULT_HERO_FOCUS)).toEqual({
      objectPosition: '50% 50%',
      transformOrigin: '50% 50%',
      transform: `scale(${HERO_PHOTO_BASE_SCALE})`,
    })
  })

  it('aplica o zoom sobre a escala base e ancora na posição escolhida', () => {
    const style = heroFocusStyle({ x: 20, y: 80, zoom: 2 })
    expect(style.objectPosition).toBe('20% 80%')
    expect(style.transformOrigin).toBe('20% 80%')
    expect(style.transform).toBe(`scale(${HERO_PHOTO_BASE_SCALE * 2})`)
  })
})

describe('heroPhotoOverflow', () => {
  it('no zoom padrão, a foto retrato sobra nos dois eixos (horizontal = frame - frame/escala base)', () => {
    const overflow = heroPhotoOverflow(photo, desktop, 1)
    expect(overflow.x).toBeCloseTo(1440 - 1440 / HERO_PHOTO_BASE_SCALE, 5)
    expect(overflow.y).toBeGreaterThan(overflow.x)
  })

  it('a folga cresce com o zoom', () => {
    const near = heroPhotoOverflow(photo, desktop, 1)
    const far = heroPhotoOverflow(photo, desktop, 2)
    expect(far.x).toBeGreaterThan(near.x)
    expect(far.y).toBeGreaterThan(near.y)
  })
})

describe('panHeroFocus', () => {
  it('arrastar para a direita mostra a parte esquerda da foto (x diminui)', () => {
    const next = panHeroFocus(DEFAULT_HERO_FOCUS, { dx: 40, dy: 0 }, photo, desktop)
    expect(next.x).toBeLessThan(50)
    expect(next.y).toBe(50)
  })

  it('arrastar para baixo mostra a parte de cima da foto (y diminui)', () => {
    const next = panHeroFocus(DEFAULT_HERO_FOCUS, { dx: 0, dy: 60 }, photo, desktop)
    expect(next.y).toBeLessThan(50)
    expect(next.x).toBe(50)
  })

  it('a foto acompanha o ponteiro: arrastar a folga inteira leva ao canto', () => {
    const overflowX = heroPhotoOverflow(photo, desktop, 1).x
    const next = panHeroFocus(
      DEFAULT_HERO_FOCUS,
      { dx: overflowX * HERO_PHOTO_BASE_SCALE, dy: 0 },
      photo,
      desktop,
    )
    expect(next.x).toBeCloseTo(0, 5)
  })

  it('não passa de 0 nem de 100', () => {
    const left = panHeroFocus(DEFAULT_HERO_FOCUS, { dx: 9999, dy: 0 }, photo, desktop)
    const right = panHeroFocus(DEFAULT_HERO_FOCUS, { dx: -9999, dy: 0 }, photo, desktop)
    expect(left.x).toBe(0)
    expect(right.x).toBe(100)
  })

  it('uma foto quadrada numa moldura quadrada também corre (a escala base deixa folga)', () => {
    const square = { width: 1000, height: 1000 }
    const next = panHeroFocus(DEFAULT_HERO_FOCUS, { dx: -30, dy: 0 }, square, square)
    expect(next.x).toBeGreaterThan(50)
  })
})
