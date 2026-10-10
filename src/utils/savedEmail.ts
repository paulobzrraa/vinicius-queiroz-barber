const KEY = 'vinicius-queiroz-barber:client-email'

/**
 * E-mail do último agendamento, guardado só neste navegador para vir
 * preenchido na próxima vez. Todo acesso ao storage é protegido: em aba
 * privada ou com dados bloqueados ele pode lançar erro, e o fluxo segue sem.
 */
export function loadSavedEmail(): string {
  try {
    return window.localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveEmail(email: string): void {
  try {
    window.localStorage.setItem(KEY, email)
  } catch {
    // sem storage disponível: só não lembra do e-mail
  }
}

export function clearSavedEmail(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // idem
  }
}
