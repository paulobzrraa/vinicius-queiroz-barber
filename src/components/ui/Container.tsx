import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/utils/cn'

type ContainerSize = 'text' | 'narrow' | 'content' | 'wide'

interface ContainerProps extends ComponentPropsWithoutRef<'div'> {
  /** Largura máxima do conteúdo: text (~70 caracteres), narrow, content (padrão) ou wide. */
  size?: ContainerSize
}

const sizes: Record<ContainerSize, string> = {
  text: 'max-w-text',
  narrow: 'max-w-narrow',
  content: 'max-w-content',
  wide: 'max-w-wide',
}

/**
 * Centraliza o conteúdo e aplica o respiro lateral da página. Com `box-content`,
 * a largura máxima vale para o conteúdo, sem descontar o respiro.
 */
export function Container({ size = 'content', className, ...props }: ContainerProps) {
  return <div className={cn('mx-auto box-content px-gutter', sizes[size], className)} {...props} />
}
