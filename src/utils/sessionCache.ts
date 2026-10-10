/**
 * Cache em sessionStorage (vive só na aba aberta, some ao fechá-la) para o
 * cliente não se perder ao recarregar ou voltar na jornada. Todo acesso é
 * protegido: em aba privada ou com dados bloqueados o storage pode lançar
 * erro, e a navegação segue sem cache. `ttlMs` descarta entradas velhas.
 */
interface Entry<T> {
  savedAt: number
  value: T
}

export function readSession<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as Entry<T>
    if (Date.now() - entry.savedAt > ttlMs) {
      window.sessionStorage.removeItem(key)
      return null
    }
    return entry.value
  } catch {
    return null
  }
}

export function writeSession<T>(key: string, value: T): void {
  try {
    const entry: Entry<T> = { savedAt: Date.now(), value }
    window.sessionStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // sem storage: só não guarda
  }
}

export function removeSession(key: string): void {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // idem
  }
}
