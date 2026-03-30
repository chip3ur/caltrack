'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function chooseRole(role: 'coach' | 'athlete') {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    await supabase.from('profiles').update({ role }).eq('id', session.user.id)
    router.push(role === 'coach' ? '/dashboard/coach' : '/dashboard/athlete')
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Bienvenue sur CalTrack</h1>
          <p className="text-sm text-gray-400">Comment vas-tu utiliser l&apos;application ?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => chooseRole('coach')}
            disabled={loading}
            className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
          >
            <span className="text-5xl">🏋️‍♂️</span>
            <div className="text-center">
              <div className="font-semibold text-[var(--text-primary)] mb-1">Je suis Coach</div>
              <div className="text-xs text-gray-500">Je suis mes élèves, crée des programmes, analyse leur progression</div>
            </div>
          </button>

          <button
            onClick={() => chooseRole('athlete')}
            disabled={loading}
            className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
          >
            <span className="text-5xl">🎯</span>
            <div className="text-center">
              <div className="font-semibold text-[var(--text-primary)] mb-1">Je suis Athlète</div>
              <div className="text-xs text-gray-500">Je suis mon programme, log mes séances, vois ma progression</div>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">Tu pourras changer ce choix dans ton profil</p>
      </div>
    </div>
  )
}
