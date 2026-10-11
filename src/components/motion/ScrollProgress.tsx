import { m, useReducedMotion, useScroll, useSpring } from 'motion/react'

/**
 * Barra de progresso no topo: uma faixa teal que cresce conforme a página
 * rola, com brilho. Some para quem prefere menos movimento.
 */
export function ScrollProgress() {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 })

  if (reduced) return null

  return (
    <m.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-accent shadow-glow"
    />
  )
}
