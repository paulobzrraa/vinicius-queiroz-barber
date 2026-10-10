import { describe, expect, it, vi } from 'vitest'

import { loadTelegramConfig, sendTelegramMessage, TelegramError } from './telegram.ts'

const config = { token: '123:FAKE_TOKEN', chatId: '987654' }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('sendTelegramMessage', () => {
  it('envia chat_id e text para o sendMessage do bot', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: {} }))

    await sendTelegramMessage(config, 'olá', { fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bot123:FAKE_TOKEN/sendMessage')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ chat_id: '987654', text: 'olá' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('trata token inválido (401) sem vazar o token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ ok: false, error_code: 401, description: 'Unauthorized' }, 401),
      )

    const error = await sendTelegramMessage(config, 'x', { fetchImpl }).catch((e) => e)

    expect(error).toBeInstanceOf(TelegramError)
    expect(error.kind).toBe('api')
    expect(error.message).toContain('401')
    expect(error.message).not.toContain('FAKE_TOKEN')
  })

  it('trata chat_id incorreto (400)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { ok: false, error_code: 400, description: 'Bad Request: chat not found' },
          400,
        ),
      )

    await expect(sendTelegramMessage(config, 'x', { fetchImpl })).rejects.toThrow('chat not found')
  })

  it('falha quando status é 200 mas ok não é true', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: false }))

    await expect(sendTelegramMessage(config, 'x', { fetchImpl })).rejects.toMatchObject({
      kind: 'api',
    })
  })

  it('falha de rede vira TelegramError sem a URL (que contém o token)', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new TypeError('fetch failed: https://api.telegram.org/bot123:FAKE_TOKEN/'))

    const error = await sendTelegramMessage(config, 'x', { fetchImpl }).catch((e) => e)

    expect(error.kind).toBe('network')
    expect(error.message).not.toContain('FAKE_TOKEN')
  })

  it('estouro de tempo vira kind "timeout"', async () => {
    const fetchImpl = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    })

    await expect(
      sendTelegramMessage(config, 'x', { fetchImpl: fetchImpl as never, timeoutMs: 20 }),
    ).rejects.toMatchObject({ kind: 'timeout' })
  })
})

describe('loadTelegramConfig', () => {
  it('lê token e chat id do ambiente', () => {
    expect(loadTelegramConfig({ TELEGRAM_BOT_TOKEN: ' t ', TELEGRAM_CHAT_ID: '1' })).toEqual({
      token: 't',
      chatId: '1',
    })
  })

  it('exige o token', () => {
    expect(() => loadTelegramConfig({ TELEGRAM_CHAT_ID: '1' })).toThrow('TELEGRAM_BOT_TOKEN')
  })

  it('exige o chat id', () => {
    expect(() => loadTelegramConfig({ TELEGRAM_BOT_TOKEN: 't' })).toThrow('TELEGRAM_CHAT_ID')
  })
})
