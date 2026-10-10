import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonOwnProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Ícone antes do texto. */
  iconStart?: ReactNode
  /** Ícone depois do texto. Desliza levemente no hover, indicando direção (setas). */
  iconEnd?: ReactNode
}

type ButtonAsButton = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof ButtonOwnProps> & { href?: undefined }
type ButtonAsLink = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<'a'>, keyof ButtonOwnProps> & { href: string }

export type ButtonProps = ButtonAsButton | ButtonAsLink

// Pressionar encolhe o botão (resposta imediata ao toque); quem prefere menos
// movimento fica só com a troca de cor.
const base =
  'group inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-semibold whitespace-nowrap select-none transition-control motion-safe:active:scale-97 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40'

const variants: Record<ButtonVariant, string> = {
  // O destaque da marca é a inversão: branco no tom escuro, preto no claro.
  primary: 'bg-accent text-accent-foreground hover:bg-accent-hover hover:shadow-glow',
  secondary: 'bg-foreground/10 text-foreground hover:bg-foreground/16',
  outline:
    'border border-border-strong text-foreground hover:border-foreground hover:bg-foreground/5',
  ghost: 'text-foreground hover:bg-foreground/8',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-caption [&_svg]:size-4',
  md: 'h-11 px-5 text-small [&_svg]:size-4.5',
  lg: 'h-14 px-7 text-body [&_svg]:size-5',
}

function ButtonContent({
  iconStart,
  iconEnd,
  children,
}: ButtonOwnProps & { children?: ReactNode }) {
  return (
    <>
      {iconStart && (
        <span aria-hidden="true" className="-ms-0.5 flex">
          {iconStart}
        </span>
      )}
      {children}
      {iconEnd && (
        <span
          aria-hidden="true"
          className="-me-0.5 flex transition-control motion-safe:group-hover:translate-x-0.5"
        >
          {iconEnd}
        </span>
      )}
    </>
  )
}

/** Botão da marca. Renderiza `<a>` quando recebe `href`, senão `<button>`. */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const {
      variant = 'primary',
      size = 'md',
      iconStart,
      iconEnd,
      className,
      children,
      ...rest
    } = props
    return (
      <a className={cn(base, variants[variant], sizes[size], className)} {...rest}>
        <ButtonContent iconStart={iconStart} iconEnd={iconEnd}>
          {children}
        </ButtonContent>
      </a>
    )
  }

  const {
    variant = 'primary',
    size = 'md',
    iconStart,
    iconEnd,
    className,
    children,
    type = 'button',
    ...rest
  } = props
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      <ButtonContent iconStart={iconStart} iconEnd={iconEnd}>
        {children}
      </ButtonContent>
    </button>
  )
}
