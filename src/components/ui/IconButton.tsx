import type { ComponentPropsWithRef } from 'react'

import { cn } from '@/utils/cn'

interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  /** Nome acessível: o botão não tem texto visível. */
  'aria-label': string
}

/** Botão só com ícone (menu, fechar). Alvo de toque de 44px. */
export function IconButton({ className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-control text-foreground transition-control hover:bg-foreground/8 disabled:opacity-30 disabled:hover:bg-transparent motion-safe:active:scale-95',
        className,
      )}
      {...props}
    />
  )
}
