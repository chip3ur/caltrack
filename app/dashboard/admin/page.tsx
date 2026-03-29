'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface UserRow {
  id: string
  full_name: string | null
  email: string
  daily_calories: number | null
  is_admin: boolean
  created_at: string
  meal_count?: number
  last_meal?: string | null
}

interface Challenge {
  id: string
  title: string
  goal_type: string
  start_date: string
  end_date: string
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [tab, setTab] = useState<'users' | 'challenges'>('users')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (!profile?.is_admin) { router.push('/dashboard'); return }

      await Promise.all([loadUsers(), loadChallenges()])
      setLoading(false)
    }
    init()
  }, [])

  async function loadUsers() {
    const { data: profiles, error } = await supabase.rpc('get_all_profiles')
    if (error || !profiles) return

    const { data: stats } = await supabase.rpc('get_user_stats')
    const statsMap: Record<string, { meal_count: number; last_meal: string | null }> = {}
    if (stats) {
      for (const s of stats) statsMap[s.user_id] = { meal_count: Number(s.meal_count), last_meal: s.last_meal }
    }

    setUsers(profiles.map((p: UserRow) => ({
      ...p,
      meal_count: statsMap[p.id]?.meal_count ?? 0,
      last_meal: statsMap[p.id]?.last_meal ?? null,
    })))
  }

  async function loadChallenges() {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setChallenges(data)
  }

  async function impersonate(userId: string) {
    setActionLoading('imp-' + userId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ targetUserId: userId }),
      })
      const json = await res.json()
      if (json.url) {
        window.open(json.url, '_blank')
      } else {
        alert('Erreur : ' + (json.error ?? 'inconnue'))
      }
    } catch (e) {
      alert('Erreur réseau')
    }
    setActionLoading(null)
  }

  async function toggleAdmin(userId: string, current: boolean) {
    setActionLoading(userId)
    await supabase.rpc('admin_toggle_admin', { p_user_id: userId, p_value: !current })
    await loadUsers()
    setActionLoading(null)
  }

  async function deleteChallenge(id: string) {
    if (!confirm('Supprimer ce défi ?')) return
    setActionLoading(id)
    await supabase.rpc('admin_delete_challenge', { p_challenge_id: id })
    await loadChallenges()
    setActionLoading(null)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xl">🛡️</span>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Administration</h1>
        </div>
        <p className="text-sm text-gray-500 ml-9">Gestion des utilisateurs et des défis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Utilisateurs', value: users.length, icon: '👤' },
          { label: 'Admins', value: users.filter(u => u.is_admin).length, icon: '🛡️' },
          { label: 'Défis actifs', value: challenges.filter(c => new Date(c.end_date) >= new Date()).length, icon: '⚡' },
        ].map(stat => (
          <div key={stat.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-lg mb-1">{stat.icon}</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--bg-input)] rounded-lg p-1 w-fit">
        {(['users', 'challenges'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-gray-500 hover:text-[var(--text-primary)]'
            }`}>
            {t === 'users' ? `👤 Utilisateurs (${users.length})` : `⚡ Défis (${challenges.length})`}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-input)]">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide hidden sm:table-cell">Repas</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide hidden md:table-cell">Inscrit le</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Rôle</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} className={`border-b border-[var(--border)] last:border-0 ${i % 2 === 0 ? '' : 'bg-[var(--bg-input)]/30'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)] truncate max-w-[180px]">
                      {user.full_name || '—'}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[180px]">{user.email}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-[var(--text-primary)]">{user.meal_count ?? 0}</span>
                    {user.last_meal && (
                      <div className="text-xs text-gray-500">{formatDate(user.last_meal)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell text-xs">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAdmin(user.id, user.is_admin)}
                      disabled={actionLoading === user.id}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                        user.is_admin
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30'
                          : 'bg-[var(--bg-input)] text-gray-400 border border-[var(--border)] hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/30'
                      } ${actionLoading === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {actionLoading === user.id ? '...' : user.is_admin ? '🛡️ Admin' : 'Utilisateur'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => impersonate(user.id)}
                      disabled={actionLoading === 'imp-' + user.id}
                      title="Se connecter en tant que cet utilisateur"
                      className="text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50 px-2 py-1 rounded hover:bg-yellow-500/10 transition-colors"
                    >
                      {actionLoading === 'imp-' + user.id ? '...' : '→ Connexion'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Challenges tab */}
      {tab === 'challenges' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          {challenges.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-12">Aucun défi</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-input)]">
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Titre</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide hidden sm:table-cell">Période</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((c, i) => {
                  const active = new Date(c.end_date) >= new Date()
                  return (
                    <tr key={c.id} className={`border-b border-[var(--border)] last:border-0 ${i % 2 === 0 ? '' : 'bg-[var(--bg-input)]/30'}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{c.title}</div>
                        <div className="text-xs text-gray-500">{c.goal_type}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell">
                        {formatDate(c.start_date)} → {formatDate(c.end_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {active ? 'Actif' : 'Terminé'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteChallenge(c.id)}
                          disabled={actionLoading === c.id}
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                        >
                          {actionLoading === c.id ? '...' : 'Supprimer'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
