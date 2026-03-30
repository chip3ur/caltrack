'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface WorkoutLog {
  id: string
  date: string
  duration_min: number | null
  rpe: number | null
  completed: boolean
  program_name?: string
}

interface AthleteProfile {
  id: string
  full_name: string | null
  email: string
  daily_calories: number | null
  bio: string | null
}

interface PR {
  exercise_id: string
  exercise_name: string
  max_weight: number
  best_reps: number
  achieved_at: string
}

export default function CoachAthleteView() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null)
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [prs, setPrs] = useState<PR[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'seances' | 'prs'>('seances')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const [{ data: profile }, { data: logsData }, { data: prsData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, daily_calories, bio').eq('id', id).single(),
      supabase.from('workout_logs')
        .select('id, date, duration_min, rpe, completed, programs(name)')
        .eq('athlete_id', id)
        .order('date', { ascending: false })
        .limit(20),
      supabase.rpc('get_exercise_prs', { p_athlete_id: id }),
    ])

    // Récupérer l'email via admin
    const { data: { session } } = await supabase.auth.getSession()
    if (session && profile) {
      setAthlete({ ...profile, email: '' })
    }
    if (logsData) {
      setLogs(logsData.map((l: any) => ({ ...l, program_name: l.programs?.name })))
    }
    if (prsData) setPrs(prsData)
    setLoading(false)
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        <Link href="/dashboard/coach" className="text-xs text-gray-500 hover:text-gray-300 block">← Mes élèves</Link>

        {/* Profil */}
        <div className="flex items-center gap-4 p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xl font-bold text-blue-300">
            {(athlete?.full_name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{athlete?.full_name || 'Sans nom'}</h1>
            {athlete?.bio && <p className="text-sm text-gray-400 mt-0.5">{athlete.bio}</p>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{athlete?.daily_calories ?? '—'}</div>
            <div className="text-xs text-gray-500">kcal/jour</div>
          </div>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{logs.length}</div>
            <div className="text-xs text-gray-500 mt-1">Séances totales</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{logs.filter(l => l.completed).length}</div>
            <div className="text-xs text-gray-500 mt-1">Séances terminées</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{prs.length}</div>
            <div className="text-xs text-gray-500 mt-1">Records personnels</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-[var(--border)] pb-0">
          {(['seances', 'prs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-blue-500 text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {t === 'seances' ? '📅 Séances' : '🏆 Records (PR)'}
            </button>
          ))}
        </div>

        {tab === 'seances' && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Aucune séance enregistrée</p>
            ) : logs.map(log => (
              <div key={log.id} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.completed ? 'bg-green-400' : 'bg-gray-600'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {new Date(log.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  {log.program_name && <div className="text-xs text-gray-500">{log.program_name}</div>}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {log.duration_min && <span>⏱ {log.duration_min}min</span>}
                  {log.rpe && <span className="px-2 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-primary)]">RPE {log.rpe}/10</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'prs' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8 col-span-2">Aucun record enregistré</p>
            ) : prs.map(pr => (
              <div key={pr.exercise_id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="font-medium text-sm text-[var(--text-primary)] mb-2">{pr.exercise_name}</div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-yellow-400">{pr.max_weight}kg</span>
                  <span className="text-sm text-gray-500 mb-0.5">× {pr.best_reps} reps</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">{new Date(pr.achieved_at).toLocaleDateString('fr-FR')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
