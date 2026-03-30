'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Program {
  id: string
  name: string
  description: string | null
  is_template: boolean
  created_at: string
  exercise_count?: number
}

export default function ProgramsPage() {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [isTemplate, setIsTemplate] = useState(false)

  useEffect(() => { loadPrograms() }, [])

  async function loadPrograms() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data } = await supabase
      .from('programs')
      .select('*, program_exercises(count)')
      .eq('coach_id', session.user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setPrograms(data.map((p: any) => ({
        ...p,
        exercise_count: p.program_exercises?.[0]?.count ?? 0,
      })))
    }
    setLoading(false)
  }

  async function createProgram(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || creating) return
    setCreating(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setCreating(false); return }

    const { data, error } = await supabase.from('programs').insert({
      coach_id: session.user.id,
      name: newName.trim(),
      description: newDesc.trim() || null,
      is_template: isTemplate,
    }).select().single()

    setCreating(false)
    if (!error && data) {
      router.push(`/dashboard/coach/programs/${data.id}`)
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Programmes</h1>
            <p className="text-sm text-gray-400 mt-1">{programs.length} programme{programs.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/dashboard/coach" className="text-sm text-gray-400 hover:text-[var(--text-primary)] transition-colors">
            ← Mes élèves
          </Link>
        </div>

        {/* Créer un programme */}
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <h2 className="font-semibold text-sm text-[var(--text-primary)] mb-4">Nouveau programme</h2>
          <form onSubmit={createProgram} className="space-y-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nom du programme (ex: Full Body 3j/semaine)"
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
            />
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optionnel)"
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="checkbox" checked={isTemplate} onChange={e => setIsTemplate(e.target.checked)}
                  className="rounded" />
                Sauvegarder comme template réutilisable
              </label>
              <button type="submit" disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                Créer →
              </button>
            </div>
          </form>
        </div>

        {/* Liste programmes */}
        {programs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">Aucun programme créé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {programs.map((program) => (
              <Link key={program.id} href={`/dashboard/coach/programs/${program.id}`}
                className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-[var(--text-primary)]">{program.name}</div>
                  {program.is_template && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
                      Template
                    </span>
                  )}
                </div>
                {program.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{program.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>📌 {program.exercise_count} exercice{program.exercise_count !== 1 ? 's' : ''}</span>
                  <span>🗓 {new Date(program.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
