/**
 * Junta classes CSS ignorando valores vazios.
 * Nao resolve conflitos entre utilitarios do Tailwind (ex.: px-4 e px-6):
 * quem chama nao deve sobrescrever uma classe que o componente ja define.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
