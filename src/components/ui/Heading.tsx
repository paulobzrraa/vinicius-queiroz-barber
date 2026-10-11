import type { ElementType, HTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

type HeadingSize = 'display' | 'title-1' | 'title-2' | 'title-3' | 'title-4'
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p'

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Elemento semântico. O tamanho segue o nível, a menos que `size` seja informado. */
  as?: HeadingTag
  size?: HeadingSize
}

const sizes: Record<HeadingSize, string> = {
  display: 'text-display',
  'title-1': 'text-title-1',
  'title-2': 'text-title-2',
  'title-3': 'text-title-3',
  'title-4': 'text-title-4',
}

const sizeByTag: Record<HeadingTag, HeadingSize> = {
  h1: 'title-1',
  h2: 'title-2',
  h3: 'title-3',
  h4: 'title-4',
  p: 'title-4',
}

/**
 * Título na escala da marca. Separa a hierarquia do documento (`as`) do
 * tamanho visual (`size`): um h1 pode usar `display` no Hero, por exemplo.
 */
/** Nos tamanhos grandes o título ganha o acabamento de metal escovado (text-chrome). */
const chromeSizes = new Set<HeadingSize>(['display', 'title-1', 'title-2'])

export function Heading({ as = 'h2', size, className, ...props }: HeadingProps) {
  const Tag: ElementType = as
  const resolvedSize = size ?? sizeByTag[as]

  return (
    <Tag
      className={cn(
        'scroll-title font-display text-balance',
        sizes[resolvedSize],
        chromeSizes.has(resolvedSize) && 'text-chrome',
        className,
      )}
      {...props}
    />
  )
}
