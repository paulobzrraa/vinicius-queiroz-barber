// Cliente mínimo da Bot API do Telegram (sendMessage). Sem dependências e sem
// APIs do Deno, para rodar igual na Edge Function e nos testes (vitest).

export type TelegramErrorKind = 'not_configured' | 'timeout' | 'network' | 'api'

export class TelegramError extends Error {
  readonly kind: TelegramErrorKind

  constructor(kind: TelegramErrorKind, message: string) {
    super(message)
    this.name = 'TelegramError'
    this.kind = kind
  }
}

export interface TelegramConfig {
  token: string
  chatId: string
}

/** Lê as credenciais do ambiente do servidor. O destinatário nunca vem do navegador. */
export function loadTelegramConfig(env: {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
}): TelegramConfig {
  const token = env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = env.TELEGRAM_CHAT_ID?.trim()

  if (!token) throw new TelegramError('not_configured', 'TELEGRAM_BOT_TOKEN não configurado')
  if (!chatId) throw new TelegramError('not_configured', 'TELEGRAM_CHAT_ID não configurado')

  return { token, chatId }
}

const DEFAULT_TIMEOUT_MS = 8000

/**
 * Envia texto simples (sem parse_mode, então nada precisa de escape) para o chat
 * configurado. Lança TelegramError com uma mensagem que nunca contém o token.
 */
export async function sendTelegramMessage(
  config: TelegramConfig,
  text: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  let response: Response
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.chatId, text }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    // A mensagem de erro de rede pode embutir a URL (e portanto o token): não repassa.
    const isTimeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
    throw isTimeout
      ? new TelegramError('timeout', `Telegram não respondeu em ${timeoutMs}ms`)
      : new TelegramError('network', 'Falha de rede ao chamar o Telegram')
  }

  let body: { ok?: boolean; description?: string; error_code?: number } | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok || body?.ok !== true) {
    // Ex.: 401 "Unauthorized" (token inválido), 400 "Bad Request: chat not found".
    const code = body?.error_code ?? response.status
    const description = body?.description ?? 'resposta inesperada'
    throw new TelegramError('api', `Telegram recusou (${code}): ${description}`)
  }
}
