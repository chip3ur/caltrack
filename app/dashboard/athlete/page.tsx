'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { RestTimer } from '@/components/ui/rest-timer'
import { TRAINING_TEMPLATES, type TrainingTemplate } from '@/lib/trainingTemplates'

interface ProgramExercise {
  id: string
  exercise_id: string
  exercise_name: string
  day_number: number
  sets: number
  reps: string
  rest_seconds: number
  notes: string | null
}

interface Assignment {
  id: string
  program_id: string
  program_name: string
  start_date: string
  day_count: number
}

interface SetLog {
  exercise_id: string
  set_number: number
  reps: number | ''
  weight_kg: number | ''
  rpe: number | ''
}

export default function AthletePage() {
  const router = useRouter()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [exercises, setExercises] = useState<ProgramExercise[]>([])
  const [selectedDay, setSelectedDay] = useState(1)
  const [totalDays, setTotalDays] = useState(1)
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [logging, setLogging] = useState(false)
  const [sets, setSets] = useState<SetLog[]>([])
  const [sessionRpe, setSessionRpe] = useState<number | ''>('')
  const [sessionDuration, setSessionDuration] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [restTimer, setRestTimer] = useState<{ seconds: number } | null>(null)
  const [prevPrs, setPrevPrs] = useState<Record<string, number>>({})
  const [sessionStart, setSessionStart] = useState<Date | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TrainingTemplate | null>(null)
  const [tab, setTab] = useState<'programme' | 'libre'>('programme')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role === 'coach') { router.push('/dashboard/coach'); return }

    // Programme actif
    const { data: assign } = await supabase
      .from('program_assignments')
      .select('id, program_id, start_date, programs(name, program_exercises(day_number))')
      .eq('athlete_id', session.user.id)
      .eq('active', true)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .single()

    if (assign) {
      const prog = assign.programs as any
      const days = [...new Set((prog?.program_exercises ?? []).map((e: any) => e.day_number))] as number[]
      const maxDay = days.length ? Math.max(...days) : 1
      setTotalDays(maxDay)
      setAssignment({
        id: assign.id,
        program_id: assign.program_id,
        program_name: prog?.name ?? '',
        start_date: assign.start_date,
        day_count: maxDay,
      })

      // Exercices du programme
      const { data: exos } = await supabase
        .from('program_exercises')
        .select('*, exercises(name)')
        .eq('program_id', assign.program_id)
        .order('day_number')
        .order('order_index')

      if (exos) {
        setExercises(exos.map((e: any) => ({ ...e, exercise_name: e.exercises?.name ?? '' })))
      }
    }
    setLoading(false)
  }

  async function joinCoach() {
    if (!inviteCode.trim()) return
    setJoining(true)
    setJoinError('')
    const { data, error } = await supabase.rpc('accept_coach_invite', { p_code: inviteCode.trim().toUpperCase() })
    if (error || data?.error) {
      setJoinError(data?.error ?? 'Erreur réseau')
    } else {
      setInviteCode('')
      loadData()
    }
    setJoining(false)
  }

  async function startLogging() {
    const dayExos = exercises.filter(e => e.day_number === selectedDay)
    const initialSets: SetLog[] = dayExos.flatMap(exo =>
      Array.from({ length: exo.sets }, (_, i) => ({
        exercise_id: exo.exercise_id,
        set_number: i + 1,
        reps: '',
        weight_kg: '',
        rpe: '',
      }))
    )
    setSets(initialSets)
    setSessionStart(new Date())

    // Charger les PRs précédents
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { data } = await supabase.rpc('get_exercise_prs', { p_athlete_id: session.user.id })
      if (data) {
        const map: Record<string, number> = {}
        data.forEach((pr: any) => { map[pr.exercise_id] = pr.max_weight })
        setPrevPrs(map)
      }
    }
    setLogging(true)
  }

  function updateSet(exoId: string, setNum: number, field: keyof SetLog, value: number | '') {
    setSets(prev => prev.map(s =>
      s.exercise_id === exoId && s.set_number === setNum ? { ...s, [field]: value } : s
    ))
  }

  async function saveSession() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const autoMinutes = sessionStart
      ? Math.round((new Date().getTime() - sessionStart.getTime()) / 60000)
      : null

    // Créer le workout log
    const { data: log } = await supabase.from('workout_logs').insert({
      athlete_id: session.user.id,
      program_id: assignment?.program_id ?? null,
      day_number: selectedDay,
      date: new Date().toISOString().split('T')[0],
      duration_min: sessionDuration || autoMinutes,
      rpe: sessionRpe || null,
      completed: true,
    }).select().single()

    if (log) {
      // Insérer les sets non vides
      const validSets = sets.filter(s => s.reps !== '' || s.weight_kg !== '')
      if (validSets.length > 0) {
        // Détecter les PRs
        const { data: prevPrs } = await supabase.rpc('get_exercise_prs', { p_athlete_id: session.user.id })
        const prMap: Record<string, number> = {}
        if (prevPrs) prevPrs.forEach((pr: any) => { prMap[pr.exercise_id] = pr.max_weight })

        await supabase.from('workout_sets').insert(
          validSets.map(s => ({
            log_id: log.id,
            exercise_id: s.exercise_id,
            set_number: s.set_number,
            reps: s.reps || null,
            weight_kg: s.weight_kg || null,
            rpe: s.rpe || null,
            is_pr: s.weight_kg !== '' && s.weight_kg > (prMap[s.exercise_id] ?? 0),
          }))
        )
      }
    }

    setSaving(false)
    setSaved(true)
    setLogging(false)
    setTimeout(() => setSaved(false), 3000)
  }

  const dayExercises = exercises.filter(e => e.day_number === selectedDay)

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {restTimer && (
        <RestTimer
          seconds={restTimer.seconds}
          onComplete={() => setRestTimer(null)}
          onDismiss={() => setRestTimer(null)}
        />
      )}
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mon programme</h1>
          <Link href="/dashboard/athlete/progress" className="text-xs text-blue-300 hover:underline">📈 Ma progression</Link>
        </div>

        {/* Tabs programme assigné vs séance libre */}
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]">
          <button onClick={() => setTab('programme')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'programme' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
            📋 Programme coach
          </button>
          <button onClick={() => setTab('libre')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'libre' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
            🏋️ Séance libre
          </button>
        </div>

        {saved && (
          <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-300 text-sm font-medium text-center">
            ✓ Séance enregistrée !
          </div>
        )}

        {/* ── TAB SÉANCE LIBRE ── */}
        {tab === 'libre' && (
          <div className="space-y-4">
            {!selectedTemplate ? (
              <>
                <p className="text-sm text-gray-400">Choisis un programme de base pour t&apos;entraîner sans coach :</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {TRAINING_TEMPLATES.map(tpl => (
                    <button key={tpl.id} onClick={() => setSelectedTemplate(tpl)}
                      className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-semibold text-[var(--text-primary)]">{tpl.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          tpl.level === 'débutant' ? 'bg-green-500/10 text-green-300 border-green-500/20'
                          : tpl.level === 'intermédiaire' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                          : 'bg-red-500/10 text-red-300 border-red-500/20'
                        }`}>{tpl.level}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{tpl.description}</p>
                      <p className="text-xs text-gray-600">{tpl.days.length} jours · {tpl.days.reduce((s, d) => s + d.exercises.length, 0)} exercices</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-[var(--text-primary)]">{selectedTemplate.name}</h2>
                  <button onClick={() => setSelectedTemplate(null)} className="text-xs text-gray-500 hover:text-gray-300">← Changer</button>
                </div>
                {selectedTemplate.days.map(day => (
                  <div key={day.day} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-input)]">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Jour {day.day} — {day.label}</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {day.exercises.map((ex, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                          <div>
                            <span className="text-sm font-medium text-[var(--text-primary)]">{ex.name}</span>
                            {ex.notes && <p className="text-xs text-blue-300/60 italic mt-0.5">{ex.notes}</p>}
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <div>{ex.sets} × {ex.reps}</div>
                            {ex.rest_seconds > 0 && <div>⏱ {ex.rest_seconds}s</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-500 text-center">Pour logger tes charges et suivre ta progression, rejoins un coach ou utilise l&apos;onglet Programme</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB PROGRAMME COACH ── */}
        {tab === 'programme' && (
        <>{/* Pas de programme → rejoindre un coach */}
        {!assignment && (
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-3">🔗</div>
              <h2 className="font-semibold text-[var(--text-primary)] mb-1">Rejoindre ton coach</h2>
              <p className="text-sm text-gray-500">Entre le code d&apos;invitation que ton coach t&apos;a envoyé</p>
            </div>
            <div className="flex gap-3">
              <input
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Code d'invitation (ex: AB12CD34)"
                className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm font-mono text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
              />
              <button onClick={joinCoach} disabled={joining || !inviteCode.trim()}
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {joining ? '...' : 'Rejoindre'}
              </button>
            </div>
            {joinError && <p className="text-xs text-red-400 text-center">{joinError}</p>}
          </div>
        )}

        {/* Programme actif */}
        {assignment && (
          <>
            <div className="flex items-center justify-between p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
              <div>
                <div className="font-semibold text-[var(--text-primary)]">{assignment.program_name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Depuis le {new Date(assignment.start_date).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <Link href="/dashboard/athlete/history" className="text-xs text-blue-300 hover:underline">
                Voir l&apos;historique →
              </Link>
            </div>

            {/* Sélecteur jours */}
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                <button key={day} onClick={() => { setSelectedDay(day); setLogging(false) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDay === day
                      ? 'bg-blue-600 text-white'
                      : 'bg-[var(--bg-card)] border border-[var(--border)] text-gray-400 hover:border-blue-500/30'
                  }`}>
                  Jour {day}
                </button>
              ))}
            </div>

            {/* Exercices du jour */}
            {!logging ? (
              <div className="space-y-3">
                {dayExercises.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Aucun exercice pour ce jour</p>
                ) : dayExercises.map(exo => (
                  <div key={exo.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[var(--text-primary)]">{exo.exercise_name}</span>
                      <span className="text-xs text-gray-500">{exo.sets} × {exo.reps}</span>
                    </div>
                    {exo.rest_seconds > 0 && (
                      <span className="text-xs text-gray-500">⏱ {exo.rest_seconds}s de repos</span>
                    )}
                    {exo.notes && <p className="text-xs text-blue-300/70 mt-1 italic">💬 {exo.notes}</p>}
                  </div>
                ))}

                {dayExercises.length > 0 && (
                  <button onClick={startLogging}
                    className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors">
                    🏋️ Démarrer la séance
                  </button>
                )}
              </div>
            ) : (
              /* Logger la séance */
              <div className="space-y-4">
                {/* Header séance */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm font-semibold text-green-300">Séance en cours — Jour {selectedDay}</span>
                  </div>
                  <button onClick={() => setLogging(false)} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Annuler</button>
                </div>

                {dayExercises.map(exo => {
                  const exoSets = sets.filter(s => s.exercise_id === exo.exercise_id)
                  const pr = prevPrs[exo.exercise_id]
                  return (
                    <div key={exo.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                        <span className="font-semibold text-[var(--text-primary)]">{exo.exercise_name}</span>
                        <div className="flex items-center gap-3">
                          {pr && (
                            <span className="text-xs text-yellow-400/80">🏆 PR : {pr}kg</span>
                          )}
                          {exo.rest_seconds > 0 && (
                            <button onClick={() => setRestTimer({ seconds: exo.rest_seconds })}
                              className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-colors">
                              ⏱ {exo.rest_seconds}s
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-4 gap-2 mb-2 text-xs text-gray-500 px-1">
                          <span>Série</span><span>Reps</span><span>Kg</span><span>RPE</span>
                        </div>
                        {exoSets.map(s => {
                          const isBeatPR = s.weight_kg !== '' && pr && (s.weight_kg as number) > pr
                          return (
                            <div key={s.set_number} className={`grid grid-cols-4 gap-2 mb-2 rounded-lg transition-all ${isBeatPR ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30' : ''}`}>
                              <div className="flex items-center justify-center text-xs text-gray-500 bg-[var(--bg-input)] rounded py-2">
                                {isBeatPR ? '🏆' : s.set_number}
                              </div>
                              <input type="number" min={0} value={s.reps}
                                onChange={e => updateSet(exo.exercise_id, s.set_number, 'reps', e.target.value ? parseInt(e.target.value) : '')}
                                placeholder="—"
                                className="px-2 py-2 rounded bg-[var(--bg-input)] border border-[var(--border)] text-sm text-center text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50" />
                              <input type="number" min={0} step={0.5} value={s.weight_kg}
                                onChange={e => {
                                  updateSet(exo.exercise_id, s.set_number, 'weight_kg', e.target.value ? parseFloat(e.target.value) : '')
                                }}
                                placeholder="—"
                                className={`px-2 py-2 rounded border text-sm text-center focus:outline-none transition-colors ${
                                  isBeatPR
                                    ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300 font-bold'
                                    : 'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-primary)] focus:border-blue-500/50'
                                }`} />
                              <input type="number" min={1} max={10} value={s.rpe}
                                onChange={e => updateSet(exo.exercise_id, s.set_number, 'rpe', e.target.value ? parseInt(e.target.value) : '')}
                                placeholder="—"
                                className="px-2 py-2 rounded bg-[var(--bg-input)] border border-[var(--border)] text-sm text-center text-[var(--text-primary)] focus:outline-none focus:border-blue-500/50" />
                            </div>
                          )
                        })}
                        {exo.notes && (
                          <p className="text-xs text-blue-300/60 italic mt-2">💬 {exo.notes}</p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Infos globales séance */}
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Résumé de séance</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Durée (min)</label>
                      <input type="number" min={0} value={sessionDuration}
                        onChange={e => setSessionDuration(e.target.value ? parseInt(e.target.value) : '')}
                        placeholder={sessionStart ? `~${Math.round((Date.now() - sessionStart.getTime()) / 60000)} min` : 'Ex: 60'}
                        className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Difficulté (RPE 1-10)</label>
                      <input type="number" min={1} max={10} value={sessionRpe}
                        onChange={e => setSessionRpe(e.target.value ? parseInt(e.target.value) : '')}
                        placeholder="Ex: 7"
                        className="w-full px-3 py-2 rounded bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none" />
                    </div>
                  </div>
                </div>

                <button onClick={saveSession} disabled={saving}
                  className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-sm transition-colors">
                  {saving ? 'Enregistrement...' : '✓ Terminer la séance'}
                </button>
              </div>
            )}
          </>
        </>}
      </div>
    </div>
  )
}
