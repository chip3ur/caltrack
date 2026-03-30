'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface WorkoutLog {
  id: string
  date: string
  duration_min: number | null
  rpe: number | null
  completed: boolean
  program_name?: string
  sets: {
    exercise_name: string
    set_number: number
    reps: number | null
    weight_kg: number | null
    is_pr: boolean
  }[]
}

export default function AthleteHistory() {
  const router = useRouter()
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data } = await supabase
      .from('workout_logs')
      .select(`
        id, date, duration_min, rpe, completed,
        programs(name),
        workout_sets(set_number, reps, weight_kg, is_pr, exercises(name))
      `)
      .eq('athlete_id', session.user.id)
      .order('date', { ascending: false })
      .limit(30)

    if (data) {
      setLogs(data.map((l: any) => ({
        ...l,
        program_name: l.programs?.name,
        sets: (l.workout_sets ?? []).map((s: any) => ({
          ...s,
          exercise_name: s.exercises?.name ?? '',
        })).sort((a: any, b: any) => a.set_number - b.set_number),
      })))
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Historique des séances</h1>
          <Link href="/dashboard/athlete" className="text-sm text-gray-400 hover:text-[var(--text-primary)]">← Programme</Link>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-sm">Aucune séance enregistrée</p>
          </div>
        ) : logs.map(log => {
          const prs = log.sets.filter(s => s.is_pr)
          const isExpanded = expanded === log.id
          const exerciseNames = [...new Set(log.sets.map(s => s.exercise_name))].filter(Boolean)

          return (
            <div key={log.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
              <button className="w-full text-left p-4" onClick={() => setExpanded(isExpanded ? null : log.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      {new Date(log.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    {log.program_name && <div className="text-xs text-gray-500 mt-0.5">{log.program_name}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    {prs.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">
                        🏆 {prs.length} PR
                      </span>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {log.duration_min && <span>⏱ {log.duration_min}min</span>}
                      {log.rpe && <span className="px-2 py-0.5 rounded bg-[var(--bg-input)]">RPE {log.rpe}</span>}
                    </div>
                    <span className="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {!isExpanded && exerciseNames.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2 truncate">{exerciseNames.join(' · ')}</p>
                )}
              </button>

              {isExpanded && log.sets.length > 0 && (
                <div className="border-t border-[var(--border)] px-4 pb-4 pt-3 space-y-3">
                  {exerciseNames.map(name => {
                    const exoSets = log.sets.filter(s => s.exercise_name === name)
                    return (
                      <div key={name}>
                        <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">{name}</div>
                        <div className="space-y-1">
                          {exoSets.map(s => (
                            <div key={s.set_number} className="flex items-center gap-3 text-xs text-gray-400">
                              <span className="w-12 text-gray-600">Série {s.set_number}</span>
                              {s.reps && <span>{s.reps} reps</span>}
                              {s.weight_kg && <span className="text-[var(--text-primary)] font-medium">{s.weight_kg}kg</span>}
                              {s.is_pr && <span className="text-yellow-400 font-bold">🏆 PR</span>}
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
    </div>
  )
}
