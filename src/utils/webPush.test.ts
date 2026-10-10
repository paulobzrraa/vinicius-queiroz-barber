import { describe, expect, it } from 'vitest'

import { urlBase64ToUint8Array } from './webPush'

describe('urlBase64ToUint8Array', () => {
  it('converte base64url (com - e _ e sem padding) nos mesmos bytes', () => {
    // 0xfb 0xff 0xfe -> "-__-" em base64url
    expect(Array.from(urlBase64ToUint8Array('-__-'))).toEqual([0xfb, 0xff, 0xfe])
  })

  it('a chave pública VAPID de 65 bytes continua com 65 bytes e começa com 0x04', () => {
    const raw = new Uint8Array(65).fill(0xab)
    raw[0] = 0x04
    const key = btoa(String.fromCharCode(...raw))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const bytes = urlBase64ToUint8Array(key)
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(0x04)
  })
})
