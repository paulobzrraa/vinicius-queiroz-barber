import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabase } from '@/lib/supabase'
import {
  currentDeviceSubscription,
  requestPushPermission,
  subscribeThisDevice,
} from '@/utils/webPush'

/** Chave pública VAPID guardada no banco (não é segredo). Vazia = push ainda não configurado. */
export async function fetchPushPublicKey(): Promise<string> {
  const { data, error } = await supabase.rpc('get_push_public_key')
  if (error) throw error
  return data?.trim() ?? ''
}

/** Erros que a tela explica ao admin (os códigos vêm de register_push_subscription). */
export class PushSubscriptionError extends Error {
  reason: 'permission_denied' | 'too_many_devices' | 'save_failed' | 'not_configured'

  constructor(reason: PushSubscriptionError['reason']) {
    super(reason)
    this.reason = reason
  }
}

/**
 * Ativa as notificações neste aparelho: pede permissão, cria a assinatura no
 * navegador e a grava no banco (vinculada ao admin logado). Se gravar falhar, a
 * assinatura do navegador é desfeita para não ficar um aparelho "órfão".
 */
export function useEnablePush() {
  const queryClient = useQueryClient()

  return useMutation({
    // A chave chega já carregada pela tela: buscá-la aqui, antes do pedido de
    // permissão, faria o Safari perder o gesto do clique.
    mutationFn: async (publicKey: string) => {
      if (!publicKey) throw new PushSubscriptionError('not_configured')

      // Primeiro await da cadeia: o pedido de permissão precisa vir do clique.
      const permission = await requestPushPermission()
      if (permission !== 'granted') throw new PushSubscriptionError('permission_denied')

      const subscription = await subscribeThisDevice(publicKey)
      const json = subscription.toJSON()
      const p256dh = json.keys?.p256dh
      const auth = json.keys?.auth
      if (!json.endpoint || !p256dh || !auth) throw new PushSubscriptionError('save_failed')

      const { error } = await supabase.rpc('register_push_subscription', {
        p_endpoint: json.endpoint,
        p_p256dh: p256dh,
        p_auth_secret: auth,
        p_user_agent: navigator.userAgent.slice(0, 300),
      })
      if (error) {
        await subscription.unsubscribe().catch(() => {})
        if (error.code === 'P0005') throw new PushSubscriptionError('too_many_devices')
        throw new PushSubscriptionError('save_failed')
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['push-state'] }),
  })
}

/**
 * Desativa neste aparelho: remove a linha no banco e cancela a assinatura do
 * navegador. Se o banco falhar, mantém a assinatura local (nada fica pela metade).
 */
export function useDisablePush() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const subscription = await currentDeviceSubscription()
      if (!subscription) return

      const { error } = await supabase.rpc('unregister_push_subscription', {
        p_endpoint: subscription.endpoint,
      })
      if (error) throw new PushSubscriptionError('save_failed')

      await subscription.unsubscribe()
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['push-state'] }),
  })
}

/**
 * Reenvia a assinatura deste aparelho ao banco a cada abertura do admin. Assim, se o
 * serviço de push desativou o aparelho por engano (404/410 transitório), ele volta a
 * receber sem o admin precisar desativar e ativar de novo. A RPC é idempotente.
 * Silenciosa: falha de rede só deixa para a próxima abertura.
 */
export function usePushDeviceSync() {
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const publicKey = await fetchPushPublicKey()
        if (!publicKey || cancelled) return
        const subscription = await currentDeviceSubscription()
        if (!subscription || cancelled) return

        const json = subscription.toJSON()
        const p256dh = json.keys?.p256dh
        const auth = json.keys?.auth
        if (!json.endpoint || !p256dh || !auth) return

        await supabase.rpc('register_push_subscription', {
          p_endpoint: json.endpoint,
          p_p256dh: p256dh,
          p_auth_secret: auth,
          p_user_agent: navigator.userAgent.slice(0, 300),
        })
      } catch {
        // próxima abertura tenta de novo
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])
}
