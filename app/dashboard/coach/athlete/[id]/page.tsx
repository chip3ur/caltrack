'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ProgressionChart } from '@/components/ui/progression-chart'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartTooltip, ReferenceLine,
  BarChart, Bar,
} from 'recharts'
import Link from 'next/link'

interface AthleteProfile {
  id: string
  full_name: string | null
  daily_calories: number | null
  bio: string | null
  weight_kg: number | null
  goal: string | null
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
  eaten_at: string
  protein_g: number
  carbs_g: number
  fat_g: number
  foods?: { protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number } | null
}

interface WeightLog {
  weight_kg: number
  logged_at: string
}

interface DayStat {
  date: string
  label: string
  total: number
  protein: number
  carbs: number
  fat: number
  color: string
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
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [weekStats, setWeekStats] = useState<DayStat[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [progression, setProgression] = useState<Progression[]>([])
  const [loadingChart, setLoadingChart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mealsError, setMealsError] = useState<string | null>(null)
  const [tab, setTab] = useState<'sport' | 'nutrition' | 'prs'>('sport')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [nutriTab, setNutriTab] = useState<'semaine' | 'poids' | 'repas'>('semaine')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: rel } = await supabase
      .from('coach_athletes')
      .select('id')
      .eq('coach_id', session.user.id)
      .eq('athlete_id', id)
      .eq('active', true)
      .single()

    if (!rel) { router.push('/dashboard/coach'); return }

    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const [
      { data: profile },
      { data: logsData },
      { data: prsData },
      { data: mealsData, error: mealsErr },
      { data: weightData },
    ] = await Promise.all([
      supabase.from('profiles').select('id, full_name, daily_calories, bio, weight_kg, goal').eq('id', id).single(),
      supabase.from('workout_logs')
        .select('id, date, duration_min, rpe, completed, programs(name), workout_sets(set_number, reps, weight_kg, is_pr, exercises(name))')
        .eq('athlete_id', id)
        .order('date', { ascending: false })
        .limit(30),
      supabase.rpc('get_exercise_prs', { p_athlete_id: id }),
      supabase.from('meals')
        .select('id, food_name, calories, meal_type, quantity_g, eaten_at, foods(protein_per_100g, carbs_per_100g, fat_per_100g)')
        .eq('user_id', id)
        .order('eaten_at', { ascending: false })
        .limit(300),
      supabase.from('weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_id', id)
        .order('logged_at', { ascending: true })
        .limit(60),
    ])

    if (!profile) { router.push('/dashboard/coach'); return }
    setAthlete(profile)

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
        loadProgression(prsData[0].exercise_id)
      }
    }

    if (mealsErr) {
      setMealsError(`Erreur : ${mealsErr.message}`)
    } else {
      // Calculer les macros depuis le JOIN foods
      const allMeals: Meal[] = (mealsData ?? []).map((m: any) => {
        const f = Array.isArray(m.foods) ? m.foods[0] : m.foods
        const protein_g = f ? Math.round(f.protein_per_100g * m.quantity_g / 100) : 0
        const carbs_g = f ? Math.round(f.carbs_per_100g * m.quantity_g / 100) : 0
        const fat_g = f ? Math.round(f.fat_per_100g * m.quantity_g / 100) : 0
        return { id: m.id, food_name: m.food_name, calories: m.calories, meal_type: m.meal_type, quantity_g: m.quantity_g, eaten_at: m.eaten_at, protein_g, carbs_g, fat_g }
      })
      setMeals(allMeals)

      // Calcul bilan 7 jours
      const goalVal = profile.daily_calories ?? 2000
      const days: DayStat[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const dayMeals = allMeals.filter(m => m.eaten_at.startsWith(dateStr))
        const total = Math.round(dayMeals.reduce((s, m) => s + m.calories, 0))
        const protein = Math.round(dayMeals.reduce((s, m) => s + m.protein_g, 0))
        const carbs = Math.round(dayMeals.reduce((s, m) => s + m.carbs_g, 0))
        const fat = Math.round(dayMeals.reduce((s, m) => s + m.fat_g, 0))
        const lbl = i === 0 ? 'Auj.' : i === 1 ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'short' })
        const color = total === 0 ? '#374151'
          : Math.abs(total - goalVal) <= goalVal * 0.1 ? '#22c55e'
          : total > goalVal * 1.1 ? '#ef4444'
          : '#3b82f6'
        days.push({ date: dateStr, label: lbl.charAt(0).toUpperCase() + lbl.slice(1), total, protein, carbs, fat, color })
      }
      setWeekStats(days)
    }

    if (weightData) setWeightLogs(weightData)
    setLoading(false)
  }

  async function loadProgression(exerciseId: string) {
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
    loadProgression(exerciseId)
  }

  // ── Calculs nutrition ──
  const goal = athlete?.daily_calories ?? 2000
  const loggedDays = weekStats.filter(d => d.total > 0)
  const weeklyAvg = loggedDays.length > 0
    ? Math.round(loggedDays.reduce((s, d) => s + d.total, 0) / loggedDays.length)
    : 0
  const daysOnTarget = weekStats.filter(d => d.total > 0 && Math.abs(d.total - goal) <= goal * 0.1).length
  const weightCurrent = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight_kg : athlete?.weight_kg ?? null
  const weightStart = weightLogs.length > 0 ? weightLogs[0].weight_kg : null
  const weightDiff = weightCurrent !== null && weightStart !== null
    ? Math.round((weightCurrent - weightStart) * 10) / 10
    : null

  // Grouper repas par jour pour l'historique
  const mealsByDay: Record<string, { meals: Meal[]; total: number }> = {}
  meals.forEach(m => {
    const date = m.eaten_at.split('T')[0]
    if (!mealsByDay[date]) mealsByDay[date] = { meals: [], total: 0 }
    mealsByDay[date].meals.push(m)
    mealsByDay[date].total += m.calories
  })
  const mealDays = Object.entries(mealsByDay).sort(([a], [b]) => b.localeCompare(a))

  // Données graphique poids
  const weightChartData = weightLogs.map(w => ({
    date: w.logged_at.split('T')[0],
    poids: w.weight_kg,
  }))

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
              <div className="text-xs text-gray-500">kcal/j obj.</div>
            </div>
          </div>
        </div>

        {/* Tabs principaux */}
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
              <div className="space-y-4">
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
              </div>
            )}
          </div>
        )}

        {/* ── NUTRITION ── */}
        {tab === 'nutrition' && (
          <div className="space-y-5">

            {mealsError && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm text-center">
                ⚠️ {mealsError}
              </div>
            )}

            {/* 4 stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Moy. kcal/j</div>
                <div className="text-2xl font-bold text-blue-300">{weeklyAvg > 0 ? weeklyAvg : '—'}</div>
                <div className="text-xs text-gray-600 mt-1">sur 7 jours</div>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Objectif</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">{goal}</div>
                <div className="text-xs text-gray-600 mt-1">kcal / jour</div>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Dans l'objectif</div>
                <div className="text-2xl font-bold text-green-400">{daysOnTarget} / 7</div>
                <div className="text-xs text-gray-600 mt-1">jours ±10%</div>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-center">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Poids actuel</div>
                <div className={`text-2xl font-bold ${weightDiff === null ? 'text-[var(--text-primary)]' : weightDiff < 0 ? 'text-green-400' : weightDiff > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {weightCurrent !== null ? `${weightCurrent} kg` : '—'}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {weightDiff !== null ? `${weightDiff > 0 ? '+' : ''}${weightDiff} kg` : 'Pas de pesée'}
                </div>
              </div>
            </div>

            {/* Sous-tabs nutrition */}
            <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]">
              {([
                { key: 'semaine', label: '📊 Semaine' },
                { key: 'poids', label: '⚖️ Poids' },
                { key: 'repas', label: '🍽️ Repas' },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setNutriTab(t.key)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                    nutriTab === t.key
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Bilan semaine ── */}
            {nutriTab === 'semaine' && (
              <div className="space-y-4">
                {/* Graphique barres calories / jour */}
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Calories par jour</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={weekStats} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                      <RechartTooltip
                        contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any) => [`${v} kcal`, 'Calories']}
                      />
                      <ReferenceLine y={goal} stroke="#3b82f6" strokeDasharray="4 2" opacity={0.5} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#3b82f6"
                        shape={(props: any) => {
                          const { x, y, width, height, color } = props
                          return <rect x={x} y={y} width={width} height={height} fill={color} rx={4} ry={4} />
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />Objectif</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />En dessous</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Dépassé</span>
                  </div>
                </div>

                {/* Tableau détaillé macros */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="grid grid-cols-5 gap-2 text-xs text-gray-500 uppercase tracking-widest px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-input)]">
                    <span>Jour</span>
                    <span className="text-right">Kcal</span>
                    <span className="text-right text-blue-400">Prot.</span>
                    <span className="text-right text-yellow-500">Gluc.</span>
                    <span className="text-right text-orange-400">Lip.</span>
                  </div>
                  {weekStats.map(d => (
                    <div key={d.date} className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-[var(--border)] last:border-0 text-sm">
                      <span className="text-[var(--text-primary)] font-medium">{d.label}</span>
                      <span className={`text-right font-medium ${
                        d.total === 0 ? 'text-gray-600'
                        : Math.abs(d.total - goal) <= goal * 0.1 ? 'text-green-400'
                        : d.total > goal * 1.1 ? 'text-red-400'
                        : 'text-yellow-500'
                      }`}>{d.total > 0 ? d.total : '—'}</span>
                      <span className="text-right text-gray-400">{d.protein > 0 ? `${d.protein}g` : '—'}</span>
                      <span className="text-right text-gray-400">{d.carbs > 0 ? `${d.carbs}g` : '—'}</span>
                      <span className="text-right text-gray-400">{d.fat > 0 ? `${d.fat}g` : '—'}</span>
                    </div>
                  ))}
                  {loggedDays.length > 0 && (
                    <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-sm font-semibold border-t-2 border-[var(--border)] bg-[var(--bg-input)]">
                      <span className="text-gray-500 text-xs uppercase tracking-widest">Moy.</span>
                      <span className="text-right text-yellow-400">{weeklyAvg}</span>
                      <span className="text-right text-blue-400">{Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length)}g</span>
                      <span className="text-right text-yellow-500">{Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length)}g</span>
                      <span className="text-right text-orange-400">{Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedDays.length)}g</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Courbe de poids ── */}
            {nutriTab === 'poids' && (
              <div className="space-y-4">
                <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Courbe de poids</p>
                    {weightCurrent && (
                      <span className="text-sm font-bold text-[var(--text-primary)]">{weightCurrent} kg</span>
                    )}
                  </div>
                  {weightChartData.length < 2 ? (
                    <div className="h-40 flex items-center justify-center text-sm text-gray-500">
                      Pas encore assez de pesées (min. 2)
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={weightChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="date"
                          tickFormatter={d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false}
                          domain={['auto', 'auto']}
                          tickFormatter={v => `${v}kg`}
                        />
                        <RechartTooltip
                          contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                          formatter={(v: any) => [`${v} kg`, 'Poids']}
                          labelFormatter={d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        />
                        <Line type="monotone" dataKey="poids" stroke="#3b82f6" strokeWidth={2.5}
                          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                          activeDot={{ r: 6, fill: '#3b82f6' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Historique pesées */}
                {weightLogs.length > 0 && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                    <p className="text-xs text-gray-500 uppercase tracking-widest px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-input)]">Historique pesées</p>
                    <div className="max-h-64 overflow-y-auto">
                      {[...weightLogs].reverse().map((w, i) => (
                        <div key={i} className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--border)] last:border-0 text-sm">
                          <span className="text-gray-400">
                            {new Date(w.logged_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span className="font-semibold text-[var(--text-primary)]">{w.weight_kg} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Historique repas ── */}
            {nutriTab === 'repas' && (
              <div className="space-y-3">
                {mealDays.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-3">🥗</div>
                    <p className="text-sm">Aucun repas enregistré</p>
                  </div>
                ) : mealDays.map(([date, { meals: dayMeals, total }]) => {
                  const today = new Date().toISOString().split('T')[0]
                  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
                  const label = date === today ? "Aujourd'hui"
                    : date === yesterday ? 'Hier'
                    : new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
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
                                {m.carbs_g > 0 && <span className="text-yellow-500/70">G {m.carbs_g}g</span>}
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
        )}
      </div>
    </div>
  )
}
