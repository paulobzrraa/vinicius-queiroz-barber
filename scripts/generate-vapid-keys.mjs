// Gera o par de chaves VAPID do Web Push (uma vez por projeto). Saída:
//   public key → guardada no banco (notification_settings.push_public_key), lida pelo site
//   VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY → secrets da Edge Function web-push-notify (a privada NUNCA vai ao site)
// Uso: node scripts/generate-vapid-keys.mjs
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })

// Formato que o navegador espera: ponto não comprimido (0x04 || X || Y), em base64url.
const x = Buffer.from(jwk.x, 'base64url')
const y = Buffer.from(jwk.y, 'base64url')
const publicB64 = Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url')

console.log('# Pública (não é segredo). Rode no SQL Editor, junto com push_function_url/secret:')
console.log(`update notification_settings set push_public_key = '${publicB64}' where id = 1;`)
console.log('\n# Pública, para o secret da função:')
console.log(`VAPID_PUBLIC_KEY=${publicB64}`)
console.log('\n# Privado (somente secret da Edge Function, nunca no site):')
console.log(`VAPID_PRIVATE_KEY=${priv.d}`)
console.log('\n# Contato exigido pelo serviço de push (troque pelo seu e-mail):')
console.log('VAPID_SUBJECT=mailto:seu-email@exemplo.com')
