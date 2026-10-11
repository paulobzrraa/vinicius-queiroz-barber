import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

/**
 * Faixa de barbearia entre as seções. As listras andam conforme a página rola,
 * então o divisor parece girar no ritmo da leitura, como o poste de verdade.
 */
export function PoleDivider() {
  const reduced = useReducedMotion()
  const { scrollY } = useScroll()
  const offset = useTransform(scrollY, (y) => (reduced ? 0 : y * 0.6))

  return (
    <div
      aria-hidden="true"
      className="mx-gutter my-section-end h-2 overflow-hidden rounded-full edge-glow"
    >
      <motion.div
        style={{ backgroundPositionX: offset }}
        className="size-full pole-band opacity-80"
      />
    </div>
  )
}
