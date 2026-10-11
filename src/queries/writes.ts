/**
 * Mensagem quando a gravação não atinge nenhuma linha. O Supabase não devolve
 * erro quando a regra de segurança (RLS) bloqueia um UPDATE: a linha simplesmente
 * não é alterada. Sem essa checagem, o formulário mostraria "Salvo." sem salvar.
 */
export const SAVE_DENIED_MESSAGE =
  'Não foi possível salvar. Saia e entre de novo como admin; se continuar, confira se o seu usuário está na tabela admins do Supabase.'

/** Lança erro se um UPDATE com `.select()` não devolveu nenhuma linha. */
export function assertSaved(rows: unknown[] | null): void {
  if (!rows || rows.length === 0) throw new Error(SAVE_DENIED_MESSAGE)
}
