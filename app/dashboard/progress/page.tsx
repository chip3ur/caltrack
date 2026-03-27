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

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

type WeightLog = {
  id: string
  weight_kg: number
  logged_at: string
}

export default function ProgressPage() {
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [profile, setProfile] = useState<{ weight_kg: number; goal: string; daily_calories: number } | null>(null)
  const [newWeight, setNewWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [weeklyStats, setWeeklyStats] = useState({ avg: 0, best: 0, days: 0 })

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

    // Stats semaine
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

    // Mettre à jour le poids dans le profil
    await supabase.from('profiles').update({ weight_kg: parseFloat(newWeight) }).eq('id', session.user.id)

    setSuccess(`${newWeight} kg enregistré !`)
    setNewWeight('')
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
    load()
  }

  const currentWeight = logs.length > 0 ? logs[logs.length - 1].weight_kg : profile?.weight_kg ?? 0
  const startWeight = logs.length > 0 ? logs[0].weight_kg : profile?.weight_kg ?? 0
  const diff = Math.round((currentWeight - startWeight) * 10) / 10
  const goalLabel: Record<string, string> = { perte: 'Perte de poids', maintien: 'Maintien', masse: 'Prise de masse' }

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
      x: { grid: { color: '#22222E' }, ticks: { color: '#55524E', font: { size: 11 } } },
      y: {
        grid: { color: '#22222E' },
        ticks: { color: '#55524E', font: { size: 11 }, callback: (v: number | string) => `${v} kg` },
        min: logs.length > 0 ? Math.floor(Math.min(...logs.map(l => l.weight_kg)) - 1) : undefined,
        max: logs.length > 0 ? Math.ceil(Math.max(...logs.map(l => l.weight_kg)) + 1) : undefined,
      }
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest">Suivi</p>
        <h1 className="text-2xl font-serif text-white mt-1">Progression</h1>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Poids actuel', value: `${currentWeight} kg`, color: 'text-white' },
          { label: 'Évolution', value: `${diff > 0 ? '+' : ''}${diff} kg`, color: diff < 0 ? 'text-green-400' : diff > 0 ? 'text-red-400' : 'text-gray-400' },
          { label: 'Moy. calories / j', value: `${weeklyStats.avg.toLocaleString()}`, color: 'text-blue-300' },
          { label: 'Jours objectif', value: `${weeklyStats.days} / 7`, color: 'text-yellow-500' },
        ].map(card => (
          <div key={card.label} className="bg-[#18181F] border border-[#22222E] rounded-xl p-4">
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-serif ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* COURBE POIDS */}
        <div className="md:col-span-2 bg-[#18181F] border border-[#22222E] rounded-xl p-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Courbe de poids</p>
          {logs.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-sm text-gray-500">Enregistrez au moins 2 pesées pour voir la courbe.</p>
            </div>
          ) : (
            <div style={{ position: 'relative', height: '200px' }}>
              <Line data={chartData} options={chartOptions as Parameters<typeof Line>[0]['options']} />
            </div>
          )}
        </div>

        {/* ENREGISTRER POIDS */}
        <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Ma pesée du jour</p>
          <div className="flex items-baseline gap-2 mb-4">
            <input
              type="number"
              step="0.1"
              placeholder="75.0"
              value={newWeight}
              onChange={e => setNewWeight(e.target.value)}
              className="w-full bg-[#1E1E28] border border-[#2E2E3E] rounded-xl px-4 py-3 text-white text-2xl font-serif outline-none focus:border-blue-500/50 text-center"
            />
            <span className="text-gray-500 text-lg">kg</span>
          </div>
          <button onClick={saveWeight} disabled={!newWeight || saving}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {success && <p className="text-sm text-green-400 mt-3 text-center">✓ {success}</p>}

          <div className="mt-5 pt-4 border-t border-[#22222E]">
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Objectif</p>
            <p className="text-sm text-white">{goalLabel[profile?.goal ?? ''] ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-1">{profile?.daily_calories?.toLocaleString()} kcal / jour</p>
          </div>

          {logs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#22222E]">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Historique pesées</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {[...logs].reverse().map(l => (
                  <div key={l.id} className="flex justify-between text-xs">
                    <span className="text-gray-500">
                      {new Date(l.logged_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-white">{l.weight_kg} kg</span>
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