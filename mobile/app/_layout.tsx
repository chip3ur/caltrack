import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { ThemeProvider } from '../lib/theme'
import type { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!ready) return
    const inAuth = segments[0] === '(auth)'
    const inProtected = segments[0] === '(app)'
    if (!session && inProtected) {
      router.replace('/(auth)/login')
    } else if (session && inAuth) {
      router.replace('/(app)')
    }
    // Allow (onboarding) when session exists — login handles the redirect there
  }, [session, ready, segments])

  return <ThemeProvider><Slot /></ThemeProvider>
}
