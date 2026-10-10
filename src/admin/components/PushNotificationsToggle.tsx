import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui'
import {
  fetchPushPublicKey,
  PushSubscriptionError,
  useDisablePush,
  useEnablePush,
} from '@/queries/pushSubscriptions'
import { getPushState, type PushState } from '@/utils/webPush'

const errorMessages: Record<PushSubscriptionError['reason'], string> = {
  not_configured: 'Notificações ainda não configuradas neste ambiente.',
  permission_denied: 'Permissão não concedida. Libere as notificações nas configurações do site.',
  too_many_devices:
    'Este admin já tem 10 aparelhos com notificação. Desative um para adicionar outro.',
  save_failed: 'Não foi possível salvar a ativação agora. Tente de novo em instantes.',
}

function describe(state: PushState): string {
  switch (state.status) {
    case 'unsupported':
      return 'Este navegador não oferece notificações push. Tente o Chrome, o Edge ou o Safari atualizado.'
    case 'needs-home-screen':
      return 'No iPhone ou iPad, adicione o site à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá para ativar.'
    case 'not-configured':
      return 'Notificações ainda não configuradas neste ambiente.'
    case 'denied':
      return 'Notificações bloqueadas no navegador. Libere-as nas configurações do site.'
    case 'enabled':
      return 'Notificações ativadas neste aparelho.'
    case 'disabled':
      return 'Receba um aviso quando um agendamento for criado, cancelado ou alterado.'
  }
}

/** Ativa/desativa o aviso de agendamentos neste aparelho (só aparece no admin, nunca no site público). */
export function PushNotificationsToggle() {
  // A chave pública vem do banco; se a leitura falhar, a tela mostra "não configurado" em vez de quebrar.
  const { data: publicKey, isPending: keyPending } = useQuery({
    queryKey: ['push-public-key'],
    queryFn: () => fetchPushPublicKey().catch(() => ''),
  })
  const { data: state, isPending } = useQuery({
    queryKey: ['push-state', publicKey],
    queryFn: () => getPushState(publicKey ?? ''),
    enabled: !keyPending,
  })
  const enable = useEnablePush()
  const disable = useDisablePush()

  const busy = enable.isPending || disable.isPending
  const error = enable.error ?? disable.error
  const errorText =
    error instanceof PushSubscriptionError
      ? errorMessages[error.reason]
      : error
        ? errorMessages.save_failed
        : null

  if (keyPending || isPending || !state) return null

  const canToggle = state.status === 'enabled' || state.status === 'disabled'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
      <div className="min-w-0 space-y-1">
        <p className="text-caption text-muted">{describe(state)}</p>
        {errorText && (
          <p role="alert" className="text-caption text-foreground">
            {errorText}
          </p>
        )}
      </div>

      {canToggle && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            state.status === 'enabled' ? disable.mutate() : enable.mutate(publicKey ?? '')
          }
        >
          {busy
            ? 'Aguarde…'
            : state.status === 'enabled'
              ? 'Desativar notificações'
              : 'Ativar notificações'}
        </Button>
      )}
    </div>
  )
}
