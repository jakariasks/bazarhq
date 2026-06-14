import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const Ctx = createContext({
  session: null, user: null, loading: true,
  emailVerified: false, signOut: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      queryClient.invalidateQueries()
    })
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [queryClient])

  const user = session?.user ?? null
  // SRS M1: email must be confirmed before accessing dashboard
  const emailVerified = user
    ? (user.email_confirmed_at != null || user.user_metadata?.signup_method === 'phone')
    : false

  return (
    <Ctx.Provider value={{
      session, user, loading, emailVerified,
      signOut: async () => {
        await supabase.auth.signOut()
        queryClient.clear()
      },
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
