/**
 * Web Push do admin, lado do navegador: o que este aparelho consegue fazer e o
 * estado da assinatura. Nada aqui é segredo: a chave pública VAPID é pública por
 * definição (vem do banco, ver get_push_public_key). As privadas ficam só nos
 * secrets da Edge Function web-push-notify.
 */

export type PushSupport = 'supported' | 'unsupported' | 'needs-home-screen'

export type PushState =
  | { status: 'unsupported' }
  | { status: 'needs-home-screen' }
  | { status: 'not-configured' }
  | { status: 'denied' }
  | { status: 'enabled' }
  | { status: 'disabled' }

export const SERVICE_WORKER_URL = '/sw.js'

function isIosDevice(): boolean {
  const { userAgent, platform, maxTouchPoints } = navigator
  // iPadOS 13+ se identifica como Mac; por isso também checa toque.
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

/** Aberto como app da Tela de Início (iOS não usa "display-mode" como os outros navegadores). */
function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

export function getPushSupport(): PushSupport {
  const hasApis =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (hasApis) return 'supported'
  // No Safari do iPhone/iPad, a API só existe depois de "Adicionar à Tela de Início".
  if (isIosDevice() && !isStandalone()) return 'needs-home-screen'
  return 'unsupported'
}

/** Converte a chave VAPID (base64url) para o formato que pushManager.subscribe pede. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Registro do Service Worker do site (escopo "/"), ou null se ainda não foi registrado. */
async function existingRegistration(): Promise<ServiceWorkerRegistration | null> {
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)
  return registration ?? null
}

/** Estado deste aparelho/navegador: ativado, desativado, bloqueado ou sem suporte. */
export async function getPushState(publicKey: string): Promise<PushState> {
  const support = getPushSupport()
  if (support === 'unsupported') return { status: 'unsupported' }
  if (support === 'needs-home-screen') return { status: 'needs-home-screen' }
  if (!publicKey) return { status: 'not-configured' }
  if (Notification.permission === 'denied') return { status: 'denied' }

  const registration = await existingRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? { status: 'enabled' } : { status: 'disabled' }
}

/**
 * Pede permissão e cria a assinatura neste aparelho. Precisa ser chamada direto
 * do clique do botão: o Safari só mostra o pedido de permissão em resposta a um
 * gesto do usuário, e a chamada a requestPermission tem que vir antes de qualquer await.
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission()
}

export async function subscribeThisDevice(publicKey: string): Promise<PushSubscription> {
  const registration =
    (await existingRegistration()) ??
    (await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' }))
  await navigator.serviceWorker.ready

  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
}

/** Assinatura deste aparelho, se houver (sem criar nada). */
export async function currentDeviceSubscription(): Promise<PushSubscription | null> {
  const registration = await existingRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}
