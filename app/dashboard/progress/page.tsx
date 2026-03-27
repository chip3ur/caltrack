'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler
} from 'chart.js'
import { useTheme } from '../ThemeContext'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

type WeightLog = {
  id: string
  weight_kg: number
  logged_at: string
}

export default function ProgressPage() {
  const { theme } = useTheme()
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [profile, setProfile] = useState<{ weight_kg: number; goal: string; daily_calories: number } | null>(null)
  const [newWeight, setNewWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [weeklyStats, setWeeklyStats] = useState({ avg: 0, best: 0, days: 0 })
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const [{ data: profileData }, { data: logsData }, { data: mealsData }] = await Promise.all([
      supabase.from('profiles').select('weight_kg, goal, daily_calories').eq('id', session.user.id).single(),
      supabase.from('weight_logs').select('id, weight_kg, logged_at').eq('user_id', session.user.id).order('logged_at', { ascending: true }).limit(30),
      supabase.from('meals').select('calories, eaten_at').eq('user_id', session.user.id)
        .gte('eaten_at', new Date(Date.now() - 7 * 86400000).toISOString())
    ])

    if (profileData) setProfile(profileData)
    if (logsData) setLogs(logsData)

    if (mealsData && profileData) {
      const byDay: Record<string, number> = {}
      mealsData.forEach(m => {
        const d = m.eaten_at.split('T')[0]
        byDay[d] = (byDay[d] ?? 0) + m.calories
      })
      const vals = Object.values(byDay)
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
      const best = vals.length ? Math.round(Math.min(...vals)) : 0
      const days = vals.filter(v => v <= profileData.daily_calories).length
      setWeeklyStats({ avg, best, days })
    }
  }

  async function saveWeight() {
    if (!newWeight) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase.from('weight_logs').insert({
      user_id: session.user.id,
      weight_kg: parseFloat(newWeight),
    })
    await supabase.from('profiles').update({ weight_kg: parseFloat(newWeight) }).eq('id', session.user.id)

    setSuccess(`${newWeight} kg enregistré !`)
    setNewWeight('')
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
    load()
  }

  async function deleteWeight(id: string) {
    setDeleting(id)
    await supabase.from('weight_logs').delete().eq('id', id)
    await load()
    setDeleting(null)
  }

  async function saveWeightEdit(id: string) {
    if (!editWeight) return
    setSavingEdit(true)
    await supabase.from('weight_logs').update({ weight_kg: parseFloat(editWeight) }).eq('id', id)
    setEditing(null)
    await load()
    setSavingEdit(false)
  }

  const currentWeight = logs.length > 0 ? logs[logs.length - 1].weight_kg : profile?.weight_kg ?? 0
  const startWeight = logs.length > 0 ? logs[0].weight_kg : profile?.weight_kg ?? 0
  const diff = Math.round((currentWeight - startWeight) * 10) / 10
  const goalLabel: Record<string, string> = { perte: 'Perte de poids', maintien: 'Maintien', masse: 'Prise de masse' }

  const chartColors = {
    dark:  { grid: '#22222E', tick: '#55524E' },
    cream: { grid: '#D4CABC', tick: '#9E9285' },
    light: { grid: '#E5E5EA', tick: '#AEAEB2' },
  }[theme]

  const chartData = {
    labels: logs.map(l => {
      const d = new Date(l.logged_at)
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    }),
    datasets: [{
      label: 'Poids (kg)',
      data: logs.map(l => l.weight_kg),
      borderColor: '#378ADD',
      backgroundColor: 'rgba(55,138,221,0.08)',
      borderWidth: 2,
      pointBackgroundColor: '#378ADD',
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.3,
      fill: true,
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => ` ${ctx.parsed.y} kg` } } },
    scales: {
      x: { grid: { color: chartColors.grid }, ticks: { color: chartColors.tick, font: { size: 11 } } },
      y: {
        grid: { color: chartColors.grid },
        ticks: { color: chartColors.tick, font: { size: 11 }, callback: (v: number | string) => `${v} kg` },
        min: logs.length > 0 ? Math.floor(Math.min(...logs.map(l => l.weight_kg)) - 1) : undefined,
        max: logs.length > 0 ? Math.ceil(Math.max(...logs.map(l => l.weight_kg)) + 1) : undefined,
      }
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Suivi</p>
        <h1 className="text-2xl font-serif text-[var(--text-primary)] mt-1">Progression</h1>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Poids actuel', value: `${currentWeight} kg`, color: 'text-[var(--text-primary)]' },
          { label: 'Évolution', value: `${diff > 0 ? '+' : ''}${diff} kg`, color: diff < 0 ? 'text-green-400' : diff > 0 ? 'text-red-400' : 'text-gray-400' },
          { label: 'Moy. calories / j', value: `${weeklyStats.avg.toLocaleString()}`, color: 'text-blue-300' },
          { label: 'Jours objectif', value: `${weeklyStats.days} / 7`, color: 'text-yellow-500' },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-serif ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* COURBE POIDS */}
        <div className="md:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Courbe de poids</p>
          {logs.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-sm text-gray-500">Enregistrez au moins 2 pesées pour voir la courbe.</p>
            </div>
          ) : (
            <div style={{ position: 'relative', height: '200px' }}>
              <Line key={theme} data={chartData} options={chartOptions as Parameters<typeof Line>[0]['options']} />
            </div>
          )}
        </div>

        {/* ENREGISTRER POIDS */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Ma pesée du jour</p>
          <div className="flex items-baseline gap-2 mb-4">
            <input
              type="number"
              step="0.1"
              placeholder="75.0"
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-2xl font-serif outline-none focus:border-blue-500/50 text-center"
            />
            <span className="text-gray-500 text-lg">kg</span>
          </div>
          <button onClick={saveWeight} disabled={!newWeight || saving}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {success && <p className="text-sm text-green-400 mt-3 text-center">✓ {success}</p>}

          <div className="mt-5 pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Objectif</p>
            <p className="text-sm text-[var(--text-primary)]">{goalLabel[profile?.goal ?? ''] ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-1">{profile?.daily_calories?.toLocaleString()} kcal / jour</p>
          </div>

          {logs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Historique pesées</p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {[...logs].reverse().map(l => (
                  <div key={l.id}>
                    {editing === l.id ? (
                      <div className="flex items-center gap-2 py-1">
                        <input
                          type="number"
                          step="0.1"
                          value={editWeight}
                          onChange={e => setEditWeight(e.target.value)}
                          className="flex-1 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-2 py-1 text-[var(--text-primary)] text-xs outline-none"
                          autoFocus
                        />
                        <span className="text-gray-500 text-xs">kg</span>
                        <button
                          onClick={() => saveWeightEdit(l.id)}
                          disabled={savingEdit}
                          className="text-xs text-blue-400 hover:underline disabled:opacity-50"
                        >
                          {savingEdit ? '...' : 'OK'}
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="text-xs text-gray-500 hover:text-gray-300"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center py-1 group">
                        <span className="text-xs text-gray-500">
                          {new Date(l.logged_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-primary)]">{l.weight_kg} kg</span>
                          <button
                            onClick={() => { setEditing(l.id); setEditWeight(String(l.weight_kg)) }}
                            className="text-xs text-blue-400 md:opacity-0 md:group-hover:opacity-100 hover:underline transition-opacity"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => deleteWeight(l.id)}
                            disabled={deleting === l.id}
                            className="text-xs text-red-400 md:opacity-0 md:group-hover:opacity-100 hover:underline transition-opacity disabled:opacity-50"
                          >
                            {deleting === l.id ? '...' : 'Suppr.'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
