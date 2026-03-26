'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Food = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

type Meal = {
  id: string
  food_name: string
  calories: number
  meal_type: string
}

function TodayMeals({ refresh }: { refresh: number }) {
  const [meals, setMeals] = useState<Meal[]>([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const { data } = await supabase
        .from('meals')
        .select('id, food_name, calories, meal_type')
        .eq('user_id', session.user.id)
        .gte('eaten_at', `${today}T00:00:00`)
        .order('eaten_at', { ascending: false })
      if (data) setMeals(data)
    }
    load()
  }, [refresh])

  const total = meals.reduce((sum, m) => sum + m.calories, 0)

  if (meals.length === 0) return (
    <p className="text-sm text-gray-500">Aucun repas aujourd'hui.</p>
  )

  return (
    <div>
      {meals.map(m => (
        <div key={m.id} className="flex justify-between items-center py-3 border-b border-[#22222E] last:border-none">
          <div>
            <p className="text-sm font-medium text-white">{m.food_name}</p>
            <p className="text-xs text-gray-500 capitalize">{m.meal_type}</p>
          </div>
          <span className="text-sm text-yellow-500 font-medium">{m.calories} kcal</span>
        </div>
      ))}
      <div className="flex justify-between items-center pt-3 mt-1 border-t border-[#22222E]">
        <span className="text-xs text-gray-500 uppercase tracking-widest">Total</span>
        <span className="text-base font-serif text-yellow-500">{total} kcal</span>
      </div>
    </div>
  )
}

export default function AddMealPage() {
  const [tab, setTab] = useState<'search' | 'manual' | 'ai'>('search')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState(100)
  const [mealType, setMealType] = useState('dejeuner')
  const [success, setSuccess] = useState('')
  const [refresh, setRefresh] = useState(0)

  // Saisie manuelle
  const [manualName, setManualName] = useState('')
  const [manualCal, setManualCal] = useState('')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCarbs, setManualCarbs] = useState('')
  const [manualFat, setManualFat] = useState('')
  const [manualQty, setManualQty] = useState(100)
  const [saving, setSaving] = useState(false)

  // IA
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai', content: string, total?: number, desc?: string }[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  async function searchFoods(q: string) {
    setSearch(q)
    setSelected(null)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('foods')
      .select('*')
      .ilike('name', `%${q}%`)
      .limit(8)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function addMealFromFood(food: Food, qty: number) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const cal = Math.round(food.calories_per_100g * qty / 100)
    const { error } = await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: food.name,
      food_id: food.id,
      quantity_g: qty,
      calories: cal,
      meal_type: mealType,
      eaten_at: new Date().toISOString(),
    })
    if (!error) {
      setSuccess(`${food.name} ajouté — ${cal} kcal`)
      setSelected(null)
      setSearch('')
      setSearchResults([])
      setRefresh(r => r + 1)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  async function saveManualFood() {
    if (!manualName || !manualCal) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Sauvegarder dans foods
    const { data: food, error } = await supabase
      .from('foods')
      .insert({
        name: manualName,
        calories_per_100g: parseFloat(manualCal),
        protein_per_100g: parseFloat(manualProtein) || 0,
        carbs_per_100g: parseFloat(manualCarbs) || 0,
        fat_per_100g: parseFloat(manualFat) || 0,
      })
      .select()
      .single()

    if (error) { setSaving(false); return }

    // Ajouter dans meals
    const cal = Math.round(parseFloat(manualCal) * manualQty / 100)
    await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: manualName,
      food_id: food.id,
      quantity_g: manualQty,
      calories: cal,
      meal_type: mealType,
      eaten_at: new Date().toISOString(),
    })

    setSuccess(`${manualName} ajouté et sauvegardé — ${cal} kcal`)
    setManualName('')
    setManualCal('')
    setManualProtein('')
    setManualCarbs('')
    setManualFat('')
    setManualQty(100)
    setRefresh(r => r + 1)
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function sendAI() {
    if (!aiInput.trim()) return
    const msg = aiInput.trim()
    setAiInput('')
    setAiMessages(prev => [...prev, { role: 'user', content: msg }])
    setAiLoading(true)
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      if (data.error) {
        setAiMessages(prev => [...prev, { role: 'ai', content: `Erreur : ${data.error}` }])
      } else {
        setAiMessages(prev => [...prev, { role: 'ai', content: data.text, total: data.total, desc: msg }])
      }
    } catch {
      setAiMessages(prev => [...prev, { role: 'ai', content: 'Erreur réseau.' }])
    }
    setAiLoading(false)
  }

  async function addAIMeal(total: number, desc: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: desc.substring(0, 60),
      quantity_g: 0,
      calories: total,
      meal_type: mealType,
      eaten_at: new Date().toISOString(),
    })
    setSuccess(`Repas ajouté — ${total} kcal`)
    setRefresh(r => r + 1)
    setTimeout(() => setSuccess(''), 3000)
  }

  const tabClass = (t: string) => `flex-1 py-2 rounded-lg text-sm transition-colors ${tab === t ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`
  const inputClass = "w-full bg-[#1E1E28] border border-[#2E2E3E] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50"
  const calories = selected ? Math.round(selected.calories_per_100g * quantity / 100) : 0

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest">Journal</p>
        <h1 className="text-2xl font-serif text-white mt-1">Ajouter un repas</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex gap-2 mb-5">
            <button onClick={() => setTab('search')} className={tabClass('search')}>Recherche</button>
            <button onClick={() => setTab('manual')} className={tabClass('manual')}>Manuel</button>
            <button onClick={() => setTab('ai')} className={tabClass('ai')}>IA</button>
          </div>

          {/* RECHERCHE */}
          {tab === 'search' && (
            <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Rechercher dans la base</p>
              <input
                placeholder="Riz, poulet, saumon..."
                value={search}
                onChange={e => searchFoods(e.target.value)}
                className={`${inputClass} mb-3`}
              />
              {searching && <p className="text-sm text-gray-500">Recherche...</p>}
              {!selected && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map(f => (
                    <div key={f.id} onClick={() => setSelected(f)}
                      className="flex justify-between items-center p-3 bg-[#1E1E28] border border-[#2E2E3E] hover:border-blue-500/40 rounded-xl cursor-pointer">
                      <span className="text-sm text-white">{f.name}</span>
                      <span className="text-sm text-yellow-500">{f.calories_per_100g} kcal/100g</span>
                    </div>
                  ))}
                </div>
              )}
              {search.length >= 2 && !searching && searchResults.length === 0 && !selected && (
                <div className="p-3 border border-dashed border-[#2E2E3E] rounded-xl text-sm text-gray-500">
                  Aucun résultat — <button onClick={() => setTab('manual')} className="text-blue-400 hover:underline">ajouter manuellement</button>
                </div>
              )}
              {selected && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-white">{selected.name}</span>
                    <button onClick={() => setSelected(null)} className="text-xs text-gray-500 hover:text-gray-300">✕ changer</button>
                  </div>
                  <div className="flex gap-2 mb-3 text-xs text-gray-500">
                    <span>P: {selected.protein_per_100g}g</span>
                    <span>G: {selected.carbs_per_100g}g</span>
                    <span>L: {selected.fat_per_100g}g</span>
                    <span className="text-yellow-500 ml-auto">{selected.calories_per_100g} kcal/100g</span>
                  </div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Quantité (g)</label>
                    <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className={inputClass}/>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Type de repas</label>
                    <select value={mealType} onChange={e => setMealType(e.target.value)} className={inputClass}>
                      <option value="petit-dejeuner">Petit-déjeuner</option>
                      <option value="dejeuner">Déjeuner</option>
                      <option value="gouter">Goûter</option>
                      <option value="diner">Dîner</option>
                    </select>
                  </div>
                  <p className="text-3xl font-serif text-yellow-500 text-center my-3">{calories} kcal</p>
                  <button onClick={() => addMealFromFood(selected, quantity)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium">
                    Ajouter au journal
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SAISIE MANUELLE */}
          {tab === 'manual' && (
            <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Nouvel aliment</p>
              <p className="text-xs text-gray-500 mb-4">Les données seront sauvegardées pour une prochaine utilisation.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Nom de l'aliment</label>
                  <input placeholder="Ex : Quiche lorraine" value={manualName} onChange={e => setManualName(e.target.value)} className={inputClass}/>
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Calories pour 100g <span className="text-red-400">*</span></label>
                  <input type="number" placeholder="Ex : 280" value={manualCal} onChange={e => setManualCal(e.target.value)} className={inputClass}/>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Protéines (g)</label>
                    <input type="number" placeholder="0" value={manualProtein} onChange={e => setManualProtein(e.target.value)} className={inputClass}/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Glucides (g)</label>
                    <input type="number" placeholder="0" value={manualCarbs} onChange={e => setManualCarbs(e.target.value)} className={inputClass}/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Lipides (g)</label>
                    <input type="number" placeholder="0" value={manualFat} onChange={e => setManualFat(e.target.value)} className={inputClass}/>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Quantité consommée (g)</label>
                  <input type="number" value={manualQty} onChange={e => setManualQty(Number(e.target.value))} className={inputClass}/>
                </div>
                <div>
                  <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Type de repas</label>
                  <select value={mealType} onChange={e => setMealType(e.target.value)} className={inputClass}>
                    <option value="petit-dejeuner">Petit-déjeuner</option>
                    <option value="dejeuner">Déjeuner</option>
                    <option value="gouter">Goûter</option>
                    <option value="diner">Dîner</option>
                  </select>
                </div>
                {manualName && manualCal && (
                  <p className="text-2xl font-serif text-yellow-500 text-center">
                    {Math.round(parseFloat(manualCal) * manualQty / 100)} kcal
                  </p>
                )}
                <button onClick={saveManualFood} disabled={!manualName || !manualCal || saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium">
                  {saving ? 'Sauvegarde...' : 'Ajouter et sauvegarder'}
                </button>
              </div>
            </div>
          )}

          {/* SAISIE IA */}
          {tab === 'ai' && (
            <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Assistant IA</p>
              <div className="bg-[#1E1E28] border border-[#2E2E3E] rounded-xl p-3 text-sm text-gray-400 mb-3">
                Décrivez ce que vous avez mangé — j'estime les calories automatiquement.
              </div>
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {aiMessages.map((m, i) => (
                  <div key={i} className={`p-3 rounded-xl text-sm ${m.role === 'user' ? 'bg-blue-600/15 text-blue-200 text-right' : 'bg-[#1E1E28] text-gray-300'}`}>
                    <p className="whitespace-pre-line">{m.content}</p>
                    {m.role === 'ai' && m.total && (
                      <button onClick={() => addAIMeal(m.total!, m.desc ?? '')}
                        className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs">
                        Ajouter {m.total} kcal au journal
                      </button>
                    )}
                  </div>
                ))}
                {aiLoading && <div className="p-3 bg-[#1E1E28] rounded-xl text-sm text-gray-500">Analyse en cours...</div>}
              </div>
              <div className="flex gap-2">
                <input value={aiInput} onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAI()}
                  placeholder="Ex : 5 sushis et un tiramisu..."
                  className="flex-1 bg-[#1E1E28] border border-[#2E2E3E] rounded-xl px-4 py-3 text-white text-sm outline-none"/>
                <button onClick={sendAI} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl text-lg">↑</button>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-400">
              ✓ {success}
            </div>
          )}
        </div>

        <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Repas d'aujourd'hui</p>
          <TodayMeals refresh={refresh} />
        </div>
      </div>
    </div>
  )
}