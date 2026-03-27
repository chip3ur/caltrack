'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { useTheme } from './ThemeContext'

ChartJS.register(ArcElement, Tooltip)

type Meal = {
  calories: number
  food_id: string | null
  foods: { protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number } | null
  quantity_g: number
  food_name: string
  meal_type: string
}

type Profile = {
  daily_calories: number
  full_name: string
  water_goal_ml: number
  notif_noon: boolean
}

export default function DashboardPage() {
  const { theme } = useTheme()
  const [meals, setMeals] = useState<Meal[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [streak, setStreak] = useState(0)
  const [waterToday, setWaterToday] = useState(0)
  const [waterLoading, setWaterLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

      const [{ data: profileData }, { data: mealsData }, { data: streakData }, { data: waterData }] = await Promise.all([
        supabase.from('profiles').select('daily_calories, full_name, water_goal_ml, notif_noon').eq('id', session.user.id).single(),
        supabase.from('meals')
          .select('calories, food_id, quantity_g, food_name, meal_type, foods(protein_per_100g, carbs_per_100g, fat_per_100g)')
          .eq('user_id', session.user.id)
          .gte('eaten_at', `${today}T00:00:00`),
        supabase.from('meals')
          .select('calories, eaten_at')
          .eq('user_id', session.user.id)
          .gte('eaten_at', thirtyDaysAgo),
        supabase.from('water_logs')
          .select('amount_ml')
          .eq('user_id', session.user.id)
          .gte('logged_at', `${today}T00:00:00`),
      ])

      if (profileData) setProfile(profileData)
      if (mealsData) setMeals(mealsData as unknown as Meal[])

      // Streak calculation
      if (streakData) {
        const byDay: Record<string, number> = {}
        streakData.forEach(m => {
          const d = m.eaten_at.split('T')[0]
          byDay[d] = (byDay[d] ?? 0) + m.calories
        })
        let s = 0
        let offset = 0
        while (s < 30 && offset < 31) {
          const d = new Date()
          d.setDate(d.getDate() - offset)
          const dateStr = d.toISOString().split('T')[0]
          if ((byDay[dateStr] ?? 0) > 0) { s++; offset++ }
          else if (offset === 0) { offset++ } // today not logged yet
          else break
        }
        setStreak(s)
      }

      const totalWater = (waterData ?? []).reduce((s, w) => s + w.amount_ml, 0)
      setWaterToday(totalWater)

      // Browser notification if past noon and no meals
      if (profileData?.notif_noon && mealsData?.length === 0) {
        const hour = new Date().getHours()
        if (hour >= 12 && Notification.permission === 'granted') {
          const lastNotif = localStorage.getItem('caltrack-last-notif')
          if (lastNotif !== today) {
            new Notification('CalTrack', { body: 'Tu n\'as pas encore enregistré de repas aujourd\'hui.' })
            localStorage.setItem('caltrack-last-notif', today)
          }
        }
      }
    }
    load()
  }, [])

  async function addWater(ml: number) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setWaterLoading(true)
    await supabase.from('water_logs').insert({ user_id: session.user.id, amount_ml: ml })
    setWaterToday(w => w + ml)
    setWaterLoading(false)
  }

  const totalCal = Math.round(meals.reduce((s, m) => s + m.calories, 0))
  const goal = profile?.daily_calories ?? 2000
  const remaining = Math.max(goal - totalCal, 0)
  const waterGoal = profile?.water_goal_ml ?? 2000
  const waterPct = Math.min(waterToday / waterGoal * 100, 100)

  const totalProtein = Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.protein_per_100g * m.quantity_g / 100 : 0), 0))
  const totalCarbs = Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.carbs_per_100g * m.quantity_g / 100 : 0), 0))
  const totalFat = Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.fat_per_100g * m.quantity_g / 100 : 0), 0))

  const secondaryBg = { dark: '#2A2A38', cream: '#E2DDD5', light: '#E5E5EA' }[theme]

  const calData = {
    datasets: [{
      data: totalCal > 0 ? [totalCal, remaining] : [0, goal],
      backgroundColor: ['#378ADD', secondaryBg],
      borderWidth: 0,
      hoverOffset: 4,
    }]
  }

  const macroData = {
    datasets: [{
      data: totalProtein + totalCarbs + totalFat > 0
        ? [totalProtein, totalCarbs, totalFat]
        : [1, 1, 1],
      backgroundColor: ['#378ADD', '#C9A84C', '#D85A30'],
      borderWidth: 0,
      hoverOffset: 4,
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%' as const,
    plugins: { legend: { display: false }, tooltip: { enabled: true } }
  }

  const macros = [
    { label: 'Protéines', value: totalProtein, goal: 80, color: '#378ADD' },
    { label: 'Glucides', value: totalCarbs, goal: 230, color: '#C9A84C' },
    { label: 'Lipides', value: totalFat, goal: 80, color: '#D85A30' },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Aujourd'hui</p>
        <h1 className="text-2xl font-serif text-[var(--text-primary)] mt-1">
          {profile?.full_name ? `Bonjour, ${profile.full_name}` : 'Dashboard'}
        </h1>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Calories', value: totalCal.toLocaleString(), sub: `/ ${goal.toLocaleString()} kcal`, color: 'text-[var(--text-primary)]' },
          { label: 'Restantes', value: remaining.toLocaleString(), sub: 'kcal', color: 'text-blue-300' },
          { label: 'Protéines', value: `${totalProtein}g`, sub: `/ 80g`, color: 'text-blue-300' },
          { label: 'Glucides', value: `${totalCarbs}g`, sub: `/ 230g`, color: 'text-yellow-500' },
          { label: 'Lipides', value: `${totalFat}g`, sub: `/ 80g`, color: 'text-orange-400' },
          { label: 'Série', value: `${streak}j`, sub: streak > 0 ? 'consécutifs' : 'commence !', color: streak >= 7 ? 'text-yellow-500' : streak >= 3 ? 'text-green-400' : 'text-gray-400' },
        ].map(card => (
          <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-serif ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* GRAPHIQUES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Anneau calories */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Calories</p>
          <div style={{ position: 'relative', height: '180px', maxWidth: '240px', margin: '0 auto' }}>
            <Doughnut key={`cal-${theme}`} data={calData} options={chartOptions} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{totalCal}</div>
              <div style={{ fontSize: '11px', color: '#55524E', marginTop: '4px' }}>kcal</div>
            </div>
          </div>
          <div className="flex gap-4 mt-4 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500"/>
              Consommé
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: secondaryBg }}/>
              Restant
            </div>
          </div>
        </div>

        {/* Anneau macros */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Macronutriments</p>
          <div style={{ position: 'relative', height: '180px', maxWidth: '240px', margin: '0 auto' }}>
            <Doughnut key={`macro-${theme}`} data={macroData} options={chartOptions} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1 }}>{totalProtein + totalCarbs + totalFat}g</div>
              <div style={{ fontSize: '11px', color: '#55524E', marginTop: '4px' }}>total</div>
            </div>
          </div>
          <div className="flex gap-4 mt-4 justify-center">
            {[
              { label: 'Protéines', color: '#378ADD' },
              { label: 'Glucides', color: '#C9A84C' },
              { label: 'Lipides', color: '#D85A30' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: m.color }}/>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Barres macros */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-5">Progression macros</p>
          <div className="space-y-5">
            {macros.map(m => (
              <div key={m.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">{m.label}</span>
                  <span style={{ color: m.color }}>{m.value}g <span className="text-gray-500">/ {m.goal}g</span></span>
                </div>
                <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(m.value / m.goal * 100, 100)}%`, background: m.color }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EAU */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Hydratation</p>
          <span className="text-sm font-medium text-blue-300">{waterToday} / {waterGoal} mL</span>
        </div>
        <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all bg-blue-500"
            style={{ width: `${waterPct}%` }}/>
        </div>
        <div className="flex gap-2">
          {[150, 250, 350, 500].map(ml => (
            <button key={ml} onClick={() => addWater(ml)} disabled={waterLoading}
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border-input)] hover:border-blue-500/40 text-[var(--text-primary)] py-2 rounded-xl text-xs transition-colors disabled:opacity-50">
              +{ml}mL
            </button>
          ))}
        </div>
        {waterToday >= waterGoal && (
          <p className="text-xs text-green-400 mt-2 text-center">Objectif hydratation atteint !</p>
        )}
      </div>

      {/* REPAS DU JOUR */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Repas du jour</p>
          <a href="/dashboard/add" className="text-xs text-blue-400 hover:underline">+ Ajouter</a>
        </div>
        {meals.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun repas enregistré — <a href="/dashboard/add" className="text-blue-400 hover:underline">ajouter un repas</a></p>
        ) : (
          <div>
            {meals.map((m, i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-[var(--border)] last:border-none">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{m.food_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{m.meal_type}</p>
                </div>
                <span className="text-sm text-yellow-500 font-medium">{m.calories} kcal</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 mt-1 border-t border-[var(--border)]">
              <span className="text-xs text-gray-500 uppercase tracking-widest">Total</span>
              <span className="text-base font-serif text-yellow-500">{totalCal} kcal</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
