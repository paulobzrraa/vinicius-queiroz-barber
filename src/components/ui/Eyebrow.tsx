import type { HTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

/** Rótulo curto em caixa alta acima de um título (ex.: cidade, categoria). */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-eyebrow text-muted uppercase', className)} {...props} />
}
