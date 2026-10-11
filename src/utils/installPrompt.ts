/**
 * Adicionar o site à tela inicial (PWA). Aqui ficam três coisas: dizer se o aparelho já tem
 * o atalho (para o modal não voltar), guardar o evento de instalação do Android para o botão
 * "Adicionar automaticamente", e descobrir o aparelho para mostrar o passo a passo certo.
 */

export type InstallPlatform = 'ios' | 'ios-other-browser' | 'android' | 'other'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const INSTALLED_KEY = 'vinicius-queiroz-barber:app-installed'
const DISMISSED_KEY = 'vinicius-queiroz-barber:install-dismissed'

// Só o Chrome do Android dispara este evento, e ele pode chegar cedo: o listener nasce junto
// com o módulo, antes de qualquer tela montar.
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Segura o aviso padrão do Chrome: quem chama prompt() é o botão do modal.
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    markInstalled()
    deferred = null
    notify()
  })
}

/** Avisa quando o evento de instalação chega ou o atalho é criado. Devolve a função para cancelar. */
export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function canInstallNatively(): boolean {
  return deferred !== null
}

export function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (isIOS) {
    // No iPhone só o Safari adiciona à tela inicial: os outros navegadores pedem para trocar.
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other-browser' : 'ios'
  }
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** Aberto pelo ícone da tela inicial (ou, no iPhone, a partir do próprio atalho). */
export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function readFlag(key: string, storage: Storage): boolean {
  try {
    return storage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, storage: Storage) {
  try {
    storage.setItem(key, '1')
  } catch {
    // sem storage (aba privada, dados bloqueados): o modal só volta na próxima abertura
  }
}

/** Já tem o atalho: abriu pelo ícone agora, ou já confirmou que adicionou antes. */
export function isInstalled(): boolean {
  return isStandalone() || readFlag(INSTALLED_KEY, window.localStorage)
}

export function markInstalled() {
  writeFlag(INSTALLED_KEY, window.localStorage)
  notify()
}

export function wasDismissedThisSession(): boolean {
  return readFlag(DISMISSED_KEY, window.sessionStorage)
}

export function dismissForThisSession() {
  writeFlag(DISMISSED_KEY, window.sessionStorage)
}

/** Dispara o aviso de instalação do Android. Devolve true se o usuário aceitou. */
export async function installNatively(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  // O evento só pode ser usado uma vez.
  deferred = null
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === 'accepted') markInstalled()
  notify()
  return outcome === 'accepted'
}

/**
 * O Chrome só considera o site instalável com um service worker controlando a página. O worker
 * de push (sw.js) cumpre isso, então registramos no celular mesmo para quem nunca ativou avisos.
 */
export function registerInstallWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    // sem worker: o botão automático some e o passo a passo continua valendo
  })
}
