import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  callAdminFunction,
  clearAdminSession,
  getStoredAdminSession,
  isStoredAdminSessionExpired,
  saveAdminSession,
} from '@/lib/admin-session'

const AdminAuthContext = createContext(null)

function isAuthoritativeSessionFailure(error) {
  return error?.status === 401 || error?.status === 403
}

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    const stored = getStoredAdminSession()

    if (!stored?.token || isStoredAdminSessionExpired(stored)) {
      clearAdminSession()
      setAdmin(null)
      setLoading(false)
      return null
    }

    try {
      const data = await callAdminFunction(
        'admin-verify-session',
        {},
        { retries: 2, timeoutMs: 10_000 },
      )

      const next = {
        ...stored,
        admin: data.admin,
        expires_at: data.session?.expires_at || stored.expires_at,
        idle_expires_at: data.session?.idle_expires_at || stored.idle_expires_at,
      }

      saveAdminSession(next)
      setAdmin(data.admin)
      setLoading(false)
      return data.admin
    } catch (error) {
      // Only a real 401/403 response proves that the custom admin session is no
      // longer valid. A temporary network/Edge Function/5xx failure must never
      // destroy a valid local session and cause an automatic logout.
      if (isAuthoritativeSessionFailure(error) || isStoredAdminSessionExpired(stored)) {
        clearAdminSession()
        setAdmin(null)
        setLoading(false)
        return null
      }

      console.warn('Admin session verification temporarily unavailable:', error)

      // Keep the previously verified identity while the backend is temporarily
      // unreachable. Privileged page requests still go through the Edge Functions,
      // so no protected data is bypassed by doing this.
      const fallbackAdmin = admin || stored.admin || null
      setAdmin(fallbackAdmin)
      setLoading(false)
      return fallbackAdmin
    }
  }, [admin])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  useEffect(() => {
    if (!admin) return undefined

    const interval = window.setInterval(() => {
      void refreshSession()
    }, 5 * 60 * 1000)

    return () => window.clearInterval(interval)
  }, [admin, refreshSession])

  async function login(email, password, totpCode = '', challengeToken = '') {
    const data = await callAdminFunction(
      'admin-login',
      {
        email,
        password,
        totpCode,
        challengeToken,
      },
      { retries: 1, timeoutMs: 12_000 },
    )

    if (data.requiresTOTP) {
      return { requiresTOTP: true, challengeToken: data.challengeToken }
    }

    if (data.session?.token && data.admin) {
      saveAdminSession({
        token: data.session.token,
        admin: data.admin,
        expires_at: data.session.expires_at,
        idle_expires_at: data.session.idle_expires_at,
      })
      setAdmin(data.admin)
      return { success: true }
    }

    throw new Error('Admin login did not return a valid session.')
  }

  async function completeTOTPLogin(challengeToken, totpCode) {
    return login('', '', totpCode, challengeToken)
  }

  async function logout() {
    try {
      await callAdminFunction('admin-logout', {}, { timeoutMs: 7_000 })
    } catch {
      // Local logout must still complete if the Edge Function is temporarily down.
    }

    clearAdminSession()
    setAdmin(null)
  }

  async function writeAuditLog(action, details = {}, targetType = null, targetId = null) {
    try {
      await callAdminFunction(
        'admin-audit',
        {
          action,
          details,
          target_type: targetType,
          target_id: targetId,
        },
        { retries: 1 },
      )
    } catch {
      // Best effort only.
    }
  }

  const value = useMemo(() => ({
    admin,
    loading,
    isLoggedIn: !!admin,
    login,
    completeTOTPLogin,
    logout,
    writeAuditLog,
    refreshSession,
    hasRole: (roles) => {
      const list = Array.isArray(roles) ? roles : [roles]
      return !!admin && list.includes(admin.role)
    },
  }), [admin, loading, refreshSession])

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  return context
}

export function AdminGuard({ children }) {
  const { isLoggedIn, loading } = useAdminAuth()

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      window.location.href = '/superadmin/login'
    }
  }, [loading, isLoggedIn])

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-white">Checking admin session...</div>
  }

  if (!isLoggedIn) return null
  return children
}
