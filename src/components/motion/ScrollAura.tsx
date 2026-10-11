import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'

/**
 * Luzes de fundo fixas que se deslocam em velocidades diferentes conforme a
 * página rola (paralaxe em camadas). Dão profundidade e um ar de "palco" à
 * página inteira, sem imagem. Só `transform`, e desligado para quem pede menos
 * movimento.
 */
export function ScrollAura() {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const yA = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [-120, 260])
  const yB = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [240, -200])
  const rot = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, 140])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        style={{ y: yA, rotate: rot }}
        className="absolute -top-40 -left-40 size-[38rem] rounded-full bg-glow-halo opacity-70 blur-3xl"
      />
      <motion.div
        style={{ y: yB }}
        className="absolute top-[45%] -right-48 size-[34rem] rounded-full bg-glow-halo opacity-50 blur-3xl"
      />
    </div>
  )
}
