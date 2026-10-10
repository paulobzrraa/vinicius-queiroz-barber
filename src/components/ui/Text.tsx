import type { ElementType, HTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

type TextSize = 'lead' | 'body' | 'small' | 'caption'
type TextTone = 'foreground' | 'muted' | 'accent'
type TextTag = 'p' | 'span' | 'div'

interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: TextTag
  size?: TextSize
  /** Cor do texto. Sem `tone`, herda a cor de quem o contém. */
  tone?: TextTone
}

const sizes: Record<TextSize, string> = {
  lead: 'text-lead',
  body: 'text-body',
  small: 'text-small',
  caption: 'text-caption',
}

const tones: Record<TextTone, string> = {
  foreground: 'text-foreground',
  muted: 'text-muted',
  accent: 'text-accent',
}

/** Texto corrido na escala da marca. */
export function Text({ as = 'p', size = 'body', tone, className, ...props }: TextProps) {
  const Tag: ElementType = as

  return <Tag className={cn(sizes[size], tone && tones[tone], className)} {...props} />
}
