const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "R$ 40,00" a partir de um valor em reais. Usado em toda exibição de preço/ganho/despesa. */
export function formatBRL(value: number): string {
  return brlFormatter.format(value)
}
