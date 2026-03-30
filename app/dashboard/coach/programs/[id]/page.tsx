'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Exercise {
  id: string
  name: string
  category: string
  muscles: string[]
}

interface ProgramExercise {
  id: string
  exercise_id: string
  exercise_name: string
  day_number: number
  sets: number
  reps: string
  rest_seconds: number
  notes: string | null
  order_index: number
}

interface Program {
  id: string
  name: string
  description: string | null
  is_template: boolean
}

interface Athlete {
  id: string
  full_name: string | null
  email: string
}

export default function ProgramDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [program, setProgram] = useState<Program | null>(null)
  const [exercises, setExercises] = useState<ProgramExercise[]>([])
  const [library, setLibrary] = useState<Exercise[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(1)
  const [totalDays, setTotalDays] = useState(3)
  const [adding, setAdding] = useState(false)
  const [searchExercise, setSearchExercise] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [selectedAthlete, setSelectedAthlete] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const [{ data: prog }, { data: exos }, { data: lib }, { data: ath }] = await Promise.all([
      supabase.from('programs').select('*').eq('id', id).single(),
      supabase.from('program_exercises').select('*, exercises(name)').eq('program_id', id).order('day_number').order('order_index'),
      supabase.from('exercises').select('id, name, category, muscles').eq('is_public', true).order('name'),
      supabase.rpc('get_coach_athletes'),
    ])

    if (prog) setProgram(prog)
    if (exos) {
      const mapped = exos.map((e: any) => ({
        ...e,
        exercise_name: e.exercises?.name ?? '',
      }))
      setExercises(mapped)
      const maxDay = mapped.reduce((m: number, e: any) => Math.max(m, e.day_number), 1)
      setTotalDays(Math.max(maxDay, 3))
    }
    if (lib) setLibrary(lib)
    if (ath) setAthletes(ath)
    setLoading(false)
  }

  async function addExercise(exerciseId: string) {
    const dayExos = exercises.filter(e => e.day_number === selectedDay)
    const { error } = await supabase.from('program_exercises').insert({
      program_id: id,
      exercise_id: exerciseId,
      day_number: selectedDay,
      order_index: dayExos.length,
    })
    if (!error) { setAdding(false); setSearchExercise(''); loadData() }
  }

  async function removeExercise(exoId: string) {
    await supabase.from('program_exercises').delete().eq('id', exoId)
    loadData()
  }

  async function updateExercise(exoId: string, field: string, value: string | number) {
    await supabase.from('program_exercises').update({ [field]: value }).eq('id', exoId)
    setExercises(prev => prev.map(e => e.id === exoId ? { ...e, [field]: value } : e))
  }

  async function assignToAthlete() {
    if (!selectedAthlete) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('program_assignments').upsert({
      program_id: id,
      athlete_id: selectedAthlete,
      coach_id: session.user.id,
      active: true,
    })
    setAssigning(false)
    setSelectedAthlete('')
    alert('Programme assigné avec succès !')
  }

  const dayExercises = exercises.filter(e => e.day_number === selectedDay)
  const filteredLibrary = library.filter(e =>
    e.name.toLowerCase().includes(searchExercise.toLowerCase())
  )

  if (loading || !program) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/dashboard/coach/programs" className="text-xs text-gray-500 hover:text-gray-300 mb-2 block">← Programmes</Link>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{program.name}</h1>
            {program.description && <p className="text-sm text-gray-400 mt-1">{program.description}</p>}
          </div>
          <button onClick={() => setAssigning(!assigning)}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors">
            Assigner à un élève
          </button>
        </div>

        {/* Assigner */}
        {assigning && (
          <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 flex items-center gap-3">
            <select value={selectedAthlete} onChange={e => setSelectedAthlete(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none">
              <option value="">Choisir un élève...</option>
              {athletes.map(a => (
                <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
              ))}
            </select>
            <button onClick={assignToAthlete} disabled={!selectedAthlete}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm transition-colors">
              Confirmer
            </button>
            <button onClick={() => setAssigning(false)} className="text-gray-500 hover:text-gray-300 text-sm">Annuler</button>
          </div>
        )}

        {/* Sélecteur jours */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
            <button key={day} onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedDay === day
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--bg-card)] border border-[var(--border)] text-gray-400 hover:border-blue-500/30'
              }`}>
              Jour {day}
            </button>
          ))}
          <button onClick={() => setTotalDays(d => d + 1)}
            className="px-3 py-2 rounded-lg border border-dashed border-[var(--border)] text-gray-500 hover:border-blue-500/30 text-sm transition-colors">
            + Jour
          </button>
        </div>

        {/* Exercices du jour */}
        <div className="space-y-3">
          {dayExercises.length === 0 && !adding && (
            <div className="text-center py-10 text-gray-500 border border-dashed border-[var(--border)] rounded-xl">
              <p className="text-sm">Aucun exercice pour ce jour</p>
            </div>
          )}

          {dayExercises.map((exo) => (
            <div key={exo.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-[var(--text-primary)]">{exo.exercise_name}</span>
                <button onClick={() => removeExercise(exo.id)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Retirer</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Séries</label>
                  <input type="number" value={exo.sets} min={1}
                    onChange={e => updateExercise(exo.id, 'sets', parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] text-center focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Reps</label>
                  <input type="text" value={exo.reps} placeholder="8-12"
                    onChange={e => updateExercise(exo.id, 'reps', e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] text-center focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Repos (sec)</label>
                  <input type="number" value={exo.rest_seconds} min={0} step={15}
                    onChange={e => updateExercise(exo.id, 'rest_seconds', parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] text-center focus:outline-none" />
                </div>
              </div>
              <input type="text" value={exo.notes ?? ''} placeholder="Notes pour l'élève (optionnel)"
                onChange={e => updateExercise(exo.id, 'notes', e.target.value)}
                className="w-full mt-2 px-2 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border)] text-xs text-gray-400 placeholder-gray-600 focus:outline-none" />
            </div>
          ))}

          {/* Ajouter exercice */}
          {adding ? (
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-3">
              <input autoFocus value={searchExercise} onChange={e => setSearchExercise(e.target.value)}
                placeholder="Rechercher un exercice..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none" />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredLibrary.map(ex => (
                  <button key={ex.id} onClick={() => addExercise(ex.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-500/10 transition-colors flex items-center justify-between">
                    <span className="text-sm text-[var(--text-primary)]">{ex.name}</span>
                    <span className="text-xs text-gray-500">{ex.muscles?.slice(0, 2).join(', ')}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => { setAdding(false); setSearchExercise('') }}
                className="text-xs text-gray-500 hover:text-gray-300">Annuler</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full py-3 rounded-xl border border-dashed border-[var(--border)] text-sm text-gray-500 hover:border-blue-500/30 hover:text-blue-300 transition-colors">
              + Ajouter un exercice
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
