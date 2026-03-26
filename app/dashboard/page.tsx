'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'

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
}

export default function DashboardPage() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const today = new Date().toISOString().split('T')[0]

      const [{ data: profileData }, { data: mealsData }] = await Promise.all([
        supabase.from('profiles').select('daily_calories, full_name').eq('id', session.user.id).single(),
        supabase.from('meals')
          .select('calories, food_id, quantity_g, food_name, meal_type, foods(protein_per_100g, carbs_per_100g, fat_per_100g)')
          .eq('user_id', session.user.id)
          .gte('eaten_at', `${today}T00:00:00`)
      ])

      if (profileData) setProfile(profileData)
      if (mealsData) setMeals(mealsData as unknown as Meal[])
    }
    load()
  }, [])

  const totalCal = Math.round(meals.reduce((s, m) => s + m.calories, 0))
  const goal = profile?.daily_calories ?? 2000
  const remaining = Math.max(goal - totalCal, 0)

  const totalProtein = Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.protein_per_100g * m.quantity_g / 100 : 0), 0))
  const totalCarbs = Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.carbs_per_100g * m.quantity_g / 100 : 0), 0))
  const totalFat = Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.fat_per_100g * m.quantity_g / 100 : 0), 0))

  const calData = {
    datasets: [{
      data: totalCal > 0 ? [totalCal, remaining] : [0, goal],
      backgroundColor: ['#378ADD', '#2A2A38'],
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

  const centerTextPlugin = (main: string, sub: string) => ({
    id: 'centerText',
    afterDraw(chart: ChartJS) {
      const { ctx, width, height } = chart
      ctx.save()
      ctx.font = '500 20px sans-serif'
      ctx.fillStyle = '#F0EDE6'
      ctx.textAlign = 'center' as const
      ctx.textBaseline = 'middle' as const
      ctx.fillText(main, width / 2, height / 2 - 10)
      ctx.font = '11px sans-serif'
      ctx.fillStyle = '#55524E'
      ctx.fillText(sub, width / 2, height / 2 + 12)
      ctx.restore()
    }
  })

  const macros = [
    { label: 'Protéines', value: totalProtein, goal: 80, color: '#378ADD' },
    { label: 'Glucides', value: totalCarbs, goal: 230, color: '#C9A84C' },
    { label: 'Lipides', value: totalFat, goal: 80, color: '#D85A30' },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest">Aujourd'hui</p>
        <h1 className="text-2xl font-serif text-white mt-1">
          {profile?.full_name ? `Bonjour, ${profile.full_name}` : 'Dashboard'}
        </h1>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Calories', value: totalCal.toLocaleString(), sub: `/ ${goal.toLocaleString()} kcal`, color: 'text-white' },
          { label: 'Restantes', value: remaining.toLocaleString(), sub: 'kcal', color: 'text-blue-300' },
          { label: 'Protéines', value: `${totalProtein}g`, sub: `/ 80g`, color: 'text-blue-300' },
          { label: 'Glucides', value: `${totalCarbs}g`, sub: `/ 230g`, color: 'text-yellow-500' },
        ].map(card => (
          <div key={card.label} className="bg-[#18181F] border border-[#22222E] rounded-xl p-4">
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-serif ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-600 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* GRAPHIQUES */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Anneau calories */}
        <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Calories</p>
          <div style={{ position: 'relative', height: '160px' }}>
            <Doughnut
              data={calData}
              options={chartOptions}
              plugins={[centerTextPlugin(`${totalCal}`, 'kcal')]}
            />
          </div>
          <div className="flex gap-3 mt-3 justify-center">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <div className="w-2 h-2 rounded-sm bg-blue-500"/>
              Consommé
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <div className="w-2 h-2 rounded-sm bg-[#2A2A38]"/>
              Restant
            </div>
          </div>
        </div>

        {/* Anneau macros */}
        <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Macronutriments</p>
          <div style={{ position: 'relative', height: '160px' }}>
            <Doughnut
              data={macroData}
              options={chartOptions}
              plugins={[centerTextPlugin(`${totalProtein + totalCarbs + totalFat}g`, 'total')]}
            />
          </div>
          <div className="flex gap-3 mt-3 justify-center flex-wrap">
            {[
              { label: 'P', color: '#378ADD' },
              { label: 'G', color: '#C9A84C' },
              { label: 'L', color: '#D85A30' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-1 text-xs text-gray-400">
                <div className="w-2 h-2 rounded-sm" style={{ background: m.color }}/>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Barres macros */}
        <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Progression macros</p>
          <div className="space-y-4">
            {macros.map(m => (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{m.label}</span>
                  <span style={{ color: m.color }}>{m.value}g / {m.goal}g</span>
                </div>
                <div className="h-1.5 bg-[#2E2E3E] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(m.value / m.goal * 100, 100)}%`, background: m.color }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REPAS DU JOUR */}
      <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-600 uppercase tracking-widest">Repas du jour</p>
          <a href="/dashboard/add" className="text-xs text-blue-400 hover:underline">+ Ajouter</a>
        </div>
        {meals.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun repas enregistré — <a href="/dashboard/add" className="text-blue-400 hover:underline">ajouter un repas</a></p>
        ) : (
          <div>
            {meals.map((m, i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-[#22222E] last:border-none">
                <div>
                  <p className="text-sm font-medium text-white">{m.food_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{m.meal_type}</p>
                </div>
                <span className="text-sm text-yellow-500 font-medium">{m.calories} kcal</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 mt-1 border-t border-[#22222E]">
              <span className="text-xs text-gray-500 uppercase tracking-widest">Total</span>
              <span className="text-base font-serif text-yellow-500">{totalCal} kcal</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}