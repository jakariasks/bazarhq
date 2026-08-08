export class DeliveryError extends Error {
  retryable: boolean
  status: number | null
  provider: string

  constructor(message: string, options: { retryable?: boolean; status?: number | null; provider?: string } = {}) {
    super(message)
    this.name = 'DeliveryError'
    this.retryable = options.retryable ?? true
    this.status = options.status ?? null
    this.provider = options.provider || 'unknown'
  }
}

type DeliveryResult = {
  provider: string
  providerStatus: number
  providerMessageId: string | null
  providerResponse: Record<string, unknown>
}

const clean = (value: unknown, max = 1200) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new DeliveryError('Provider request timed out.', { retryable: true })
    }
    throw new DeliveryError(clean((error as Error)?.message || error), { retryable: true })
  } finally {
    clearTimeout(timer)
  }
}

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

export async function sendEmailNotification(input: {
  to: string
  subject: string
  text: string
  html?: string | null
}): Promise<DeliveryResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')?.trim() || ''
  const from = Deno.env.get('NOTIFICATION_FROM_EMAIL')?.trim() || 'BazarHQ <noreply@bazarhq.com>'
  const recipient = input.to.trim()

  if (!/^\S+@\S+\.\S+$/.test(recipient)) {
    throw new DeliveryError('A valid email recipient is required.', { retryable: false, provider: 'resend' })
  }
  if (!apiKey) {
    throw new DeliveryError('RESEND_API_KEY is not configured.', { retryable: false, provider: 'resend' })
  }

  const response = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: clean(input.subject, 250) || 'BazarHQ notification',
      text: clean(input.text, 10_000),
      html: input.html || undefined,
    }),
  })

  const rawResponse = await response.text()
  let payload: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(rawResponse)
    if (parsed && typeof parsed === 'object') payload = parsed
  } catch {
    payload = rawResponse ? { message: clean(rawResponse) } : {}
  }
  if (!response.ok) {
    throw new DeliveryError(clean((payload as any)?.message || `Email provider returned ${response.status}.`), {
      retryable: retryableStatus(response.status),
      status: response.status,
      provider: 'resend',
    })
  }

  return {
    provider: 'resend',
    providerStatus: response.status,
    providerMessageId: clean((payload as any)?.id || '') || null,
    providerResponse: payload && typeof payload === 'object' ? payload : { accepted: true },
  }
}

export async function sendSmsNotification(input: {
  to: string
  message: string
}): Promise<DeliveryResult> {
  const url = Deno.env.get('SMS_GATEWAY_URL')?.trim() || ''
  const token = Deno.env.get('SMS_GATEWAY_TOKEN')?.trim() || ''
  const from = Deno.env.get('SMS_FROM')?.trim() || 'BazarHQ'
  const recipient = input.to.replace(/\D/g, '')

  if (!/^(?:01[3-9][0-9]{8}|8801[3-9][0-9]{8})$/.test(recipient)) {
    throw new DeliveryError('A valid Bangladesh SMS recipient is required.', { retryable: false, provider: 'sms_gateway' })
  }
  if (!url) {
    throw new DeliveryError('SMS_GATEWAY_URL is not configured.', { retryable: false, provider: 'sms_gateway' })
  }

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      to: recipient,
      message: clean(input.message, 1000),
      from,
    }),
  })

  const responseText = clean(await response.text(), 2000)
  let payload: Record<string, unknown> = { response: responseText }
  try {
    const parsed = JSON.parse(responseText)
    if (parsed && typeof parsed === 'object') payload = parsed
  } catch {
    // Plain-text gateways are supported.
  }

  if (!response.ok) {
    throw new DeliveryError(clean((payload as any)?.message || responseText || `SMS provider returned ${response.status}.`), {
      retryable: retryableStatus(response.status),
      status: response.status,
      provider: 'sms_gateway',
    })
  }

  const messageId = clean((payload as any)?.id || (payload as any)?.message_id || (payload as any)?.messageId || '') || null
  return {
    provider: 'sms_gateway',
    providerStatus: response.status,
    providerMessageId: messageId,
    providerResponse: payload,
  }
}
