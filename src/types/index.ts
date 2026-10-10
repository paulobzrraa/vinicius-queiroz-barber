/**
 * Tipos compartilhados que não vêm do banco (ver src/lib/database.types.ts
 * para os tipos das tabelas do Supabase). Hoje só a navegação, que continua
 * estática — não é editável pelo admin.
 */

export interface NavItem {
  label: string
  /** Ancora da secao na pagina, ex.: `#galeria`. */
  href: `#${string}`
}
