'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface WorkoutSet {
  id: string
  exercise_name: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  is_pr: boolean
}

interface WorkoutLog {
  id: string
  date: string
  duration_min: number | null
  rpe: number | null
  completed: boolean
  program_name?: string
  sets: WorkoutSet[]
}

export default function AthleteHistory() {
  const router = useRouter()
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingSet, setEditingSet] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ reps: string; weight_kg: string; rpe: string }>({ reps: '', weight_kg: '', rpe: '' })
  const [savingSet, setSavingSet] = useState(false)
  const [deletingLog, setDeletingLog] = useState<string | null>(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data } = await supabase
      .from('workout_logs')
      .select(`
        id, date, duration_min, rpe, completed,
        programs(name),
        workout_sets(id, set_number, reps, weight_kg, rpe, is_pr, exercises(name))
      `)
      .eq('athlete_id', session.user.id)
      .order('date', { ascending: false })
      .limit(50)

    if (data) {
      setLogs(data.map((l: any) => ({
        ...l,
        program_name: l.programs?.name,
        sets: (l.workout_sets ?? []).map((s: any) => ({
          id: s.id,
          exercise_name: s.exercises?.name ?? '',
          set_number: s.set_number,
          reps: s.reps,
          weight_kg: s.weight_kg,
          rpe: s.rpe,
          is_pr: s.is_pr,
        })).sort((a: any, b: any) => a.set_number - b.set_number),
      })))
    }
    setLoading(false)
  }

  function startEditSet(s: WorkoutSet) {
    setEditingSet(s.id)
    setEditValues({
      reps: s.reps !== null ? String(s.reps) : '',
      weight_kg: s.weight_kg !== null ? String(s.weight_kg) : '',
      rpe: s.rpe !== null ? String(s.rpe) : '',
    })
  }

  async function saveSet(setId: string) {
    setSavingSet(true)
    await supabase.from('workout_sets').update({
      reps: editValues.reps ? parseInt(editValues.reps) : null,
      weight_kg: editValues.weight_kg ? parseFloat(editValues.weight_kg) : null,
      rpe: editValues.rpe ? parseInt(editValues.rpe) : null,
    }).eq('id', setId)

    setEditingSet(null)
    setSavingSet(false)
    loadHistory()
  }

  async function deleteLog(logId: string) {
    setDeletingLog(logId)
    await supabase.from('workout_logs').delete().eq('id', logId)
    setLogs(prev => prev.filter(l => l.id !== logId))
    setDeletingLog(null)
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
              {/* Header cliquable */}
              <button className="w-full text-left p-4" onClick={() => setExpanded(isExpanded ? null : log.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      {new Date(log.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    {log.program_name && <div className="text-xs text-gray-500 mt-0.5">{log.program_name}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {prs.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">
                        🏆 {prs.length} PR
                      </span>
                    )}
                    {log.duration_min && <span className="text-xs text-gray-500">⏱ {log.duration_min}min</span>}
                    {log.rpe && <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-input)] text-[var(--text-primary)]">RPE {log.rpe}</span>}
                    <span className="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {!isExpanded && exerciseNames.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2 truncate">{exerciseNames.join(' · ')}</p>
                )}
              </button>

              {/* Détail expandé avec édition */}
              {isExpanded && (
                <div className="border-t border-[var(--border)] px-4 pb-4 pt-3 space-y-4">
                  {exerciseNames.map(name => {
                    const exoSets = log.sets.filter(s => s.exercise_name === name)
                    return (
                      <div key={name}>
                        <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">{name}</div>
                        <div className="space-y-1.5">
                          {exoSets.map(s => (
                            <div key={s.id}>
                              {editingSet === s.id ? (
                                /* Mode édition */
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                  <span className="text-xs text-gray-500 w-14 shrink-0">Série {s.set_number}</span>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" value={editValues.reps} min={0}
                                      onChange={e => setEditValues(v => ({ ...v, reps: e.target.value }))}
                                      placeholder="Reps"
                                      className="w-14 px-1.5 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)] text-xs text-center text-[var(--text-primary)] focus:outline-none"
                                    />
                                    <span className="text-xs text-gray-600">reps</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" value={editValues.weight_kg} min={0} step={0.5}
                                      onChange={e => setEditValues(v => ({ ...v, weight_kg: e.target.value }))}
                                      placeholder="Kg"
                                      className="w-16 px-1.5 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)] text-xs text-center text-[var(--text-primary)] focus:outline-none"
                                    />
                                    <span className="text-xs text-gray-600">kg</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" value={editValues.rpe} min={1} max={10}
                                      onChange={e => setEditValues(v => ({ ...v, rpe: e.target.value }))}
                                      placeholder="RPE"
                                      className="w-12 px-1.5 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)] text-xs text-center text-[var(--text-primary)] focus:outline-none"
                                    />
                                    <span className="text-xs text-gray-600">rpe</span>
                                  </div>
                                  <button onClick={() => saveSet(s.id)} disabled={savingSet}
                                    className="px-2 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50">
                                    {savingSet ? '...' : '✓'}
                                  </button>
                                  <button onClick={() => setEditingSet(null)}
                                    className="text-xs text-gray-500 hover:text-gray-300">✕</button>
                                </div>
                              ) : (
                                /* Mode lecture */
                                <div className="flex items-center gap-3 text-xs text-gray-400 group py-1">
                                  <span className="w-14 text-gray-600 shrink-0">Série {s.set_number}</span>
                                  <span>{s.reps ? `${s.reps} reps` : '—'}</span>
                                  <span className={`font-medium ${s.is_pr ? 'text-yellow-400' : 'text-[var(--text-primary)]'}`}>
                                    {s.weight_kg ? `${s.weight_kg}kg` : '—'}
                                  </span>
                                  {s.rpe && <span className="text-gray-500">RPE {s.rpe}</span>}
                                  {s.is_pr && <span className="text-yellow-400">🏆</span>}
                                  <button
                                    onClick={() => startEditSet(s)}
                                    className="ml-auto text-blue-400/60 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                                  >
                                    Modifier
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {/* Supprimer la séance */}
                  <div className="pt-2 border-t border-[var(--border)] flex justify-end">
                    <button
                      onClick={() => deleteLog(log.id)}
                      disabled={deletingLog === log.id}
                      className="text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deletingLog === log.id ? 'Suppression...' : '🗑 Supprimer cette séance'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
