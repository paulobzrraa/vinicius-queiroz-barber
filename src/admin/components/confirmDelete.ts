/** Pede confirmação antes de uma exclusão. Retorna true se o usuário confirmou. */
export function confirmDelete(what: string): boolean {
  return window.confirm(`Tem certeza que deseja excluir ${what}? Esta ação não pode ser desfeita.`)
}
