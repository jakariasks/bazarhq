import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  MERCHANT_OAUTH_INTENT_KEY,
  ROLE_CUSTOMER,
  ROLE_MERCHANT,
  activateMyRole,
  clearAllRoleIntents,
  clearStoredIntent,
  fetchMyRoles,
  getStoredIntent,
  hasRole,
} from '@/lib/auth-roles'

const Ctx = createContext({
  session: null,
  user: null,
  rawSession: null,
  rawUser: null,
  roles: [],
  loading: true,
  roleError: '',
  emailVerified: false,
  isMerchant: false,
  hasCustomerRole: false,
  wrongRole: false,
  wrongRoleEmail: null,
  activateMerchantRole: async () => [],
  refreshRoles: async () => [],
  signOut: async () => {},
})

function getDisplayName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Merchant'
  )
}

async function resolveRoles(nextSession) {
  const user = nextSession?.user || null
  if (!user) return []

  let roles = await fetchMyRoles(user)
  const merchantIntent = getStoredIntent(MERCHANT_OAUTH_INTENT_KEY)

  if (merchantIntent && !hasRole(roles, ROLE_MERCHANT)) {
    roles = await activateMyRole(ROLE_MERCHANT, {
      fullName: getDisplayName(user),
    })
  }

  if (merchantIntent) clearStoredIntent(MERCHANT_OAUTH_INTENT_KEY)
  return roles
}

export function AuthProvider({ children }) {
  const [rawSession, setRawSession] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleError, setRoleError] = useState('')
  const queryClient = useQueryClient()
  const resolutionRef = useRef(0)

  const applySession = useCallback(async (nextSession) => {
    const resolutionId = ++resolutionRef.current
    setRawSession(nextSession || null)
    setRoleError('')

    if (!nextSession?.user) {
      setRoles([])
      queryClient.invalidateQueries()
      return []
    }

    try {
      const nextRoles = await resolveRoles(nextSession)
      if (resolutionId !== resolutionRef.current) return nextRoles
      setRoles(nextRoles)
      queryClient.invalidateQueries()
      return nextRoles
    } catch (error) {
      if (resolutionId !== resolutionRef.current) return []
      console.error('Merchant role resolution failed:', error)
      setRoles([])
      setRoleError(error?.message || 'Could not load account access.')
      return []
    }
  }, [queryClient])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      await applySession(data.session)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true)
      setTimeout(async () => {
        if (!mounted) return
        await applySession(nextSession)
        if (mounted) setLoading(false)
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [applySession])

  const refreshRoles = useCallback(async (sessionOverride = null) => {
    const nextSession = sessionOverride || rawSession
    if (!nextSession?.user) {
      setRoles([])
      return []
    }

    const resolutionId = ++resolutionRef.current
    const nextRoles = await resolveRoles(nextSession)
    if (resolutionId !== resolutionRef.current) return nextRoles
    setRoles(nextRoles)
    setRoleError('')
    queryClient.invalidateQueries()
    return nextRoles
  }, [rawSession, queryClient])

  const activateMerchantRole = useCallback(async (details = {}) => {
    const resolutionId = ++resolutionRef.current
    if (!rawSession?.user) throw new Error('Sign in before adding merchant access.')

    const nextRoles = await activateMyRole(ROLE_MERCHANT, {
      fullName: details.fullName || getDisplayName(rawSession.user),
      phone: details.phone || null,
    })

    if (resolutionId === resolutionRef.current) {
      setRoles(nextRoles)
      setRoleError('')
      queryClient.invalidateQueries()
    }
    return nextRoles
  }, [rawSession, queryClient])

  const rawUser = rawSession?.user ?? null
  const isMerchant = hasRole(roles, ROLE_MERCHANT)
  const hasCustomerRole = hasRole(roles, ROLE_CUSTOMER)
  const session = isMerchant ? rawSession : null
  const user = session?.user ?? null
  const wrongRole = !!rawUser && !isMerchant

  const emailVerified = rawUser
    ? rawUser.email_confirmed_at != null || rawUser.app_metadata?.provider === 'google'
    : false

  const value = useMemo(() => ({
    session,
    user,
    rawSession,
    rawUser,
    roles,
    loading,
    roleError,
    emailVerified,
    isMerchant,
    hasCustomerRole,
    wrongRole,
    wrongRoleEmail: wrongRole ? rawUser?.email || null : null,
    activateMerchantRole,
    refreshRoles,
    signOut: async () => {
      clearAllRoleIntents()
      await supabase.auth.signOut()
      setRawSession(null)
      setRoles([])
      setRoleError('')
      queryClient.clear()
    },
  }), [
    session,
    user,
    rawSession,
    rawUser,
    roles,
    loading,
    roleError,
    emailVerified,
    isMerchant,
    hasCustomerRole,
    wrongRole,
    activateMerchantRole,
    refreshRoles,
    queryClient,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
