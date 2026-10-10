import type { ElementType, HTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

type CardTag = 'div' | 'article' | 'li'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardTag
  /**
   * Card clicável: sobe um pouco no hover e responde ao toque. O clique deve
   * vir de um link dentro dele; o card em si não recebe foco.
   */
  interactive?: boolean
}

/** Superfície de conteúdo. Adapta cores e sombras ao tom da seção. */
export function Card({ as = 'div', interactive = false, className, ...props }: CardProps) {
  const Tag: ElementType = as

  return (
    <Tag
      className={cn(
        'rounded-card border border-border bg-surface p-card shadow-card',
        interactive &&
          'transition-control hover:border-border-strong hover:bg-surface-raised hover:shadow-elevated motion-safe:hover:-translate-y-1 motion-safe:active:scale-99',
        className,
      )}
      {...props}
    />
  )
}
