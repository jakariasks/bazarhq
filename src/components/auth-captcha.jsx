import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || ''
const HCAPTCHA_SCRIPT_SRC = 'https://js.hcaptcha.com/1/api.js?render=explicit'

let hcaptchaScriptPromise = null

function loadHCaptchaScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not available'))
  }

  if (window.hcaptcha) {
    return Promise.resolve(window.hcaptcha)
  }

  if (!hcaptchaScriptPromise) {
    hcaptchaScriptPromise = new Promise((resolve, reject) => {
      const existingScript = Array.from(document.scripts).find((script) =>
        script.src.startsWith('https://js.hcaptcha.com/1/api.js')
      )

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.hcaptcha), { once: true })
        existingScript.addEventListener('error', reject, { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = HCAPTCHA_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve(window.hcaptcha)
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  return hcaptchaScriptPromise
}

export function AuthCaptcha({ onVerify, resetKey = 0, className = '' }) {
  const reactId = useId()
  const elementId = useMemo(() => `hcaptcha-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [reactId])
  const widgetIdRef = useRef(null)
  const tokenRef = useRef('')
  const [verified, setVerified] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const clearToken = () => {
    tokenRef.current = ''
    setVerified(false)
    onVerify?.('')
  }

  useEffect(() => {
    clearToken()
    setLoadFailed(false)

    if (!HCAPTCHA_SITE_KEY) return undefined

    let cancelled = false

    loadHCaptchaScript()
      .then((hcaptcha) => {
        if (cancelled || !hcaptcha || widgetIdRef.current !== null) return

        widgetIdRef.current = hcaptcha.render(elementId, {
          sitekey: HCAPTCHA_SITE_KEY,
          theme: 'light',
          size: 'normal',
          callback: (token) => {
            tokenRef.current = token || ''
            setVerified(Boolean(token))
            setLoadFailed(false)
            onVerify?.(token || '')
          },
          'expired-callback': () => {
            clearToken()
          },
          'error-callback': () => {
            // hCaptcha can fire an error after the visual challenge, so keep success state
            // if a valid token has already been received.
            if (tokenRef.current) {
              setVerified(true)
              return
            }

            clearToken()
          },
        })
      })
      .catch(() => {
        if (!cancelled) {
          clearToken()
          setLoadFailed(true)
        }
      })

    return () => {
      cancelled = true

      if (window.hcaptcha && widgetIdRef.current !== null) {
        try {
          window.hcaptcha.remove(widgetIdRef.current)
        } catch {}
        widgetIdRef.current = null
      }
    }
  }, [elementId])

  useEffect(() => {
    clearToken()
    setLoadFailed(false)

    if (HCAPTCHA_SITE_KEY && window.hcaptcha && widgetIdRef.current !== null) {
      try {
        window.hcaptcha.reset(widgetIdRef.current)
      } catch {}
    }
  }, [resetKey])

  if (!HCAPTCHA_SITE_KEY) {
    return (
      <div className={className}>
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Captcha site key missing</p>
            <p className="mt-0.5 text-xs">Add VITE_HCAPTCHA_SITE_KEY, or disable CAPTCHA in Supabase while testing locally.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background px-3 py-3 shadow-sm transition-all duration-300">
        <div id={elementId} className="min-h-[78px]" />

        <div className="mt-2 flex items-center justify-center">
          {verified ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 transition-all duration-300">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          ) : (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 transition-all duration-300">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
        </div>

        {loadFailed && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted"
          >
            Reload captcha
          </button>
        )}
      </div>
    </div>
  )
}

export function isCaptchaConfigured() {
  return !!HCAPTCHA_SITE_KEY
}
