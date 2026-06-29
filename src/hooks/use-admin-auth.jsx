import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { callAdminFunction, clearAdminSession, getStoredAdminSession, saveAdminSession } from '@/lib/admin-session'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    const stored = getStoredAdminSession()
    if (!stored?.token) {
      clearAdminSession()
      setAdmin(null)
      setLoading(false)
      return null
    }

    try {
      const data = await callAdminFunction('admin-verify-session')
      const next = { ...stored, admin: data.admin, expires_at: data.session?.expires_at, idle_expires_at: data.session?.idle_expires_at }
      saveAdminSession(next)
      setAdmin(data.admin)
      setLoading(false)
      return data.admin
    } catch {
      clearAdminSession()
      setAdmin(null)
      setLoading(false)
      return null
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  useEffect(() => {
    if (!admin) return undefined
    const interval = window.setInterval(() => refreshSession(), 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [admin, refreshSession])

  async function login(email, password, totpCode = '', captchaToken = '', challengeToken = '') {
    const data = await callAdminFunction('admin-login', {
      email,
      password,
      totpCode,
      captchaToken,
      challengeToken,
    })

    if (data.requiresTOTP) {
      return { requiresTOTP: true, challengeToken: data.challengeToken }
    }

    if (data.session?.token && data.admin) {
      saveAdminSession({ token: data.session.token, admin: data.admin, expires_at: data.session.expires_at, idle_expires_at: data.session.idle_expires_at })
      setAdmin(data.admin)
      return { success: true }
    }

    throw new Error('Admin login did not return a valid session.')
  }

  async function completeTOTPLogin(challengeToken, totpCode) {
    return login('', '', totpCode, '', challengeToken)
  }

  async function logout() {
    try { await callAdminFunction('admin-logout') } catch { /* ignore */ }
    clearAdminSession()
    setAdmin(null)
  }

  async function writeAuditLog(action, details = {}, targetType = null, targetId = null) {
    try {
      await callAdminFunction('admin-audit', { action, details, target_type: targetType, target_id: targetId })
    } catch {
      // best effort only
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
    return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">Checking admin session...</div>
  }

  if (!isLoggedIn) return null
  return children
}
