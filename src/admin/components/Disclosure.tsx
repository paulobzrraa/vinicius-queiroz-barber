import { ChevronDown } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { cn } from '@/utils/cn'

/** Seção que começa fechada e expande ao clicar — reduz o quanto aparece de uma vez em telas com várias seções. */
export function Disclosure({
  label,
  defaultOpen = false,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-start"
      >
        <h4 className="text-small font-semibold text-foreground">{label}</h4>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-muted transition-control', open && 'rotate-180')}
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}
