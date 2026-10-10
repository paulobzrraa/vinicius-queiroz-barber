// Envio de Web Push (RFC 8030) com autenticação VAPID (RFC 8292) e criptografia
// do conteúdo aes128gcm (RFC 8188/8291). Só WebCrypto e fetch, sem dependências,
// para rodar igual na Edge Function (Deno) e nos testes (vitest).

export interface VapidConfig {
  /** Chave pública, base64url, 65 bytes sem compressão (começa com 0x04). */
  publicKey: string
  /** Chave privada (escalar d), base64url, 32 bytes. Nunca sai do servidor. */
  privateKey: string
  /** "mailto:..." ou URL https de contato, exigido pelos serviços de push. */
  subject: string
}

export interface PushSubscriptionKeys {
  endpoint: string
  /** Chave pública do navegador (p256dh), base64url. */
  p256dh: string
  /** Segredo de autenticação (auth), base64url. */
  auth: string
}

export class WebPushError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'WebPushError'
    this.status = status
  }
}

const TTL_SECONDS = 60 * 60 // um aviso de agendamento perde o sentido depois de uma hora
const RECORD_SIZE = 4096
const JWT_LIFETIME_SECONDS = 12 * 60 * 60

const encoder = new TextEncoder()

export function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data))
}

/** HKDF (RFC 5869) com SHA-256: extract + expand de `length` bytes. */
export async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm)
  const output = new Uint8Array(length)
  let previous = new Uint8Array(0)
  let offset = 0
  for (let counter = 1; offset < length; counter++) {
    previous = await hmacSha256(prk, concat(previous, info, Uint8Array.of(counter)))
    const take = Math.min(previous.length, length - offset)
    output.set(previous.subarray(0, take), offset)
    offset += take
  }
  return output
}

async function importVapidPrivateKey(config: VapidConfig): Promise<CryptoKey> {
  const publicBytes = base64urlDecode(config.publicKey)
  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) {
    throw new WebPushError('VAPID_PUBLIC_KEY inválida (esperado P-256 sem compressão)')
  }
  const x = base64urlEncode(publicBytes.subarray(1, 33))
  const y = base64urlEncode(publicBytes.subarray(33, 65))
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: config.privateKey, x, y, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

/**
 * Cabeçalho Authorization "vapid t=<jwt>, k=<chave pública>". O JWT (ES256) fica
 * válido por 12 h e vale só para a origem do endpoint (campo aud).
 */
export async function vapidAuthorization(
  endpoint: string,
  config: VapidConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const audience = new URL(endpoint).origin
  const header = base64urlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = base64urlEncode(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: nowSeconds + JWT_LIFETIME_SECONDS,
        sub: config.subject,
      }),
    ),
  )
  const signingInput = `${header}.${claims}`
  const key = await importVapidPrivateKey(config)
  // WebCrypto já devolve a assinatura no formato r||s (64 bytes) que o JWT espera.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(signingInput)),
  )
  return `vapid t=${signingInput}.${base64urlEncode(signature)}, k=${config.publicKey}`
}

/**
 * Criptografa o payload no formato aes128gcm (RFC 8291): ECDH com uma chave
 * efêmera, segredo de autenticação do navegador, e um único registro.
 * Devolve o corpo pronto para o POST (cabeçalho do registro + texto cifrado).
 */
export async function encryptPayload(
  payload: Uint8Array,
  subscription: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  random: { salt?: Uint8Array; ephemeral?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  let uaPublic: Uint8Array
  let authSecret: Uint8Array
  try {
    uaPublic = base64urlDecode(subscription.p256dh)
    authSecret = base64urlDecode(subscription.auth)
  } catch {
    throw new WebPushError('chaves da assinatura não estão em base64url')
  }
  if (uaPublic.length !== 65) throw new WebPushError('chave p256dh da assinatura inválida')
  if (authSecret.length !== 16) throw new WebPushError('segredo auth da assinatura inválido')

  const ephemeral =
    random.ephemeral ??
    (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']))
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey!))

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, ephemeral.privateKey!, 256),
  )

  // RFC 8291 §3.3: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0 || ua_public || as_public, 32)
  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)

  // RFC 8188: CEK e nonce derivados de um salt aleatório por mensagem.
  const salt = random.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  // Último registro: o payload seguido do delimitador 0x02 (sem padding extra).
  const plaintext = concat(payload, Uint8Array.of(0x02))
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext),
  )

  // Cabeçalho: salt (16) || record size (4 bytes, big-endian) || idlen (1) || keyid = chave efêmera.
  const recordSize = new Uint8Array(4)
  new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE)
  return concat(salt, recordSize, Uint8Array.of(asPublic.length), asPublic, ciphertext)
}

/**
 * Envia um aviso a um aparelho. Devolve o status HTTP do serviço de push (201 =
 * aceito). 404 e 410 significam que a assinatura não existe mais: quem chama
 * deve desativá-la. Nunca inclui o endpoint na mensagem de erro (é uma credencial).
 */
export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: string,
  vapid: VapidConfig,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<number> {
  const { fetchImpl = fetch, timeoutMs = 10_000 } = options

  const body = await encryptPayload(encoder.encode(payload), subscription)
  const authorization = await vapidAuthorization(subscription.endpoint, vapid)

  let response: Response
  try {
    response = await fetchImpl(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(TTL_SECONDS),
        Urgency: 'normal',
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const isTimeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
    throw new WebPushError(
      isTimeout
        ? `serviço de push não respondeu em ${timeoutMs}ms`
        : 'falha de rede no envio de push',
    )
  }

  // 201 é o normal; 2xx em geral conta como aceito.
  if (response.status < 300) return response.status
  throw new WebPushError(`serviço de push recusou (${response.status})`, response.status)
}
