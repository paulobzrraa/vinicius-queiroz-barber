// Service Worker das notificações push do admin (Vinicius Queiroz Barber).
// Fica na raiz para ter escopo "/". Não guarda cache nem intercepta páginas:
// só recebe o aviso do servidor e abre a agenda do admin ao tocar nele.
// Não contém segredos: a chave pública VAPID chega pelo navegador, nunca aqui.

const DEFAULT_URL = '/admin/agenda'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Sem cache: o handler só existe para o navegador considerar o site instalável (Android).
// Sem chamar respondWith, cada requisição segue direto para a rede.
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  // Todo evento push precisa virar uma notificação visível (exigência do navegador).
  event.waitUntil(
    self.registration.showNotification(data.title || 'Vinicius Queiroz Barber', {
      body: data.body || '',
      // Mesma marca do site: ícone da logo, sem imagem extra.
      icon: '/apple-touch-icon.png',
      badge: '/favicon-32x32.png',
      data: { url: data.url || DEFAULT_URL },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || DEFAULT_URL, self.location.origin)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target.href).catch(() => {})
          return
        }
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})
