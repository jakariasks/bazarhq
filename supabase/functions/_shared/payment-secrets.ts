import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const enc = new TextEncoder()
const dec = new TextDecoder()

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function keyFromSecret() {
  const secret = Deno.env.get('PAYMENT_CREDENTIALS_KEY') || ''
  if (secret.length < 32) throw new Error('PAYMENT_CREDENTIALS_KEY must be at least 32 characters.')
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptPaymentSecret(payload: Record<string, string>) {
  const key = await keyFromSecret()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload)))
  return { cipherText: bytesToBase64(new Uint8Array(cipher)), iv: bytesToBase64(iv) }
}

export async function decryptPaymentSecret(cipherText: string, ivValue: string) {
  const key = await keyFromSecret()
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(ivValue) }, key, base64ToBytes(cipherText))
  return JSON.parse(dec.decode(plain)) as Record<string, string>
}

export async function loadPaymentSecret(admin: SupabaseClient, paymentConfigId: string) {
  const { data, error } = await admin
    .from('payment_private_credentials')
    .select('cipher_text,iv')
    .eq('payment_config_id', paymentConfigId)
    .single()
  if (error || !data) throw new Error('Payment credentials are not configured.')
  return decryptPaymentSecret(data.cipher_text, data.iv)
}
