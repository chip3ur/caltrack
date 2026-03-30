'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Athlete {
  id: string
  full_name: string | null
  email: string
  daily_calories: number | null
  joined_at: string
  last_workout?: string | null
  workout_count?: number
}

export default function CoachDashboard() {
  const router = useRouter()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadAthletes()
  }, [])

  async function loadAthletes() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    // Vérifier rôle coach — rediriger si athlète
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (!profile?.role) { router.push('/dashboard/onboarding'); return }
    if (profile.role !== 'coach') { router.push('/dashboard/athlete'); return }

    // Charger les élèves via SECURITY DEFINER
    const { data } = await supabase.rpc('get_coach_athletes')
    if (data) setAthletes(data)
    setLoading(false)
  }

  async function generateInvite() {
    setGenerating(true)
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase.from('coach_invites').insert({
      coach_id: session.user.id,
      code,
    })
    setInviteCode(code)
    setGenerating(false)
  }

  async function copyCode() {
    if (!inviteCode) return
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mes élèves</h1>
            <p className="text-sm text-gray-400 mt-1">{athletes.length} élève{athletes.length !== 1 ? 's' : ''} suivi{athletes.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/dashboard/coach/programs"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
            📋 Programmes
          </Link>
        </div>

        {/* Invitation */}
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <h2 className="font-semibold text-sm text-[var(--text-primary)] mb-3">Inviter un élève</h2>
          {inviteCode ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]">
                <span className="font-mono font-bold text-lg tracking-widest text-blue-300">{inviteCode}</span>
                <span className="text-xs text-gray-500">— valide 7 jours</span>
              </div>
              <button onClick={copyCode}
                className="px-4 py-3 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--bg-surface)] transition-colors text-[var(--text-primary)]">
                {copied ? '✓ Copié' : 'Copier'}
              </button>
              <button onClick={() => setInviteCode(null)}
                className="px-4 py-3 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--bg-surface)] transition-colors text-gray-400">
                Nouveau
              </button>
            </div>
          ) : (
            <button onClick={generateInvite} disabled={generating}
              className="px-4 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-blue-500/40 transition-colors">
              {generating ? 'Génération...' : '+ Générer un code d\'invitation'}
            </button>
          )}
          <p className="text-xs text-gray-500 mt-2">L&apos;élève entre ce code dans son profil pour te rejoindre</p>
        </div>

        {/* Liste élèves */}
        {athletes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-sm">Aucun élève pour l&apos;instant</p>
            <p className="text-xs mt-1">Génère un code d&apos;invitation ci-dessus</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {athletes.map((athlete) => (
              <Link key={athlete.id} href={`/dashboard/coach/athlete/${athlete.id}`}
                className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-300">
                    {(athlete.full_name || athlete.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[var(--text-primary)] truncate">{athlete.full_name || 'Sans nom'}</div>
                    <div className="text-xs text-gray-500 truncate">{athlete.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-input)]">
                    <div className="text-xs text-gray-500 mb-0.5">Séances</div>
                    <div className="font-bold text-[var(--text-primary)]">{athlete.workout_count ?? 0}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--bg-input)]">
                    <div className="text-xs text-gray-500 mb-0.5">Calories/j</div>
                    <div className="font-bold text-[var(--text-primary)]">{athlete.daily_calories ?? '—'}</div>
                  </div>
                </div>
                {athlete.last_workout && (
                  <p className="text-xs text-gray-500 mt-3">
                    Dernière séance : {new Date(athlete.last_workout).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
