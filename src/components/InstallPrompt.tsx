import { Download, Plus, Share } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { Button, Heading, Text } from '@/components/ui'
import {
  canInstallNatively,
  detectPlatform,
  dismissForThisSession,
  type InstallPlatform,
  installNatively,
  isInstalled,
  markInstalled,
  registerInstallWorker,
  subscribeInstallPrompt,
  wasDismissedThisSession,
} from '@/utils/installPrompt'

/** Espera a página assentar antes do modal: ele não deve aparecer na cara de quem acabou de chegar. */
const SHOW_DELAY_MS = 1500

interface StepItem {
  icon?: ReactNode
  text: ReactNode
}

const iosSteps: StepItem[] = [
  {
    icon: <Share aria-hidden="true" className="size-4" />,
    text: (
      <>
        Toque em <strong className="font-semibold text-foreground">Compartilhar</strong>, o quadrado
        com uma seta para cima, na barra do Safari.
      </>
    ),
  },
  {
    icon: <Plus aria-hidden="true" className="size-4" />,
    text: (
      <>
        Role a lista e toque em{' '}
        <strong className="font-semibold text-foreground">Adicionar à Tela de Início</strong>.
      </>
    ),
  },
  {
    text: (
      <>
        Confirme em <strong className="font-semibold text-foreground">Adicionar</strong>. O ícone
        aparece na sua tela inicial.
      </>
    ),
  },
]

const androidSteps: StepItem[] = [
  {
    text: (
      <>
        Toque nos <strong className="font-semibold text-foreground">três pontinhos</strong> no canto
        superior direito do Chrome.
      </>
    ),
  },
  {
    text: (
      <>
        Toque em <strong className="font-semibold text-foreground">Adicionar à tela inicial</strong>{' '}
        (ou <strong className="font-semibold text-foreground">Instalar app</strong>).
      </>
    ),
  },
  {
    text: (
      <>
        Confirme em <strong className="font-semibold text-foreground">Adicionar</strong>.
      </>
    ),
  },
]

function Steps({ items }: { items: StepItem[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-caption font-semibold"
          >
            {index + 1}
          </span>
          <Text as="p" size="small" tone="muted" className="flex-1 pt-1 text-pretty">
            {item.text}
          </Text>
          {item.icon && <span className="pt-1.5 text-muted">{item.icon}</span>}
        </li>
      ))}
    </ol>
  )
}

/**
 * Modal de "adicionar à tela inicial" para quem navega pelo celular. Não aparece para quem já
 * tem o atalho (aberto pelo ícone, ou já confirmado) nem para quem fechou nesta sessão. No
 * Android, quando o navegador libera a instalação, o botão adiciona sozinho.
 */
export function InstallPrompt() {
  const dialog = useRef<HTMLDialogElement>(null)
  // null = não mostrar: computador, já tem o atalho, ou fechou nesta sessão.
  const [platform] = useState<InstallPlatform | null>(() => {
    const type = detectPlatform()
    if (type === 'other' || isInstalled() || wasDismissedThisSession()) return null
    return type
  })
  const [installing, setInstalling] = useState(false)
  const nativeReady = useSyncExternalStore(subscribeInstallPrompt, canInstallNatively, () => false)

  useEffect(() => {
    if (!platform) return
    registerInstallWorker()
    const timer = window.setTimeout(() => dialog.current?.showModal(), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [platform])

  // Se o atalho aparecer com o modal aberto (instalação concluída pelo Android), ele fecha.
  useEffect(
    () =>
      subscribeInstallPrompt(() => {
        if (isInstalled()) dialog.current?.close()
      }),
    [],
  )

  async function handleNativeInstall() {
    setInstalling(true)
    const accepted = await installNatively()
    setInstalling(false)
    if (accepted) dialog.current?.close()
  }

  function handleAlreadyAdded() {
    markInstalled()
    dialog.current?.close()
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="install-prompt-title"
      onClose={() => {
        if (!isInstalled()) dismissForThisSession()
      }}
      className="m-auto max-h-[85dvh] w-[min(calc(100%-2rem),26rem)] overflow-y-auto rounded-card border border-border bg-surface p-card text-foreground shadow-elevated backdrop:bg-background/70"
    >
      <Heading id="install-prompt-title" as="h2" size="title-4">
        Tenha a barbearia na tela inicial
      </Heading>
      <Text as="p" size="small" tone="muted" className="mt-2">
        Abra direto do celular, como um app, e agende em um toque.
      </Text>

      <div className="mt-6">
        {platform === 'ios-other-browser' && (
          <Text as="p" size="small" tone="muted" className="text-pretty">
            Este endereço está num navegador que não adiciona à tela inicial no iPhone. Copie o
            endereço e abra no <strong className="font-semibold text-foreground">Safari</strong>.
          </Text>
        )}

        {platform === 'ios' && <Steps items={iosSteps} />}

        {platform === 'android' && nativeReady && (
          <div className="flex flex-col gap-6">
            <Button
              size="lg"
              className="w-full"
              disabled={installing}
              iconStart={<Download aria-hidden="true" />}
              onClick={handleNativeInstall}
            >
              {installing ? 'Adicionando…' : 'Adicionar automaticamente'}
            </Button>
            <details>
              <summary className="cursor-pointer text-small text-muted hover:text-foreground">
                Prefiro adicionar manualmente
              </summary>
              <div className="mt-4">
                <Steps items={androidSteps} />
              </div>
            </details>
          </div>
        )}

        {platform === 'android' && !nativeReady && <Steps items={androidSteps} />}
      </div>

      <div className="mt-8 flex flex-col gap-2">
        {platform !== 'ios-other-browser' && (
          <Button variant="outline" className="w-full" onClick={handleAlreadyAdded}>
            Já adicionei
          </Button>
        )}
        <Button variant="ghost" className="w-full" onClick={() => dialog.current?.close()}>
          Agora não
        </Button>
      </div>
    </dialog>
  )
}
