'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const { error } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', (await supabase.auth.getSession()).data.session?.user.id)
    .single()
  router.push(profile ? '/dashboard' : '/onboarding')
}
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-full max-w-sm bg-[#111118] border border-[#2E2E3E] rounded-2xl p-8">
        <h1 className="text-2xl text-white mb-1">CalTrack</h1>
        <p className="text-sm text-gray-500 mb-6">nutrition · performance · résultats</p>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setIsSignup(false)}
            className={`flex-1 py-2 rounded-lg text-sm ${!isSignup ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'text-gray-500'}`}>
            Connexion
          </button>
          <button onClick={() => setIsSignup(true)}
            className={`flex-1 py-2 rounded-lg text-sm ${isSignup ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'text-gray-500'}`}>
            Inscription
          </button>
        </div>

        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full bg-[#1E1E28] border border-[#2E2E3E] rounded-xl px-4 py-3 text-white text-sm mb-3 outline-none" />
        <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full bg-[#1E1E28] border border-[#2E2E3E] rounded-xl px-4 py-3 text-white text-sm mb-4 outline-none" />

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium">
          {loading ? 'Chargement...' : isSignup ? 'Créer mon compte' : 'Se connecter'}
        </button>
      </div>
    </div>
  )
}