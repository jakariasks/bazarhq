export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return null
}

export function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  })
}

export function redirect(url: string, status = 303) {
  return new Response(null, {
    status,
    headers: { ...corsHeaders, Location: url, 'Cache-Control': 'no-store' },
  })
}

export async function parseBody(req: Request): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const url = new URL(req.url)
  for (const [key, value] of url.searchParams.entries()) result[key] = value

  if (req.method === 'GET' || req.method === 'HEAD') return result

  const contentType = (req.headers.get('content-type') || '').toLowerCase()
  const raw = await req.text()
  if (!raw) return result

  try {
    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) result[key] = value == null ? '' : String(value)
      }
      return result
    }
  } catch {
    return result
  }

  const params = new URLSearchParams(raw)
  for (const [key, value] of params.entries()) result[key] = value
  return result
}
