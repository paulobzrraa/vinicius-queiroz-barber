import type { ComponentPropsWithoutRef } from 'react'

import { PoleDivider } from '@/components/motion/PoleDivider'
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
  /**
   * Faixa de barbearia (PoleDivider) acima da seção, como separador. Fica
   * FORA da seção (tom escuro padrão) e some junto quando a seção não renderiza
   * — então seções que se escondem sem dados nunca deixam um divisor órfão.
   */
  topDivider?: boolean
}

const tones: Record<SectionTone, string> = {
  default: '',
  surface: 'bg-surface',
  light: 'tone-light',
}

/** Bloco de seção da landing page, com o espaçamento vertical padrão — o fim é
 * menor que o topo, pra não dobrar o respiro entre uma seção e a próxima. */
export function Section({
  tone = 'default',
  padded = true,
  topDivider = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <>
      {topDivider && <PoleDivider />}
      <section
        className={cn(padded && 'pt-section pb-section-end', tones[tone], className)}
        {...props}
      >
        {children}
      </section>
    </>
  )
}
