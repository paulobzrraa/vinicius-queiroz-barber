import { motion } from 'motion/react'
import type { ReactNode } from 'react'

import { staggerContainer } from '@/animations'

interface RevealProps {
  as?: 'div' | 'ul'
  /** Fração do elemento visível para disparar a entrada (0 a 1). */
  amount?: number
  className?: string
  children?: ReactNode
}

/**
 * Dispara a entrada dos filhos (fade + stagger) quando o elemento alcança o
 * viewport, uma vez só. Os filhos usam variants próprios (fadeInUp,
 * imageReveal...); este componente só orquestra o "visible" do grupo.
 */
export function Reveal({ as = 'div', amount = 0.2, className, children }: RevealProps) {
  const animation = {
    initial: 'hidden' as const,
    whileInView: 'visible' as const,
    viewport: { once: true, amount },
    variants: staggerContainer,
    className,
    children,
  }

  if (as === 'ul') return <motion.ul {...animation} />
  return <motion.div {...animation} />
}
