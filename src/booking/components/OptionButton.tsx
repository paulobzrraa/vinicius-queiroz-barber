import { Check } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/utils/cn'

interface OptionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  selected: boolean
  title: string
  subtitle?: string
  /** checkbox (BL-066, vários serviços) ou radio (as demais etapas, uma escolha só). */
  variant?: 'checkbox' | 'radio'
  /** Retrato (profissional): substitui o indicador abstrato pela foto — o
   * selecionado ganha uma marca de check sobre ela, em vez de um círculo à parte. */
  avatarUrl?: string | null
}

/** Cartão selecionável usado nas etapas de escolha do agendamento (serviço, profissional, data, horário). */
export function OptionButton({
  selected,
  title,
  subtitle,
  variant = 'radio',
  avatarUrl,
  disabled,
  className,
  ...props
}: OptionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-4 rounded-control border px-5 py-4 text-left transition-control',
        selected
          ? 'border-border-strong bg-foreground/8'
          : 'border-border hover:border-border-strong hover:bg-foreground/5',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
      {...props}
    >
      {avatarUrl !== undefined ? (
        <span className="relative shrink-0">
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-surface-raised">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-body text-muted">{title.charAt(0)}</span>
            )}
          </span>
          {selected && (
            <span
              aria-hidden="true"
              className="absolute -end-1 -bottom-1 flex size-4.5 items-center justify-center rounded-full border-2 border-surface bg-accent text-accent-foreground"
            >
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
          )}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-5 shrink-0 items-center justify-center border transition-control',
            variant === 'checkbox' ? 'rounded-sm' : 'rounded-full',
            selected ? 'border-accent bg-accent' : 'border-border-strong',
          )}
        >
          {selected && <Check className="size-3.5 text-accent-foreground" strokeWidth={3} />}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold text-foreground">{title}</span>
        {subtitle && <span className="mt-0.5 block text-small text-muted">{subtitle}</span>}
      </span>
    </button>
  )
}
