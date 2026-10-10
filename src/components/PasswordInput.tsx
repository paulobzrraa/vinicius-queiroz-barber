import { Eye, EyeOff } from 'lucide-react'
import { type ComponentPropsWithoutRef, useState } from 'react'

import { cn } from '@/utils/cn'

type PasswordInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'>

/**
 * Campo de senha com o olho para mostrar/ocultar o que foi digitado. O
 * `className` vai para o <input> (o mesmo estilo dos outros campos); o botão
 * fica dentro do campo, à direita, com alvo de toque confortável.
 */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={cn(className, 'pe-12')} />
      <button
        type="button"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute end-1.5 top-1/2 mt-0.5 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-control hover:text-foreground"
      >
        <Icon aria-hidden="true" className="size-4.5" />
      </button>
    </div>
  )
}
