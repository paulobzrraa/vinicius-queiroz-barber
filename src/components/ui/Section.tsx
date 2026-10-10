import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/utils/cn'

type SectionTone = 'default' | 'surface' | 'light'

interface SectionProps extends ComponentPropsWithoutRef<'section'> {
  /** Obrigatório: é o alvo das âncoras do menu. Use os valores de `sectionIds`. */
  id: string
  /**
   * Fundo da seção: default (preto), surface (grafite) ou light (off-white).
   * No light, cores de texto, bordas e botões se invertem sozinhas.
   */
  tone?: SectionTone
  /** Espaçamento vertical padrão da seção. Desligue para controlar a altura você mesmo (ex.: um Hero em tela cheia). */
  padded?: boolean
}

const tones: Record<SectionTone, string> = {
  default: '',
  surface: 'bg-surface',
  light: 'tone-light',
}

/** Bloco de seção da landing page, com o espaçamento vertical padrão — o fim é
 * menor que o topo, pra não dobrar o respiro entre uma seção e a próxima. */
export function Section({ tone = 'default', padded = true, className, ...props }: SectionProps) {
  return (
    <section
      className={cn(padded && 'pt-section pb-section-end', tones[tone], className)}
      {...props}
    />
  )
}
