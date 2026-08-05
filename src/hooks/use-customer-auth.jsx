import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  CUSTOMER_OAUTH_INTENT_KEY,
  ROLE_CUSTOMER,
  ROLE_MERCHANT,
  activateMyRole,
  clearAllRoleIntents,
  clearStoredIntent,
  fetchMyRoles,
  getCurrentSessionUser,
  getStoredIntent,
  hasRole,
  safeInternalPath,
  setStoredIntent,
  signOutDifferentUser,
} from '@/lib/auth-roles'

const CustomerAuthContext = createContext(null)

function getDisplayName(user, fallback = '') {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    fallback ||
    user?.email?.split('@')[0] ||
    'Customer'
  )
}

function isExistingAccountResult(data) {
  return !!data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0
}

function isExistingAccountError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('already registered') || message.includes('already exists') || message.includes('user already')
}

export function CustomerAuthProvider({ children }) {
  const [rawSession, setRawSession] = useState(null)
  const [roles, setRoles] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [roleError, setRoleError] = useState('')
  const resolutionRef = useRef(0)

  const getProfile = useCallback(async (userId) => {
    if (!userId) return null

    const { data, error } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Customer profile load failed:', error.message)
    }

    return data || null
  }, [])

  const applySession = useCallback(async (session) => {
    const resolutionId = ++resolutionRef.current
    const user = session?.user || null
    setRawSession(session || null)
    setRoleError('')

    if (!user) {
      setRoles([])
      setProfile(null)
      return []
    }

    try {
      let nextRoles = await fetchMyRoles(user)
      const oauthIntent = getStoredIntent(CUSTOMER_OAUTH_INTENT_KEY)

      if (oauthIntent && !hasRole(nextRoles, ROLE_CUSTOMER)) {
        nextRoles = await activateMyRole(ROLE_CUSTOMER, {
          fullName: getDisplayName(user),
          phone: user.user_metadata?.phone || null,
        })
      }

      if (oauthIntent) clearStoredIntent(CUSTOMER_OAUTH_INTENT_KEY)
      const nextProfile = hasRole(nextRoles, ROLE_CUSTOMER) ? await getProfile(user.id) : null
      if (resolutionId !== resolutionRef.current) return nextRoles
      setRoles(nextRoles)
      setProfile(nextProfile)
      return nextRoles
    } catch (error) {
      if (resolutionId !== resolutionRef.current) return []
      console.error('Customer role resolution failed:', error)
      setRoles([])
      setProfile(null)
      setRoleError(error?.message || 'Could not load customer access.')
      return []
    }
  }, [getProfile])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      await applySession(data.session)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true)
      setTimeout(async () => {
        if (!mounted) return
        await applySession(session)
        if (mounted) setLoading(false)
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [applySession])

  const rawUser = rawSession?.user || null
  const isCustomer = hasRole(roles, ROLE_CUSTOMER)
  const customer = isCustomer ? rawUser : null

  const activateCustomerRole = useCallback(async (details = {}) => {
    const resolutionId = ++resolutionRef.current
    const current = rawSession?.user || await getCurrentSessionUser()
    if (!current) throw new Error('Sign in before adding customer access.')

    const nextRoles = await activateMyRole(ROLE_CUSTOMER, {
      fullName: details.fullName || getDisplayName(current),
      phone: details.phone || current.user_metadata?.phone || null,
    })

    const nextProfile = await getProfile(current.id)
    if (resolutionId === resolutionRef.current) {
      setRoles(nextRoles)
      setRoleError('')
      setProfile(nextProfile)
    }
    return nextRoles
  }, [rawSession, getProfile])

  const refreshRoles = useCallback(async (sessionOverride = null) => {
    const resolutionId = ++resolutionRef.current
    const session = sessionOverride || rawSession
    if (!session?.user) {
      setRoles([])
      setProfile(null)
      return []
    }

    const nextRoles = await fetchMyRoles(session.user)
    const nextProfile = hasRole(nextRoles, ROLE_CUSTOMER) ? await getProfile(session.user.id) : null
    if (resolutionId !== resolutionRef.current) return nextRoles
    setRoles(nextRoles)
    setRoleError('')
    setProfile(nextProfile)
    return nextRoles
  }, [rawSession, getProfile])

  async function signUp({ email, password, fullName, phone, redirectTo = '/customer/account' }) {
    const resolutionId = ++resolutionRef.current
    const normalizedEmail = email.trim().toLowerCase()
    const cleanedName = fullName.trim()
    const cleanedPhone = phone?.trim() || null
    const safeRedirect = safeInternalPath(redirectTo, '/customer/account')

    const current = await signOutDifferentUser(normalizedEmail)
    clearAllRoleIntents()

    if (current) {
      const nextRoles = await activateMyRole(ROLE_CUSTOMER, {
        fullName: cleanedName || getDisplayName(current),
        phone: cleanedPhone,
      })
      const sessionResult = await supabase.auth.getSession()
      const nextProfile = await getProfile(current.id)
      if (resolutionId === resolutionRef.current) {
        setRoles(nextRoles)
        setRawSession(sessionResult.data.session || null)
        setProfile(nextProfile)
      }
      return { user: current, session: sessionResult.data.session, existingAccount: true, roleAdded: true }
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/customer/login?verified=1&redirect=${encodeURIComponent(safeRedirect)}`,
        data: {
          role: ROLE_CUSTOMER,
          roles: [ROLE_CUSTOMER],
          full_name: cleanedName,
          phone: cleanedPhone,
          signup_method: 'email',
        },
      },
    })

    if (error && !isExistingAccountError(error)) throw error

    if (isExistingAccountResult(data) || isExistingAccountError(error)) {
      const login = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (login.error) {
        const existingError = new Error(
          login.error.message?.toLowerCase().includes('email not confirmed')
            ? login.error.message
            : 'This email already has a BazarHQ account. Use its existing password or Google sign-in to add customer access.',
        )
        existingError.code = 'ACCOUNT_EXISTS'
        throw existingError
      }

      const nextRoles = await activateMyRole(ROLE_CUSTOMER, { fullName: cleanedName, phone: cleanedPhone })
      if (resolutionId === resolutionRef.current) {
        setRawSession(login.data.session)
        setRoles(nextRoles)
        setProfile(await getProfile(login.data.user.id))
      }
      return { ...login.data, existingAccount: true, roleAdded: true }
    }

    if (data.session?.user) {
      const nextRoles = await activateMyRole(ROLE_CUSTOMER, { fullName: cleanedName, phone: cleanedPhone })
      if (resolutionId === resolutionRef.current) {
        setRawSession(data.session)
        setRoles(nextRoles)
        setProfile(await getProfile(data.session.user.id))
      }
    }

    return data
  }

  async function signIn({ email, password }) {
    const resolutionId = ++resolutionRef.current
    const normalizedEmail = email.trim().toLowerCase()
    const current = await signOutDifferentUser(normalizedEmail)
    clearAllRoleIntents()

    let session
    let user

    if (current) {
      const result = await supabase.auth.getSession()
      session = result.data.session
      user = current
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error) throw error
      session = data.session
      user = data.user
    }

    const nextRoles = await activateMyRole(ROLE_CUSTOMER, {
      fullName: getDisplayName(user),
      phone: user.user_metadata?.phone || null,
    })

    if (resolutionId === resolutionRef.current) {
      setRawSession(session)
      setRoles(nextRoles)
      setProfile(await getProfile(user.id))
    }
    return { session, user, roleAdded: true }
  }

  async function signInWithGoogle(redirectTo = '/customer/account') {
    const safeRedirect = safeInternalPath(redirectTo, '/customer/account')
    clearAllRoleIntents()
    setStoredIntent(CUSTOMER_OAUTH_INTENT_KEY, { redirectTo: safeRedirect })

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${safeRedirect}`,
        queryParams: { prompt: 'select_account' },
      },
    })

    if (error) {
      clearStoredIntent(CUSTOMER_OAUTH_INTENT_KEY)
      throw error
    }
  }

  async function signOut() {
    clearAllRoleIntents()
    await supabase.auth.signOut()
    setRawSession(null)
    setRoles([])
    setProfile(null)
  }

  async function updateProfile({ fullName, phone }) {
    if (!customer) throw new Error('Customer access is required to update this profile.')

    const nextProfile = {
      id: customer.id,
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      account_status: 'active',
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('customer_profiles')
      .upsert(nextProfile, { onConflict: 'id' })
      .select('*')
      .maybeSingle()

    if (error) throw error
    setProfile(data || nextProfile)

    await supabase.auth.updateUser({
      data: {
        ...customer.user_metadata,
        full_name: nextProfile.full_name,
        phone: nextProfile.phone,
      },
    })
  }

  async function changePassword({ currentPassword, newPassword }) {
    if (!customer?.email) throw new Error('Email login is required to change your password here.')

    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: customer.email,
      password: currentPassword,
    })
    if (reAuthError) throw new Error('Your current password is incorrect.')

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  async function deleteAccount() {
    if (!customer) return
    const { error } = await supabase.rpc('delete_customer_account')
    if (error) throw error
    setRoles((current) => current.filter((role) => role !== ROLE_CUSTOMER))
    setProfile(null)
  }

  const value = useMemo(() => ({
    customer,
    rawUser,
    rawSession,
    profile,
    roles,
    loading,
    roleError,
    isLoggedIn: !!customer,
    isCustomer,
    hasMerchantRole: hasRole(roles, ROLE_MERCHANT),
    activateCustomerRole,
    refreshRoles,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    changePassword,
    deleteAccount,
    refetchProfile: async () => {
      if (!customer) return null
      const next = await getProfile(customer.id)
      setProfile(next)
      return next
    },
  }), [
    customer,
    rawUser,
    rawSession,
    profile,
    roles,
    loading,
    roleError,
    isCustomer,
    activateCustomerRole,
    refreshRoles,
    getProfile,
  ])

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider')
  return ctx
}
