import { cn } from '@/utils/cn'

const bar =
  'absolute top-[calc(50%-1px)] left-0 h-0.5 w-full rounded-full bg-current transition-[translate,rotate] duration-250 ease-out'

/**
 * Ícone do menu: duas barras que viram um X. Com `open`, as barras já nascem
 * cruzadas, mas partem de paralelas (`starting:`): quando o painel abre sobre
 * o header, o botão parece se transformar em vez de trocar de ícone.
 */
export function MenuIcon({ open = false }: { open?: boolean }) {
  return (
    <span aria-hidden="true" className="relative block size-5">
      <span
        className={cn(
          bar,
          open
            ? 'translate-y-0 rotate-45 starting:-translate-y-[3px] starting:rotate-0'
            : '-translate-y-[3px]',
        )}
      />
      <span
        className={cn(
          bar,
          open
            ? 'translate-y-0 -rotate-45 starting:translate-y-[3px] starting:rotate-0'
            : 'translate-y-[3px]',
        )}
      />
    </span>
  )
}
