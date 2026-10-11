import type { Variants } from 'motion/react'

import { duration, easing, revealOffset, sealContentDelay, staggerInterval } from './tokens'

/*
 * Variants reutilizáveis. Animam só opacity e transform, e usam `transform`
 * como string (não `x`/`y`), o que permite ao Motion rodar a animação fora
 * da thread principal.
 */

const reveal = { duration: duration.reveal, ease: easing.out }

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: reveal },
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, transform: `translateY(${revealOffset}px)` },
  visible: { opacity: 1, transform: 'translateY(0px)', transition: reveal },
}

/** Entrada de fotos: assenta de um leve zoom, em vez de só subir como um card de texto. */
export const imageReveal: Variants = {
  hidden: { opacity: 0, transform: 'scale(1.08) translateY(16px)' },
  visible: { opacity: 1, transform: 'scale(1) translateY(0px)', transition: reveal },
}

/** Entrada do emblema do Hero: assenta de um leve recuo de escala, sem sair do lugar. */
export const badgeReveal: Variants = {
  hidden: { opacity: 0, transform: 'scale(0.92)' },
  visible: {
    opacity: 1,
    transform: 'scale(1)',
    transition: { duration: 0.9, ease: easing.out },
  },
}

/** Container que dispara os filhos em sequência. Os filhos usam os variants acima. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: staggerInterval } },
}

/** Conteúdo que entra depois do selo de status, em sequência (filhos usam fadeInUp). */
export const sealContent: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: sealContentDelay, staggerChildren: 0.08 } },
}
