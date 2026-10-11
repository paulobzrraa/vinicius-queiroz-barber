import { m } from 'motion/react'

import { easing, sealDraw as SEAL_DRAW } from '@/animations'

interface StatusSealProps {
  /** success = check; canceled = X. Mesmo desenho e ritmo, para as duas telas parecerem irmãs. */
  variant: 'success' | 'canceled'
  animated: boolean
}

/**
 * Selo de status: o anel desenha a volta, o disco enche (a inversão da marca:
 * branco no escuro, preto no claro) e o símbolo (check ou X) se traça por
 * cima; um segundo anel se dissolve para fora como um "pulso". Só opacity,
 * transform e traço SVG — e quem prefere menos movimento recebe o selo pronto.
 */
export function StatusSeal({ variant, animated }: StatusSealProps) {
  const initial = animated ? 'hidden' : false

  const strokes =
    variant === 'success' ? ['M30 49.5 43 62.5 67 36'] : ['M36 36 60 60', 'M60 36 36 60']

  return (
    <div className="relative size-24">
      {animated && (
        <m.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-accent"
          initial={{ opacity: 0.5, transform: 'scale(1)' }}
          animate={{ opacity: 0, transform: 'scale(1.7)' }}
          transition={{ duration: 1.1, delay: SEAL_DRAW + 0.35, ease: easing.out }}
        />
      )}

      <svg viewBox="0 0 96 96" fill="none" aria-hidden="true" className="relative size-full">
        <m.circle
          cx="48"
          cy="48"
          r="45"
          strokeWidth="2"
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          className="fill-accent stroke-accent"
          initial={initial}
          animate="visible"
          variants={{
            hidden: { pathLength: 0, fillOpacity: 0 },
            visible: {
              pathLength: 1,
              fillOpacity: 1,
              transition: {
                pathLength: { duration: SEAL_DRAW, ease: easing.inOut },
                fillOpacity: { duration: 0.3, delay: SEAL_DRAW - 0.1, ease: 'easeOut' },
              },
            },
          }}
        />
        {strokes.map((d, index) => (
          <m.path
            key={d}
            d={d}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-accent-foreground"
            initial={initial}
            animate="visible"
            variants={{
              hidden: { pathLength: 0 },
              visible: {
                pathLength: 1,
                transition: {
                  duration: variant === 'success' ? 0.35 : 0.2,
                  delay: SEAL_DRAW + 0.1 + index * 0.15,
                  ease: easing.out,
                },
              },
            }}
          />
        ))}
      </svg>
    </div>
  )
}
