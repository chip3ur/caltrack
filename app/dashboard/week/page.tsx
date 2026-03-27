'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
import { useTheme } from '../ThemeContext'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

type DayStat = {
  date: string
  label: string
  total: number
  protein: number
  carbs: number
  fat: number
}

export default function WeekPage() {
  const { theme } = useTheme()
  const [stats, setStats] = useState<DayStat[]>([])
  const [goal, setGoal] = useState(2000)
  const [loading, setLoading] = useState(true)
  const [weightStart, setWeightStart] = useState<number | null>(null)
  const [weightEnd, setWeightEnd] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const [{ data: profileData }, { data: mealsData }, { data: weightData }] = await Promise.all([
      supabase.from('profiles').select('daily_calories').eq('id', session.user.id).single(),
      supabase.from('meals')
        .select('calories, eaten_at, quantity_g, foods(protein_per_100g, carbs_per_100g, fat_per_100g)')
        .eq('user_id', session.user.id)
        .gte('eaten_at', sevenDaysAgo.toISOString()),
      supabase.from('weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_id', session.user.id)
        .gte('logged_at', sevenDaysAgo.toISOString())
        .order('logged_at', { ascending: true }),
    ])

    if (profileData) setGoal(profileData.daily_calories)

    // Build last 7 days
    const days: DayStat[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dayMeals = (mealsData ?? []).filter(m => m.eaten_at.startsWith(dateStr))
      const total = Math.round(dayMeals.reduce((s, m) => s + m.calories, 0))
      const protein = Math.round(dayMeals.reduce((s, m) => {
        const f = (m.foods as unknown) as { protein_per_100g: number } | null
        return s + (f ? f.protein_per_100g * m.quantity_g / 100 : 0)
      }, 0))
      const carbs = Math.round(dayMeals.reduce((s, m) => {
        const f = (m.foods as unknown) as { carbs_per_100g: number } | null
        return s + (f ? f.carbs_per_100g * m.quantity_g / 100 : 0)
      }, 0))
      const fat = Math.round(dayMeals.reduce((s, m) => {
        const f = (m.foods as unknown) as { fat_per_100g: number } | null
        return s + (f ? f.fat_per_100g * m.quantity_g / 100 : 0)
      }, 0))
      const label = i === 0 ? "Auj." : i === 1 ? 'Hier' :
        d.toLocaleDateString('fr-FR', { weekday: 'short' })
      days.push({ date: dateStr, label: label.charAt(0).toUpperCase() + label.slice(1), total, protein, carbs, fat })
    }
    setStats(days)

    if (weightData && weightData.length > 0) {
      setWeightStart(weightData[0].weight_kg)
      setWeightEnd(weightData[weightData.length - 1].weight_kg)
    }

    setLoading(false)
  }

  const chartColors = {
    dark:  { grid: '#22222E', tick: '#55524E' },
    cream: { grid: '#D4CABC', tick: '#9E9285' },
    light: { grid: '#E5E5EA', tick: '#AEAEB2' },
  }[theme]

  const loggedDays = stats.filter(d => d.total > 0)
  const avgCal = loggedDays.length > 0
    ? Math.round(loggedDays.reduce((s, d) => s + d.total, 0) / loggedDays.length)
    : 0
  const bestDay = loggedDays.length > 0
    ? loggedDays.reduce((best, d) => Math.abs(d.total - goal) < Math.abs(best.total - goal) ? d : best)
    : null
  const daysOnTarget = stats.filter(d => d.total > 0 && Math.abs(d.total - goal) <= goal * 0.1).length
  const weightDiff = weightStart !== null && weightEnd !== null
    ? Math.round((weightEnd - weightStart) * 10) / 10
    : null

  const chartData = {
    labels: stats.map(d => d.label),
    datasets: [{
      label: 'Calories',
      data: stats.map(d => d.total),
      backgroundColor: stats.map(d =>
        d.total === 0 ? 'rgba(85,82,78,0.2)'
        : Math.abs(d.total - goal) <= goal * 0.1 ? 'rgba(92,202,165,0.7)'
        : d.total > goal * 1.1 ? 'rgba(216,90,48,0.7)'
        : 'rgba(55,138,221,0.7)'
      ),
      borderRadius: 6,
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => ` ${ctx.parsed.y} kcal` } }
    },
    scales: {
      x: { grid: { color: chartColors.grid }, ticks: { color: chartColors.tick, font: { size: 11 } } },
      y: {
        grid: { color: chartColors.grid },
        ticks: { color: chartColors.tick, font: { size: 11 }, callback: (v: number | string) => `${v}` },
        min: 0,
      }
    }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Bilan</p>
        <h1 className="text-2xl font-serif text-[var(--text-primary)] mt-1">Semaine</h1>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Moy. calories</p>
          <p className="text-2xl font-serif text-blue-300">{avgCal.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">/ {goal.toLocaleString()} obj.</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Jours dans l'objectif</p>
          <p className="text-2xl font-serif text-green-400">{daysOnTarget} / 7</p>
          <p className="text-xs text-gray-500 mt-1">±10 % de l'objectif</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Meilleur jour</p>
          <p className="text-2xl font-serif text-yellow-500">{bestDay?.label ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">{bestDay ? `${bestDay.total} kcal` : 'Pas de données'}</p>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Évolution poids</p>
          <p className={`text-2xl font-serif ${weightDiff === null ? 'text-gray-500' : weightDiff < 0 ? 'text-green-400' : weightDiff > 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {weightDiff === null ? '—' : `${weightDiff > 0 ? '+' : ''}${weightDiff} kg`}
          </p>
          <p className="text-xs text-gray-500 mt-1">sur 7 jours</p>
        </div>
      </div>

      {/* GRAPHIQUE BARRES */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Calories par jour</p>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block"/>Objectif</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block"/>En dessous</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block"/>Dépassé</span>
          </div>
        </div>
        {/* Ligne objectif */}
        <div style={{ position: 'relative', height: '200px' }}>
          <Bar key={theme} data={chartData} options={chartOptions as Parameters<typeof Bar>[0]['options']} />
        </div>
      </div>

      {/* TABLEAU DÉTAILLÉ */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Détail par jour</p>
        <div className="space-y-1">
          <div className="grid grid-cols-5 gap-2 text-xs text-gray-500 uppercase tracking-widest pb-2 border-b border-[var(--border)]">
            <span>Jour</span>
            <span className="text-right">Calories</span>
            <span className="text-right">Prot.</span>
            <span className="text-right">Gluc.</span>
            <span className="text-right">Lip.</span>
          </div>
          {stats.map(d => (
            <div key={d.date} className="grid grid-cols-5 gap-2 py-2 border-b border-[var(--border)] last:border-none text-sm">
              <span className="text-[var(--text-primary)]">{d.label}</span>
              <span className={`text-right font-medium ${
                d.total === 0 ? 'text-gray-600'
                : Math.abs(d.total - goal) <= goal * 0.1 ? 'text-green-400'
                : d.total > goal * 1.1 ? 'text-red-400'
                : 'text-yellow-500'
              }`}>{d.total > 0 ? `${d.total}` : '—'}</span>
              <span className="text-right text-gray-400">{d.protein > 0 ? `${d.protein}g` : '—'}</span>
              <span className="text-right text-gray-400">{d.carbs > 0 ? `${d.carbs}g` : '—'}</span>
              <span className="text-right text-gray-400">{d.fat > 0 ? `${d.fat}g` : '—'}</span>
            </div>
          ))}
          {loggedDays.length > 0 && (
            <div className="grid grid-cols-5 gap-2 py-2 text-sm font-medium">
              <span className="text-gray-500 uppercase text-xs tracking-widest">Moy.</span>
              <span className="text-right text-yellow-500">{avgCal}</span>
              <span className="text-right text-blue-300">{Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length)}g</span>
              <span className="text-right text-yellow-500">{Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length)}g</span>
              <span className="text-right text-orange-400">{Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedDays.length)}g</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
