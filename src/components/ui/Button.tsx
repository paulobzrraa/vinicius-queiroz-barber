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

/*
 * Botão em forma de placa (classes .plaque em src/styles/utilities.css): canto
 * chanfrado, borda de cromo e rótulo em caixa alta, com brilho no hover. Não é
 * a pílula padrão. Pressionar encolhe a placa; quem prefere menos movimento
 * fica só com a troca de cor.
 */
const base =
  'group plaque inline-flex shrink-0 items-center justify-center gap-3 font-display font-semibold uppercase tracking-[0.2em] whitespace-nowrap select-none motion-safe:active:scale-97 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40'

const variants: Record<ButtonVariant, string> = {
  primary: 'plaque-primary',
  secondary: 'plaque-outline',
  outline: 'plaque-outline',
  ghost: 'text-foreground hover:text-accent',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-10 px-5 text-eyebrow [&_svg]:size-4',
  md: 'h-12 px-6 text-caption [&_svg]:size-4.5',
  lg: 'h-14 px-8 text-small [&_svg]:size-5',
}

function ButtonContent({
  iconStart,
  iconEnd,
  children,
}: ButtonOwnProps & { children?: ReactNode }) {
  return (
    <>
      {iconStart && (
        <span aria-hidden="true" className="flex">
          {iconStart}
        </span>
      )}
      {children}
      {iconEnd && (
        <span
          aria-hidden="true"
          className="flex transition-control motion-safe:group-hover:translate-x-1"
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
