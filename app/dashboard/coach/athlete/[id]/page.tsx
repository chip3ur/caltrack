'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ProgressionChart } from '@/components/ui/progression-chart'
import Link from 'next/link'

interface AthleteProfile {
  id: string
  full_name: string | null
  daily_calories: number | null
  bio: string | null
}

interface WorkoutLog {
  id: string
  date: string
  duration_min: number | null
  rpe: number | null
  completed: boolean
  program_name?: string
  sets?: { exercise_name: string; weight_kg: number | null; reps: number | null; is_pr: boolean }[]
}

interface PR {
  exercise_id: string
  exercise_name: string
  max_weight: number
  best_reps: number
  achieved_at: string
}

interface Meal {
  id: string
  food_name: string
  calories: number
  meal_type: string
  quantity_g: number
  protein_g: number
  carbs_g: number
  fat_g: number
  eaten_at: string
}

interface Progression {
  session_date: string
  max_weight: number
  total_volume: number
  avg_rpe: number
}

export default function CoachAthleteView() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null)
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [prs, setPrs] = useState<PR[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [progression, setProgression] = useState<Progression[]>([])
  const [loadingChart, setLoadingChart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'sport' | 'nutrition' | 'prs'>('sport')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    // Vérifier que l'utilisateur est bien coach de cet élève
    const { data: rel } = await supabase
      .from('coach_athletes')
      .select('id')
      .eq('coach_id', session.user.id)
      .eq('athlete_id', id)
      .eq('active', true)
      .single()

    if (!rel) { router.push('/dashboard/coach'); return }

    const [{ data: profile }, { data: logsData }, { data: prsData }, { data: mealsData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, daily_calories, bio').eq('id', id).single(),
      supabase.from('workout_logs')
        .select('id, date, duration_min, rpe, completed, programs(name), workout_sets(set_number, reps, weight_kg, is_pr, exercises(name))')
        .eq('athlete_id', id)
        .order('date', { ascending: false })
        .limit(30),
      supabase.rpc('get_exercise_prs', { p_athlete_id: id }),
      supabase.rpc('get_athlete_meals', { p_athlete_id: id }),
    ])

    if (profile) setAthlete(profile)
    if (logsData) {
      setLogs(logsData.map((l: any) => ({
        ...l,
        program_name: l.programs?.name,
        sets: (l.workout_sets ?? []).map((s: any) => ({
          exercise_name: s.exercises?.name ?? '',
          weight_kg: s.weight_kg,
          reps: s.reps,
          is_pr: s.is_pr,
        })),
      })))
    }
    if (prsData) {
      setPrs(prsData)
      if (prsData.length > 0) {
        setSelectedExercise(prsData[0].exercise_id)
        loadProgression(session.user.id, prsData[0].exercise_id)
      }
    }
    if (mealsData) setMeals(mealsData)
    setLoading(false)
  }

  async function loadProgression(coachId: string, exerciseId: string) {
    setLoadingChart(true)
    const { data } = await supabase.rpc('get_exercise_progression', {
      p_athlete_id: id,
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

  // Grouper les repas par jour
  const mealsByDay: Record<string, { meals: Meal[]; total: number }> = {}
  meals.forEach(m => {
    const date = m.eaten_at.split('T')[0]
    if (!mealsByDay[date]) mealsByDay[date] = { meals: [], total: 0 }
    mealsByDay[date].meals.push(m)
    mealsByDay[date].total += m.calories
  })
  const mealDays = Object.entries(mealsByDay).sort(([a], [b]) => b.localeCompare(a))

  const weeklyAvgCalories = mealDays.length > 0
    ? Math.round(mealDays.slice(0, 7).reduce((s, [, d]) => s + d.total, 0) / Math.min(mealDays.length, 7))
    : 0

  const exerciseNames = [...new Set(logs.flatMap(l => (l.sets ?? []).map(s => s.exercise_name)).filter(Boolean))]

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <Link href="/dashboard/coach" className="text-xs text-gray-500 hover:text-gray-300 block">← Mes élèves</Link>

        {/* Profil */}
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-2xl font-bold text-blue-300 flex-shrink-0">
            {(athlete?.full_name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{athlete?.full_name || 'Sans nom'}</h1>
            {athlete?.bio && <p className="text-sm text-gray-400 mt-0.5 truncate">{athlete.bio}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{logs.length}</div>
              <div className="text-xs text-gray-500">Séances</div>
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{prs.length}</div>
              <div className="text-xs text-gray-500">Records</div>
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{athlete?.daily_calories ?? '—'}</div>
              <div className="text-xs text-gray-500">kcal/j objectif</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
          {([
            { key: 'sport', label: '🏋️ Sport' },
            { key: 'prs', label: '🏆 Records' },
            { key: 'nutrition', label: '🥗 Nutrition' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── SPORT ── */}
        {tab === 'sport' && (
          <div className="space-y-4">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-sm">Aucune séance enregistrée</p>
              </div>
            ) : logs.map(log => {
              const prsInLog = (log.sets ?? []).filter(s => s.is_pr)
              const isExpanded = expandedLog === log.id
              const exoNames = [...new Set((log.sets ?? []).map(s => s.exercise_name).filter(Boolean))]
              return (
                <div key={log.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <button className="w-full text-left p-4" onClick={() => setExpandedLog(isExpanded ? null : log.id)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">
                          {new Date(log.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                        {log.program_name && <div className="text-xs text-gray-500 mt-0.5">{log.program_name}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        {prsInLog.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">
                            🏆 {prsInLog.length} PR
                          </span>
                        )}
                        {log.duration_min && <span className="text-xs text-gray-500">⏱ {log.duration_min}min</span>}
                        {log.rpe && <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-primary)]">RPE {log.rpe}</span>}
                        <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {!isExpanded && exoNames.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1.5 truncate">{exoNames.join(' · ')}</p>
                    )}
                  </button>

                  {isExpanded && (log.sets ?? []).length > 0 && (
                    <div className="border-t border-[var(--border)] px-4 pb-4 pt-3 space-y-3">
                      {exoNames.map(name => {
                        const exoSets = (log.sets ?? []).filter(s => s.exercise_name === name)
                        return (
                          <div key={name}>
                            <div className="text-xs font-semibold text-[var(--text-primary)] mb-1.5">{name}</div>
                            <div className="flex flex-wrap gap-2">
                              {exoSets.map((s, i) => (
                                <div key={i} className={`px-2.5 py-1.5 rounded-lg text-xs ${s.is_pr ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/20' : 'bg-[var(--bg-input)] text-gray-400'}`}>
                                  {s.reps && `${s.reps} reps`}{s.weight_kg && ` · ${s.weight_kg}kg`}
                                  {s.is_pr && ' 🏆'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── RECORDS + GRAPHIQUES ── */}
        {tab === 'prs' && (
          <div className="space-y-6">
            {prs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">🏆</div>
                <p className="text-sm">Aucun record enregistré</p>
              </div>
            ) : (
              <>
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
                  <ProgressionChart
                    data={progression}
                    exerciseName={prs.find(p => p.exercise_id === selectedExercise)?.exercise_name}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── NUTRITION ── */}
        {tab === 'nutrition' && (
          <div className="space-y-4">
            {/* Stats semaine */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
                <div className="text-xl font-bold text-[var(--text-primary)]">{weeklyAvgCalories}</div>
                <div className="text-xs text-gray-500 mt-1">Moy. kcal/jour (7j)</div>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
                <div className="text-xl font-bold text-[var(--text-primary)]">{athlete?.daily_calories ?? '—'}</div>
                <div className="text-xs text-gray-500 mt-1">Objectif kcal</div>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
                <div className={`text-xl font-bold ${weeklyAvgCalories > 0 && athlete?.daily_calories
                  ? weeklyAvgCalories >= athlete.daily_calories * 0.9 ? 'text-green-400' : 'text-red-400'
                  : 'text-[var(--text-primary)]'}`}>
                  {weeklyAvgCalories > 0 && athlete?.daily_calories
                    ? `${Math.round(weeklyAvgCalories / athlete.daily_calories * 100)}%`
                    : '—'}
                </div>
                <div className="text-xs text-gray-500 mt-1">Respect objectif</div>
              </div>
            </div>

            {mealDays.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">🥗</div>
                <p className="text-sm">Aucun repas enregistré</p>
              </div>
            ) : mealDays.map(([date, { meals: dayMeals, total }]) => {
              const label = (() => {
                const today = new Date().toISOString().split('T')[0]
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
                if (date === today) return "Aujourd'hui"
                if (date === yesterday) return 'Hier'
                return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              })()
              const goal = athlete?.daily_calories ?? 2000
              const pct = Math.min(100, Math.round(total / goal * 100))
              const isOver = total > goal

              return (
                <div key={date} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-[var(--text-primary)] capitalize">{label}</span>
                      <span className={`text-sm font-bold ${isOver ? 'text-red-400' : 'text-green-400'}`}>
                        {total} <span className="text-gray-500 font-normal text-xs">/ {goal} kcal</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <div className="space-y-1.5">
                      {dayMeals.map(m => (
                        <div key={m.id} className="flex items-center justify-between text-xs text-gray-400">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">
                              {m.meal_type === 'petit-dejeuner' ? '🌅' : m.meal_type === 'dejeuner' ? '☀️' : m.meal_type === 'diner' ? '🌙' : '🍎'}
                            </span>
                            <span className="text-[var(--text-primary)]">{m.food_name}</span>
                            <span className="text-gray-600">{m.quantity_g}g</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {m.protein_g > 0 && <span className="text-blue-400">P {m.protein_g}g</span>}
                            <span className="font-medium text-[var(--text-primary)]">{m.calories} kcal</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
