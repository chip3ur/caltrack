'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ProgressionChart } from '@/components/ui/progression-chart'
import Link from 'next/link'

interface Exercise {
  id: string
  name: string
}

interface PR {
  exercise_id: string
  exercise_name: string
  max_weight: number
  best_reps: number
  achieved_at: string
}

interface Progression {
  session_date: string
  max_weight: number
  total_volume: number
  avg_rpe: number
}

export default function AthleteProgressPage() {
  const router = useRouter()
  const [prs, setPrs] = useState<PR[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [progression, setProgression] = useState<Progression[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingChart, setLoadingChart] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role === 'coach') { router.push('/dashboard/coach'); return }

    const [{ data: prsData }, { data: exosData }] = await Promise.all([
      supabase.rpc('get_exercise_prs', { p_athlete_id: session.user.id }),
      supabase.from('exercises').select('id, name').eq('is_public', true).order('name'),
    ])

    if (prsData) setPrs(prsData)
    if (exosData) setExercises(exosData)

    // Sélectionner le premier exercice avec des données
    if (prsData && prsData.length > 0) {
      setSelectedExercise(prsData[0].exercise_id)
      loadProgression(session.user.id, prsData[0].exercise_id)
    }
    setLoading(false)
  }

  async function loadProgression(athleteId: string, exerciseId: string) {
    setLoadingChart(true)
    const { data } = await supabase.rpc('get_exercise_progression', {
      p_athlete_id: athleteId,
      p_exercise_id: exerciseId,
    })
    if (data) setProgression(data)
    setLoadingChart(false)
  }

  async function selectExercise(exerciseId: string) {
    setSelectedExercise(exerciseId)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) loadProgression(session.user.id, exerciseId)
  }

  const selectedName = exercises.find(e => e.id === selectedExercise)?.name
    ?? prs.find(p => p.exercise_id === selectedExercise)?.exercise_name

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Ma progression</h1>
          <Link href="/dashboard/athlete" className="text-sm text-gray-400 hover:text-[var(--text-primary)]">← Programme</Link>
        </div>

        {prs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">📈</div>
            <p className="text-sm">Aucune donnée pour l&apos;instant</p>
            <p className="text-xs mt-1">Enregistre ta première séance pour voir ta progression</p>
          </div>
        ) : (
          <>
            {/* Records personnels */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">🏆 Records personnels</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {prs.map(pr => (
                  <button key={pr.exercise_id}
                    onClick={() => selectExercise(pr.exercise_id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedExercise === pr.exercise_id
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-blue-500/30'
                    }`}>
                    <div className="text-xs text-gray-500 mb-1 truncate">{pr.exercise_name}</div>
                    <div className="text-xl font-bold text-yellow-400">{pr.max_weight}kg</div>
                    <div className="text-xs text-gray-500">× {pr.best_reps} reps</div>
                    <div className="text-xs text-gray-600 mt-1">{new Date(pr.achieved_at).toLocaleDateString('fr-FR')}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sélecteur exercice + graphique */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">📊 Courbe de progression</h2>

              <div className="flex gap-2 flex-wrap">
                {prs.map(pr => (
                  <button key={pr.exercise_id}
                    onClick={() => selectExercise(pr.exercise_id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedExercise === pr.exercise_id
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--bg-card)] border border-[var(--border)] text-gray-400 hover:border-blue-500/30'
                    }`}>
                    {pr.exercise_name}
                  </button>
                ))}
              </div>

              {loadingChart ? (
                <div className="h-48 flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl">
                  <p className="text-sm text-gray-500">Chargement...</p>
                </div>
              ) : (
                <ProgressionChart data={progression} exerciseName={selectedName} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
