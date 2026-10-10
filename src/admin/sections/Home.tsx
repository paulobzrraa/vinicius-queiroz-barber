import type { LucideIcon } from 'lucide-react'

interface HomeItem {
  id: string
  label: string
  icon: LucideIcon
}

/** Tela inicial do admin: atalho em grade para cada seção, com ícone e título. */
export function Home({
  items,
  onSelect,
}: {
  items: readonly HomeItem[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className="group flex flex-col items-start gap-4 rounded-card border border-border bg-surface p-card text-left transition-control hover:border-border-strong hover:bg-surface-raised motion-safe:active:scale-99"
        >
          <Icon
            aria-hidden="true"
            className="size-6 text-muted transition-control group-hover:text-foreground"
          />
          <span className="text-small font-semibold">{label}</span>
        </button>
      ))}
    </div>
  )
}
