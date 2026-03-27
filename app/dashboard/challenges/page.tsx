'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Challenge = {
  id: string
  title: string
  goal_type: string
  target_days: number
  start_date: string
  end_date: string
  creator_id: string
  created_at: string
}

type LeaderboardEntry = {
  display_name: string
  days_logged: number
}

type MyChallenge = Challenge & {
  my_days: number
  total_days: number
  participants: number
}

const goalTypeLabel: Record<string, string> = {
  streak: 'Série de jours consécutifs',
  calories: 'Objectif calorique quotidien',
}

export default function ChallengesPage() {
  const [myChallenges, setMyChallenges] = useState<MyChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [openChallenge, setOpenChallenge] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<Record<string, LeaderboardEntry[]>>({})
  const [loadingBoard, setLoadingBoard] = useState<string | null>(null)

  // Create challenge
  const [creating, setCreating] = useState(false)
  const [cTitle, setCTitle] = useState('')
  const [cGoalType, setCGoalType] = useState('streak')
  const [cDays, setCDays] = useState(7)
  const [cDisplayName, setCDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createSuccess, setCreateSuccess] = useState('')

  // Join challenge
  const [joinId, setJoinId] = useState('')
  const [joinName, setJoinName] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')

  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Get challenges I participate in
    const { data: participations } = await supabase
      .from('challenge_participants')
      .select('challenge_id, display_name')
      .eq('user_id', session.user.id)

    if (!participations || participations.length === 0) {
      setMyChallenges([])
      setLoading(false)
      return
    }

    const challengeIds = participations.map(p => p.challenge_id)

    const { data: challengesData } = await supabase
      .from('challenges')
      .select('*')
      .in('id', challengeIds)
      .order('created_at', { ascending: false })

    if (!challengesData) { setLoading(false); return }

    // For each challenge, get my days and participant count
    const results: MyChallenge[] = await Promise.all(challengesData.map(async c => {
      const start = new Date(c.start_date)
      const end = new Date(c.end_date)
      const total_days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1

      const { data: myMeals } = await supabase
        .from('meals')
        .select('eaten_at')
        .eq('user_id', session.user.id)
        .gte('eaten_at', `${c.start_date}T00:00:00`)
        .lte('eaten_at', `${c.end_date}T23:59:59`)

      const uniqueDays = new Set((myMeals ?? []).map(m => m.eaten_at.split('T')[0]))

      const { count } = await supabase
        .from('challenge_participants')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', c.id)

      return { ...c, my_days: uniqueDays.size, total_days, participants: count ?? 0 }
    }))

    setMyChallenges(results)
    setLoading(false)
  }

  async function loadLeaderboard(challengeId: string) {
    if (leaderboard[challengeId]) {
      setOpenChallenge(openChallenge === challengeId ? null : challengeId)
      return
    }
    setLoadingBoard(challengeId)
    setOpenChallenge(challengeId)
    const { data, error } = await supabase.rpc('get_challenge_progress', { p_challenge_id: challengeId })
    if (!error && data) {
      setLeaderboard(prev => ({ ...prev, [challengeId]: data }))
    }
    setLoadingBoard(null)
  }

  async function createChallenge() {
    if (!cTitle || !cDisplayName) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date(Date.now() + (cDays - 1) * 86400000).toISOString().split('T')[0]

    const { data: challenge } = await supabase
      .from('challenges')
      .insert({ creator_id: session.user.id, title: cTitle, goal_type: cGoalType, target_days: cDays, start_date: startDate, end_date: endDate })
      .select()
      .single()

    if (challenge) {
      await supabase.from('challenge_participants').insert({
        challenge_id: challenge.id,
        user_id: session.user.id,
        display_name: cDisplayName,
      })
      setCreateSuccess(`Défi créé ! Code : ${challenge.id.split('-')[0].toUpperCase()}`)
    }

    setCreating(false)
    setCTitle('')
    setCDisplayName('')
    setSaving(false)
    await load()
    setTimeout(() => setCreateSuccess(''), 6000)
  }

  async function joinChallenge() {
    if (!joinId.trim() || !joinName.trim()) return
    setJoining(true)
    setJoinError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Find challenge by partial ID or full ID
    const { data: challenge } = await supabase
      .from('challenges')
      .select('*')
      .ilike('id', `${joinId.trim().toLowerCase()}%`)
      .single()

    if (!challenge) {
      setJoinError('Défi introuvable. Vérifiez le code.')
      setJoining(false)
      return
    }

    const { error } = await supabase.from('challenge_participants').insert({
      challenge_id: challenge.id,
      user_id: session.user.id,
      display_name: joinName.trim(),
    })

    if (error) {
      setJoinError(error.code === '23505' ? 'Tu participes déjà à ce défi.' : 'Erreur lors de la participation.')
    } else {
      setJoinSuccess(`Tu rejoins "${challenge.title}" !`)
      setJoinId('')
      setJoinName('')
      await load()
      setTimeout(() => setJoinSuccess(''), 4000)
    }
    setJoining(false)
  }

  async function copyCode(challengeId: string) {
    const shortCode = challengeId.split('-')[0].toUpperCase()
    await navigator.clipboard.writeText(shortCode)
    setCopied(challengeId)
    setTimeout(() => setCopied(null), 2000)
  }

  const inputClass = "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-blue-500/50"

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Social</p>
          <h1 className="text-2xl font-serif text-[var(--text-primary)] mt-1">Défis</h1>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
            + Créer un défi
          </button>
        )}
      </div>

      {createSuccess && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-400">
          ✓ {createSuccess}
        </div>
      )}

      {/* CRÉER UN DÉFI */}
      {creating && (
        <div className="bg-[var(--bg-card)] border border-yellow-600/20 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Nouveau défi</p>
            <button onClick={() => setCreating(false)} className="text-xs text-gray-500 hover:text-gray-300">Annuler</button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Titre du défi</label>
              <input placeholder="Ex : 7 jours de régularité" value={cTitle} onChange={e => setCTitle(e.target.value)} className={inputClass}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Type d'objectif</label>
              <select value={cGoalType} onChange={e => setCGoalType(e.target.value)} className={inputClass}>
                <option value="streak">Série de jours (enregistrer chaque jour)</option>
                <option value="calories">Objectif calorique (rester dans l'objectif)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Durée (jours)</label>
              <input type="number" min={1} max={30} value={cDays} onChange={e => setCDays(Number(e.target.value))} className={inputClass}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Ton nom dans ce défi</label>
              <input placeholder="Ton pseudo" value={cDisplayName} onChange={e => setCDisplayName(e.target.value)} className={inputClass}/>
            </div>
            <button onClick={createChallenge} disabled={!cTitle || !cDisplayName || saving}
              className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium">
              {saving ? 'Création...' : 'Créer le défi'}
            </button>
          </div>
        </div>
      )}

      {/* REJOINDRE UN DÉFI */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Rejoindre un défi</p>
        <div className="flex gap-2 mb-2">
          <input placeholder="Code du défi (ex: A1B2C3)" value={joinId}
            onChange={e => { setJoinId(e.target.value); setJoinError('') }}
            className="flex-1 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-blue-500/50"/>
          <input placeholder="Ton pseudo" value={joinName}
            onChange={e => setJoinName(e.target.value)}
            className="flex-1 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-blue-500/50"/>
          <button onClick={joinChallenge} disabled={!joinId || !joinName || joining}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 rounded-xl text-sm font-medium">
            {joining ? '...' : 'Rejoindre'}
          </button>
        </div>
        {joinError && <p className="text-xs text-red-400">{joinError}</p>}
        {joinSuccess && <p className="text-xs text-green-400">{joinSuccess}</p>}
      </div>

      {/* MES DÉFIS */}
      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : myChallenges.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500 mb-1">Aucun défi en cours.</p>
          <p className="text-xs text-gray-600">Crée un défi et partage le code à tes amis !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myChallenges.map(c => {
            const pct = Math.min(c.my_days / c.total_days * 100, 100)
            const isOpen = openChallenge === c.id
            const board = leaderboard[c.id]
            const today = new Date().toISOString().split('T')[0]
            const isActive = c.end_date >= today
            const shortCode = c.id.split('-')[0].toUpperCase()

            return (
              <div key={c.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{c.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{goalTypeLabel[c.goal_type] ?? c.goal_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span className="text-xs text-green-300 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">En cours</span>
                      ) : (
                        <span className="text-xs text-gray-500 bg-[var(--bg-input)] border border-[var(--border-input)] px-2 py-0.5 rounded-full">Terminé</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>{c.start_date} → {c.end_date}</span>
                    <span>{c.participants} participant{c.participants > 1 ? 's' : ''}</span>
                  </div>

                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-gray-500">Ma progression</span>
                    <span className="text-blue-300">{c.my_days} / {c.total_days} jours</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }}/>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => copyCode(c.id)}
                      className="flex-1 text-xs border border-[var(--border-input)] text-gray-400 hover:text-[var(--text-primary)] py-2 rounded-lg transition-colors">
                      {copied === c.id ? '✓ Copié !' : `Code : ${shortCode}`}
                    </button>
                    <button onClick={() => loadLeaderboard(c.id)}
                      className="flex-1 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] py-2 rounded-lg hover:border-blue-500/40 transition-colors">
                      {isOpen ? 'Masquer' : 'Classement'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Classement</p>
                    {loadingBoard === c.id ? (
                      <p className="text-xs text-gray-500">Chargement...</p>
                    ) : board && board.length > 0 ? (
                      <div className="space-y-2">
                        {board.map((entry, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-none">
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-serif w-6 text-center ${
                                i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-500'
                              }`}>{i + 1}</span>
                              <span className="text-sm text-[var(--text-primary)]">{entry.display_name}</span>
                            </div>
                            <span className="text-sm text-blue-300">{Number(entry.days_logged)} j</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Aucune donnée disponible.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
