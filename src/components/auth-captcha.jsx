import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

let turnstileScriptPromise = null

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is not available'))
  if (window.turnstile) return Promise.resolve(window.turnstile)

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${TURNSTILE_SRC}"]`)
      if (existing) {
        existing.addEventListener('load', () => resolve(window.turnstile), { once: true })
        existing.addEventListener('error', reject, { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = TURNSTILE_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve(window.turnstile)
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  return turnstileScriptPromise
}

export function AuthCaptcha({ onVerify, resetKey = 0, className = '' }) {
  const reactId = useId()
  const elementId = useMemo(
    () => `turnstile-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Math.random().toString(36).slice(2)}`,
    [reactId]
  )
  const widgetIdRef = useRef(null)
  const [localChecked, setLocalChecked] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined

    let cancelled = false

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !turnstile || widgetIdRef.current) return
        widgetIdRef.current = turnstile.render(`#${elementId}`, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          callback: (token) => onVerify?.(token),
          'expired-callback': () => onVerify?.(''),
          'error-callback': () => onVerify?.(''),
        })
      })
      .catch(() => {
        if (!cancelled) setLoadError('Security check failed. Refresh and try again.')
      })

    return () => {
      cancelled = true
      if (window.turnstile && widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current) } catch {}
        widgetIdRef.current = null
      }
    }
  }, [elementId, onVerify])

  useEffect(() => {
    onVerify?.('')
    setLocalChecked(false)
    if (TURNSTILE_SITE_KEY && window.turnstile && widgetIdRef.current) {
      try { window.turnstile.reset(widgetIdRef.current) } catch {}
    }
  }, [resetKey, onVerify])

  if (TURNSTILE_SITE_KEY) {
    return (
      <div className={className}>
        <div id={elementId} className="min-h-[65px]" />
        {loadError && <p className="mt-2 text-xs text-destructive">{loadError}</p>}
      </div>
    )
  }

  return (
    <div className={className}>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm shadow-sm transition hover:border-primary/40 hover:bg-primary/5">
        <input
          type="checkbox"
          checked={localChecked}
          onChange={(event) => {
            const checked = event.target.checked
            setLocalChecked(checked)
            onVerify?.(checked ? 'local-dev-captcha-ok' : '')
          }}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {localChecked ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </span>
        <span className="font-medium text-foreground">I am not a robot</span>
      </label>
    </div>
  )
}

export function isCaptchaConfigured() {
  return !!TURNSTILE_SITE_KEY
}
