import { describe, expect, it } from 'vitest'

import {
  base64urlDecode,
  base64urlEncode,
  encryptPayload,
  hkdf,
  sendWebPush,
  vapidAuthorization,
  WebPushError,
  type VapidConfig,
} from './webpush.ts'

const enc = new TextEncoder()
const dec = new TextDecoder()

// Chave VAPID só de teste (gerada na hora, nunca usada em produção).
async function makeVapid(): Promise<VapidConfig & { keyPair: CryptoKeyPair }> {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  return {
    keyPair: keyPair as unknown as CryptoKeyPair,
    publicKey: await rawPublic(keyPair.publicKey),
    privateKey: await privateScalar(keyPair.privateKey),
    subject: 'mailto:teste@example.test',
  }
}

async function rawPublic(key: CryptoKey) {
  return base64urlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', key)))
}

async function privateScalar(key: CryptoKey) {
  const jwk = await crypto.subtle.exportKey('jwk', key)
  return jwk.d as string
}

/** Chaves de um "navegador" de teste: p256dh (pública) e auth (16 bytes). */
async function makeBrowser() {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return {
    keyPair,
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/teste',
      p256dh: await rawPublic(keyPair.publicKey),
      auth: base64urlEncode(auth),
    },
    auth,
  }
}

/** Decifra o corpo aes128gcm do lado do navegador (RFC 8291 §3.4). */
async function decryptAsBrowser(
  body: Uint8Array,
  browser: Awaited<ReturnType<typeof makeBrowser>>,
) {
  const salt = body.subarray(0, 16)
  const recordSize = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0)
  const idLen = body[20]
  const asPublic = body.subarray(21, 21 + idLen)
  const ciphertext = body.subarray(21 + idLen)
  expect(recordSize).toBe(4096)
  expect(idLen).toBe(65)

  const asKey = await crypto.subtle.importKey(
    'raw',
    asPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: asKey },
      browser.keyPair.privateKey,
      256,
    ),
  )
  const uaPublic = base64urlDecode(browser.subscription.p256dh)
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(browser.auth, ecdh, keyInfo, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt'])
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, ciphertext),
  )
  // O último registro termina com o delimitador 0x02.
  expect(plain[plain.length - 1]).toBe(0x02)
  return dec.decode(plain.subarray(0, plain.length - 1))
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

describe('base64url', () => {
  it('ida e volta sem padding e com alfabeto url-safe', () => {
    const bytes = Uint8Array.of(0xfb, 0xff, 0xfe, 0x00, 0x7f)
    const text = base64urlEncode(bytes)
    expect(text).not.toMatch(/[+/=]/)
    expect(base64urlDecode(text)).toEqual(bytes)
  })
})

describe('HKDF (RFC 5869, caso de teste 1)', () => {
  it('gera o OKM esperado', async () => {
    const ikm = new Uint8Array(22).fill(0x0b)
    const salt = Uint8Array.from({ length: 13 }, (_, i) => i)
    const info = Uint8Array.from({ length: 10 }, (_, i) => 0xf0 + i)
    const okm = await hkdf(salt, ikm, info, 42)
    expect(Buffer.from(okm).toString('hex')).toBe(
      '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    )
  })
})

describe('vapidAuthorization', () => {
  it('gera um JWT ES256 com aud = origem do endpoint, assinado pela chave VAPID', async () => {
    const vapid = await makeVapid()
    const header = await vapidAuthorization(
      'https://fcm.googleapis.com/fcm/send/abc',
      vapid,
      1_700_000_000,
    )

    const match = header.match(/^vapid t=([^,]+), k=(.+)$/)
    expect(match).not.toBeNull()
    const [, jwt, publicKey] = match!
    expect(publicKey).toBe(vapid.publicKey)

    const [h, c, s] = jwt.split('.')
    expect(JSON.parse(dec.decode(base64urlDecode(h)))).toEqual({ typ: 'JWT', alg: 'ES256' })
    const claims = JSON.parse(dec.decode(base64urlDecode(c)))
    expect(claims).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_700_000_000 + 12 * 60 * 60,
      sub: 'mailto:teste@example.test',
    })

    const verifyKey = await crypto.subtle.importKey(
      'raw',
      base64urlDecode(vapid.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      base64urlDecode(s),
      enc.encode(`${h}.${c}`),
    )
    expect(valid).toBe(true)
  })
})

describe('encryptPayload (aes128gcm)', () => {
  it('o navegador consegue decifrar exatamente o payload enviado', async () => {
    const browser = await makeBrowser()
    const body = await encryptPayload(
      enc.encode('{"title":"Oi","body":"teste"}'),
      browser.subscription,
    )
    expect(await decryptAsBrowser(body, browser)).toBe('{"title":"Oi","body":"teste"}')
  })

  it('cada envio usa chave efêmera e salt novos (texto cifrado diferente)', async () => {
    const browser = await makeBrowser()
    const a = await encryptPayload(enc.encode('mesmo texto'), browser.subscription)
    const b = await encryptPayload(enc.encode('mesmo texto'), browser.subscription)
    expect(base64urlEncode(a)).not.toBe(base64urlEncode(b))
  })

  it('chave p256dh malformada é recusada antes de criptografar', async () => {
    await expect(
      encryptPayload(enc.encode('x'), {
        p256dh: 'curta',
        auth: base64urlEncode(new Uint8Array(16)),
      }),
    ).rejects.toBeInstanceOf(WebPushError)
  })
})

describe('sendWebPush', () => {
  it('envia POST com cabeçalhos corretos e devolve o status de aceite', async () => {
    const vapid = await makeVapid()
    const browser = await makeBrowser()
    let captured: { url: string; init: RequestInit } | null = null
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init }
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch

    const status = await sendWebPush(browser.subscription, '{"title":"t"}', vapid, { fetchImpl })

    expect(status).toBe(201)
    expect(captured!.url).toBe(browser.subscription.endpoint)
    const headers = captured!.init.headers as Record<string, string>
    expect(headers['Content-Encoding']).toBe('aes128gcm')
    expect(headers.Authorization.startsWith('vapid t=')).toBe(true)
    expect(headers.TTL).toBe('3600')
  })

  it('404/410 vira WebPushError com o status, para o chamador desativar o aparelho', async () => {
    const vapid = await makeVapid()
    const browser = await makeBrowser()
    const fetchImpl = (async () => new Response('gone', { status: 410 })) as unknown as typeof fetch

    const error = await sendWebPush(browser.subscription, '{}', vapid, { fetchImpl }).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(WebPushError)
    expect((error as WebPushError).status).toBe(410)
  })

  it('erro de rede não vaza o endpoint na mensagem', async () => {
    const vapid = await makeVapid()
    const browser = await makeBrowser()
    const fetchImpl = (async () => {
      throw new TypeError(`failed to fetch ${browser.subscription.endpoint}`)
    }) as unknown as typeof fetch

    const error = (await sendWebPush(browser.subscription, '{}', vapid, { fetchImpl }).catch(
      (e: unknown) => e,
    )) as Error
    expect(error.message).not.toContain('fcm.googleapis.com')
  })
})
