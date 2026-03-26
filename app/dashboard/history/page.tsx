'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Meal = {
  id: string
  food_name: string
  calories: number
  meal_type: string
  quantity_g: number
  eaten_at: string
}

type DayGroup = {
  date: string
  label: string
  meals: Meal[]
  total: number
}

export default function HistoryPage() {
  const [days, setDays] = useState<DayGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dailyGoal, setDailyGoal] = useState(2000)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const [{ data: profileData }, { data: mealsData }] = await Promise.all([
      supabase.from('profiles').select('daily_calories').eq('id', session.user.id).single(),
      supabase.from('meals')
        .select('id, food_name, calories, meal_type, quantity_g, eaten_at')
        .eq('user_id', session.user.id)
        .order('eaten_at', { ascending: false })
        .limit(200)
    ])

    if (profileData) setDailyGoal(profileData.daily_calories)
    if (!mealsData) { setLoading(false); return }

    // Grouper par jour
    const grouped: Record<string, Meal[]> = {}
    mealsData.forEach(m => {
      const date = m.eaten_at.split('T')[0]
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(m)
    })

    const result: DayGroup[] = Object.entries(grouped).map(([date, meals]) => {
      const d = new Date(date)
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const label = date === today ? "Aujourd'hui" : date === yesterday ? 'Hier' :
        d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      return {
        date,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        meals,
        total: Math.round(meals.reduce((s, m) => s + m.calories, 0))
      }
    })

    setDays(result)
    if (result.length > 0) setOpenDay(result[0].date)
    setLoading(false)
  }

  async function deleteMeal(id: string) {
    setDeleting(id)
    await supabase.from('meals').delete().eq('id', id)
    await load()
    setDeleting(null)
  }

  function statusTag(total: number) {
    const diff = total - dailyGoal
    if (diff > 100) return { label: `+${diff} kcal`, color: 'text-red-400 bg-red-500/10 border-red-500/20' }
    if (diff < -100) return { label: `${diff} kcal`, color: 'text-blue-300 bg-blue-500/10 border-blue-500/20' }
    return { label: 'Objectif atteint', color: 'text-green-300 bg-green-500/10 border-green-500/20' }
  }

  const mealTypeOrder = ['petit-dejeuner', 'dejeuner', 'gouter', 'diner']
  const mealTypeLabel: Record<string, string> = {
    'petit-dejeuner': 'Petit-déjeuner',
    'dejeuner': 'Déjeuner',
    'gouter': 'Goûter',
    'diner': 'Dîner',
  }
  const mealTypeColor: Record<string, string> = {
    'petit-dejeuner': '#85B7EB',
    'dejeuner': '#C9A84C',
    'gouter': '#5DCAA5',
    'diner': '#D85A30',
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest">Journal</p>
        <h1 className="text-2xl font-serif text-white mt-1">Historique</h1>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : days.length === 0 ? (
        <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">Aucun repas enregistré pour l'instant.</p>
          <a href="/dashboard/add" className="text-blue-400 text-sm hover:underline mt-2 block">Ajouter mon premier repas</a>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map(day => {
            const tag = statusTag(day.total)
            const isOpen = openDay === day.date
            const grouped = mealTypeOrder
              .map(type => ({ type, meals: day.meals.filter(m => m.meal_type === type) }))
              .filter(g => g.meals.length > 0)

            return (
              <div key={day.date} className="bg-[#18181F] border border-[#22222E] rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1E1E28] transition-colors"
                  onClick={() => setOpenDay(isOpen ? null : day.date)}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{day.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{day.meals.length} repas enregistrés</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${tag.color}`}>{tag.label}</span>
                    <span className="text-base font-serif text-yellow-500">{day.total.toLocaleString()} kcal</span>
                    <span className="text-gray-600 text-sm">{isOpen ? '↑' : '↓'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#22222E] px-4 pb-4 pt-3">
                    {grouped.map(({ type, meals }) => (
                      <div key={type} className="mb-4 last:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-sm" style={{ background: mealTypeColor[type] ?? '#888' }}/>
                          <p className="text-xs text-gray-500 uppercase tracking-widest">
                            {mealTypeLabel[type] ?? type}
                          </p>
                        </div>
                        {meals.map(meal => (
                          <div key={meal.id} className="flex items-center justify-between py-2 border-b border-[#22222E] last:border-none group">
                            <div>
                              <p className="text-sm text-white">{meal.food_name}</p>
                              {meal.quantity_g > 0 && (
                                <p className="text-xs text-gray-600">{meal.quantity_g}g</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-yellow-500">{meal.calories} kcal</span>
                              <button
                                onClick={() => deleteMeal(meal.id)}
                                disabled={deleting === meal.id}
                                className="text-xs text-red-400 opacity-0 group-hover:opacity-100 hover:underline transition-opacity disabled:opacity-50"
                              >
                                {deleting === meal.id ? '...' : 'Supprimer'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#22222E]">
                      <span className="text-xs text-gray-500 uppercase tracking-widest">Total</span>
                      <span className="text-base font-serif text-yellow-500">{day.total.toLocaleString()} kcal</span>
                    </div>
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