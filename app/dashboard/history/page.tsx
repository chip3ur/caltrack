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
  photo_url?: string | null
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
  const [editing, setEditing] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ food_name: string; calories: string; quantity_g: string; meal_type: string; cal_per_100g: number }>({ food_name: '', calories: '', quantity_g: '', meal_type: 'dejeuner', cal_per_100g: 0 })
  const [saving, setSaving] = useState(false)
  const [dailyGoal, setDailyGoal] = useState(2000)
  const [copying, setCopying] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState('')

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
        .select('id, food_name, calories, meal_type, quantity_g, eaten_at, photo_url')
        .eq('user_id', session.user.id)
        .order('eaten_at', { ascending: false })
        .limit(200)
    ])

    if (profileData) setDailyGoal(profileData.daily_calories)
    if (!mealsData) { setLoading(false); return }

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
    setDays(prev => prev
      .map(day => {
        const meals = day.meals.filter(m => m.id !== id)
        return { ...day, meals, total: Math.round(meals.reduce((s, m) => s + m.calories, 0)) }
      })
      .filter(day => day.meals.length > 0)
    )
    setDeleting(null)
  }

  function startEdit(meal: Meal) {
    setEditing(meal.id)
    const cal_per_100g = meal.quantity_g > 0 ? (meal.calories / meal.quantity_g) * 100 : 0
    setEditValues({
      food_name: meal.food_name,
      calories: String(meal.calories),
      quantity_g: String(meal.quantity_g),
      meal_type: meal.meal_type,
      cal_per_100g,
    })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const newCal = Number(editValues.calories)
    const newQty = Number(editValues.quantity_g)
    await supabase.from('meals').update({
      food_name: editValues.food_name,
      calories: newCal,
      quantity_g: newQty,
      meal_type: editValues.meal_type,
    }).eq('id', id)
    setDays(prev => prev.map(day => {
      const meals = day.meals.map(m => m.id === id
        ? { ...m, food_name: editValues.food_name, calories: newCal, quantity_g: newQty, meal_type: editValues.meal_type }
        : m
      )
      return { ...day, meals, total: Math.round(meals.reduce((s, m) => s + m.calories, 0)) }
    }))
    setEditing(null)
    setSaving(false)
  }

  async function copyDayToToday(day: DayGroup) {
    setCopying(day.date)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const inserts = day.meals.map(m => ({
      user_id: session.user.id,
      food_name: m.food_name,
      calories: m.calories,
      meal_type: m.meal_type,
      quantity_g: m.quantity_g,
      eaten_at: new Date().toISOString(),
    }))
    await supabase.from('meals').insert(inserts)
    setCopySuccess(`${day.meals.length} repas copiés depuis ${day.label}`)
    setCopying(null)
    await load()
    setTimeout(() => setCopySuccess(''), 4000)
  }

  function exportCSV() {
    const BOM = '\uFEFF'
    const headers = ['Date', 'Repas', 'Aliment', 'Quantité (g)', 'Calories (kcal)']
    const rows = days.flatMap(day =>
      day.meals.map(m => [
        day.date,
        m.meal_type,
        `"${m.food_name.replace(/"/g, '""')}"`,
        m.quantity_g,
        m.calories,
      ])
    )
    const csv = BOM + [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `caltrack-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Journal</p>
          <h1 className="text-2xl font-serif text-[var(--text-primary)] mt-1">Historique</h1>
        </div>
        {days.length > 0 && (
          <button onClick={exportCSV}
            className="text-xs border border-[var(--border-input)] text-gray-400 hover:text-[var(--text-primary)] px-3 py-2 rounded-lg transition-colors">
            Exporter CSV
          </button>
        )}
      </div>

      {copySuccess && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-400">
          ✓ {copySuccess}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : days.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
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
              <div key={day.date} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-input)] transition-colors"
                  onClick={() => setOpenDay(isOpen ? null : day.date)}
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{day.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{day.meals.length} repas enregistrés</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${tag.color}`}>{tag.label}</span>
                    <span className="text-base font-serif text-yellow-500">{day.total.toLocaleString()} kcal</span>
                    <span className="text-gray-500 text-sm">{isOpen ? '↑' : '↓'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                    {grouped.map(({ type, meals }) => (
                      <div key={type} className="mb-4 last:mb-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-sm" style={{ background: mealTypeColor[type] ?? '#888' }}/>
                          <p className="text-xs text-gray-500 uppercase tracking-widest">
                            {mealTypeLabel[type] ?? type}
                          </p>
                        </div>
                        {meals.map(meal => (
                          <div key={meal.id} className="border-b border-[var(--border)] last:border-none">
                            {editing === meal.id ? (
                              <div className="py-3 space-y-2">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Nom</p>
                                  <input
                                    value={editValues.food_name}
                                    onChange={e => setEditValues(v => ({ ...v, food_name: e.target.value }))}
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm outline-none"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Quantité (g)</p>
                                    <input
                                      type="number"
                                      value={editValues.quantity_g}
                                      onChange={e => {
                                        const qty = e.target.value
                                        const newCal = editValues.cal_per_100g > 0
                                          ? String(Math.round(editValues.cal_per_100g * Number(qty) / 100))
                                          : editValues.calories
                                        setEditValues(v => ({ ...v, quantity_g: qty, calories: newCal }))
                                      }}
                                      className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm outline-none"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Calories (kcal)</p>
                                    <input
                                      type="number"
                                      value={editValues.calories}
                                      onChange={e => setEditValues(v => ({ ...v, calories: e.target.value }))}
                                      className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm outline-none"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Type de repas</p>
                                  <select
                                    value={editValues.meal_type}
                                    onChange={e => setEditValues(v => ({ ...v, meal_type: e.target.value }))}
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-1.5 text-[var(--text-primary)] text-sm outline-none"
                                  >
                                    <option value="petit-dejeuner">Petit-déjeuner</option>
                                    <option value="dejeuner">Déjeuner</option>
                                    <option value="gouter">Goûter</option>
                                    <option value="diner">Dîner</option>
                                  </select>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => saveEdit(meal.id)}
                                    disabled={saving}
                                    className="text-xs bg-blue-600/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/30 disabled:opacity-50"
                                  >
                                    {saving ? '...' : 'Sauvegarder'}
                                  </button>
                                  <button
                                    onClick={() => setEditing(null)}
                                    className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between py-2 group">
                                <div className="flex items-center gap-3">
                                  {meal.photo_url && (
                                    <img src={meal.photo_url} alt={meal.food_name}
                                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>
                                  )}
                                  <div>
                                    <p className="text-sm text-[var(--text-primary)]">{meal.food_name}</p>
                                    {meal.quantity_g > 0 && (
                                      <p className="text-xs text-gray-500">{meal.quantity_g}g</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-yellow-500">{meal.calories} kcal</span>
                                  <button
                                    onClick={() => startEdit(meal)}
                                    className="text-xs text-blue-400 md:opacity-0 md:group-hover:opacity-100 hover:underline transition-opacity"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    onClick={() => deleteMeal(meal.id)}
                                    disabled={deleting === meal.id}
                                    className="text-xs text-red-400 md:opacity-0 md:group-hover:opacity-100 hover:underline transition-opacity disabled:opacity-50"
                                  >
                                    {deleting === meal.id ? '...' : 'Supprimer'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border)]">
                      <span className="text-xs text-gray-500 uppercase tracking-widest">Total</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => copyDayToToday(day)}
                          disabled={copying === day.date}
                          className="text-xs text-blue-400 hover:underline disabled:opacity-50"
                        >
                          {copying === day.date ? 'Copie...' : 'Copier vers aujourd\'hui'}
                        </button>
                        <span className="text-base font-serif text-yellow-500">{day.total.toLocaleString()} kcal</span>
                      </div>
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
