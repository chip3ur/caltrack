'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Ingredient = {
  name: string
  quantity_g: number
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

type Recipe = {
  id: string
  name: string
  total_weight_g: number
  food_id: string
  foods: {
    calories_per_100g: number
    protein_per_100g: number
    carbs_per_100g: number
    fat_per_100g: number
  } | null
  ingredients?: Ingredient[]
}

const MEAL_TYPES = [
  { key: 'petit-dejeuner', label: 'Petit-déjeuner' },
  { key: 'dejeuner', label: 'Déjeuner' },
  { key: 'gouter', label: 'Goûter' },
  { key: 'diner', label: 'Dîner' },
]

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [openRecipe, setOpenRecipe] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // New recipe form
  const [newName, setNewName] = useState('')
  const [totalWeight, setTotalWeight] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])

  // Ingredient form
  const [ingSearch, setIngSearch] = useState('')
  const [ingResults, setIngResults] = useState<any[]>([])
  const [ingName, setIngName] = useState('')
  const [ingQty, setIngQty] = useState('100')
  const [ingCal, setIngCal] = useState('')
  const [ingProt, setIngProt] = useState('')
  const [ingCarbs, setIngCarbs] = useState('')
  const [ingFat, setIngFat] = useState('')

  // Log portion
  const [logRecipe, setLogRecipe] = useState<Recipe | null>(null)
  const [logQty, setLogQty] = useState('200')
  const [logMealType, setLogMealType] = useState('dejeuner')
  const [logging, setLogging] = useState(false)
  const [logSuccess, setLogSuccess] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('recipes')
      .select('id, name, total_weight_g, food_id, foods(calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    setRecipes((data ?? []).map((r: any) => ({
      ...r,
      foods: Array.isArray(r.foods) ? (r.foods[0] ?? null) : r.foods,
    })) as Recipe[])
    setLoading(false)
  }

  async function loadIngredients(recipeId: string) {
    const { data } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipeId)
    setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, ingredients: data ?? [] } : r))
  }

  async function searchFoods(q: string) {
    if (q.length < 2) { setIngResults([]); return }
    const { data } = await supabase.from('foods')
      .select('name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
      .ilike('name', `%${q}%`).limit(8)
    setIngResults(data ?? [])
  }

  function selectFood(f: any) {
    setIngName(f.name)
    setIngCal(String(f.calories_per_100g))
    setIngProt(String(f.protein_per_100g))
    setIngCarbs(String(f.carbs_per_100g))
    setIngFat(String(f.fat_per_100g))
    setIngSearch('')
    setIngResults([])
  }

  function addIngredient() {
    if (!ingName || !ingCal || !ingQty) return
    setIngredients(prev => [...prev, {
      name: ingName.trim(),
      quantity_g: Number(ingQty),
      calories_per_100g: Number(ingCal),
      protein_per_100g: Number(ingProt) || 0,
      carbs_per_100g: Number(ingCarbs) || 0,
      fat_per_100g: Number(ingFat) || 0,
    }])
    setIngName(''); setIngCal(''); setIngProt(''); setIngCarbs(''); setIngFat(''); setIngQty('100')
  }

  // Computed totals
  const rawWeight = ingredients.reduce((s, i) => s + i.quantity_g, 0)
  const finishedWeight = Number(totalWeight) || rawWeight
  const totalCal = ingredients.reduce((s, i) => s + i.calories_per_100g * i.quantity_g / 100, 0)
  const totalProt = ingredients.reduce((s, i) => s + i.protein_per_100g * i.quantity_g / 100, 0)
  const totalCarbs2 = ingredients.reduce((s, i) => s + i.carbs_per_100g * i.quantity_g / 100, 0)
  const totalFat2 = ingredients.reduce((s, i) => s + i.fat_per_100g * i.quantity_g / 100, 0)
  const cal100 = finishedWeight > 0 ? Math.round(totalCal / finishedWeight * 100) : 0
  const prot100 = finishedWeight > 0 ? Math.round(totalProt / finishedWeight * 100 * 10) / 10 : 0
  const carbs100 = finishedWeight > 0 ? Math.round(totalCarbs2 / finishedWeight * 100 * 10) / 10 : 0
  const fat100 = finishedWeight > 0 ? Math.round(totalFat2 / finishedWeight * 100 * 10) / 10 : 0

  async function saveRecipe() {
    if (!newName || ingredients.length === 0) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: food } = await supabase.from('foods').insert({
      name: newName.trim(),
      calories_per_100g: cal100,
      protein_per_100g: prot100,
      carbs_per_100g: carbs100,
      fat_per_100g: fat100,
    }).select('id').single()

    if (!food) { setSaving(false); return }

    const { data: recipe } = await supabase.from('recipes').insert({
      user_id: session.user.id,
      name: newName.trim(),
      total_weight_g: finishedWeight,
      food_id: food.id,
    }).select('id').single()

    if (recipe) {
      await supabase.from('recipe_ingredients').insert(
        ingredients.map(i => ({ recipe_id: recipe.id, ingredient_name: i.name, quantity_g: i.quantity_g, calories_per_100g: i.calories_per_100g, protein_per_100g: i.protein_per_100g, carbs_per_100g: i.carbs_per_100g, fat_per_100g: i.fat_per_100g }))
      )
    }

    setCreating(false); setNewName(''); setTotalWeight(''); setIngredients([])
    setSaving(false)
    await load()
  }

  async function logPortion() {
    if (!logRecipe?.foods) return
    const qty = Number(logQty) || 100
    const cal = Math.round(logRecipe.foods.calories_per_100g * qty / 100)
    setLogging(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: logRecipe.name,
      food_id: logRecipe.food_id,
      quantity_g: qty,
      calories: cal,
      meal_type: logMealType,
      eaten_at: new Date().toISOString(),
    })
    setLogSuccess(`${logRecipe.name} — ${cal} kcal ajouté !`)
    setLogRecipe(null)
    setLogging(false)
    setTimeout(() => setLogSuccess(''), 4000)
  }

  async function deleteRecipe(id: string, foodId: string) {
    await supabase.from('recipes').delete().eq('id', id)
    await supabase.from('foods').delete().eq('id', foodId)
    setRecipes(prev => prev.filter(r => r.id !== id))
  }

  const inp = "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-blue-500/50"
  const inpSm = "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm outline-none"

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Nutrition</p>
          <h1 className="text-2xl font-serif text-[var(--text-primary)] mt-1">Recettes</h1>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
            + Nouvelle recette
          </button>
        )}
      </div>

      {logSuccess && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-400">
          ✓ {logSuccess}
        </div>
      )}

      {/* CRÉER UNE RECETTE */}
      {creating && (
        <div className="bg-[var(--bg-card)] border border-blue-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Nouvelle recette</p>
            <button onClick={() => { setCreating(false); setIngredients([]) }} className="text-xs text-gray-500 hover:text-gray-300">Annuler</button>
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Nom du plat</label>
            <input placeholder="Ex : Pâtes carbonara" value={newName} onChange={e => setNewName(e.target.value)} className={inp} />
          </div>

          {/* Ingrédients ajoutés */}
          {ingredients.length > 0 && (
            <div className="mb-4 space-y-1.5">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg">
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">{ing.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{ing.quantity_g}g</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-yellow-500">{Math.round(ing.calories_per_100g * ing.quantity_g / 100)} kcal</span>
                    <button onClick={() => setIngredients(prev => prev.filter((_, j) => j !== i))} className="text-xs text-red-400">✕</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-xs text-gray-500 px-1 pt-1">
                <span>Poids brut : {rawWeight}g</span>
                <span className="text-yellow-500">{Math.round(totalCal)} kcal total</span>
              </div>
            </div>
          )}

          {/* Ajouter un ingrédient */}
          <div className="border border-[var(--border-input)] rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Ajouter un ingrédient</p>
            <div className="relative mb-2">
              <input placeholder="Rechercher un aliment..." value={ingSearch}
                onChange={e => { setIngSearch(e.target.value); searchFoods(e.target.value) }}
                className={inpSm} />
              {ingResults.length > 0 && (
                <div className="absolute z-10 w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl mt-1 overflow-hidden shadow-xl">
                  {ingResults.map((f, i) => (
                    <button key={i} onClick={() => selectFood(f)}
                      className="w-full text-left px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] flex justify-between border-b border-[var(--border)] last:border-none">
                      <span>{f.name}</span>
                      <span className="text-gray-500 text-xs">{f.calories_per_100g} kcal/100g</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input placeholder="Nom de l'ingrédient" value={ingName} onChange={e => setIngName(e.target.value)} className={inpSm} />
              <input type="number" placeholder="Quantité (g)" value={ingQty} onChange={e => setIngQty(e.target.value)} className={inpSm} />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              <input type="number" placeholder="Kcal/100g" value={ingCal} onChange={e => setIngCal(e.target.value)} className={inpSm} />
              <input type="number" placeholder="Prot." value={ingProt} onChange={e => setIngProt(e.target.value)} className={inpSm} />
              <input type="number" placeholder="Gluc." value={ingCarbs} onChange={e => setIngCarbs(e.target.value)} className={inpSm} />
              <input type="number" placeholder="Lip." value={ingFat} onChange={e => setIngFat(e.target.value)} className={inpSm} />
            </div>
            <button onClick={addIngredient} disabled={!ingName || !ingCal}
              className="w-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] py-2 rounded-lg text-sm disabled:opacity-40">
              + Ajouter à la recette
            </button>
          </div>

          {/* Poids fini + preview */}
          {ingredients.length > 0 && (
            <>
              <div className="mb-4">
                <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">
                  Poids du plat fini (g) <span className="normal-case text-gray-600">— par défaut : poids brut {rawWeight}g</span>
                </label>
                <input type="number" placeholder={String(rawWeight)} value={totalWeight}
                  onChange={e => setTotalWeight(e.target.value)} className={inp} />
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Calories', val: `${cal100}`, unit: 'kcal/100g', color: 'text-yellow-500' },
                  { label: 'Protéines', val: `${prot100}g`, unit: '/100g', color: 'text-blue-300' },
                  { label: 'Glucides', val: `${carbs100}g`, unit: '/100g', color: 'text-yellow-400' },
                  { label: 'Lipides', val: `${fat100}g`, unit: '/100g', color: 'text-orange-400' },
                ].map(m => (
                  <div key={m.label} className="bg-[var(--bg-input)] rounded-xl p-3 text-center border border-[var(--border-input)]">
                    <p className={`text-lg font-serif ${m.color}`}>{m.val}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <button onClick={saveRecipe} disabled={!newName || ingredients.length === 0 || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-medium">
            {saving ? 'Sauvegarde...' : 'Enregistrer la recette'}
          </button>
        </div>
      )}

      {/* LOG PORTION */}
      {logRecipe && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Ajouter au journal</p>
            <p className="text-lg font-serif text-[var(--text-primary)] mb-4">{logRecipe.name}</p>
            <p className="text-xs text-gray-500 mb-1">Quantité mangée (g)</p>
            <input type="number" value={logQty} onChange={e => setLogQty(e.target.value)} className={`${inp} mb-3`} />
            {logRecipe.foods && (
              <p className="text-2xl font-serif text-yellow-500 text-center mb-4">
                {Math.round(logRecipe.foods.calories_per_100g * (Number(logQty) || 0) / 100)} kcal
              </p>
            )}
            <p className="text-xs text-gray-500 mb-2">Type de repas</p>
            <div className="flex gap-2 mb-4 flex-wrap">
              {MEAL_TYPES.map(mt => (
                <button key={mt.key} onClick={() => setLogMealType(mt.key)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${logMealType === mt.key ? 'bg-blue-600/15 border-blue-500/30 text-blue-300' : 'border-[var(--border-input)] text-gray-400'}`}>
                  {mt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLogRecipe(null)} className="flex-1 py-3 rounded-xl border border-[var(--border-input)] text-gray-400 text-sm">Annuler</button>
              <button onClick={logPortion} disabled={logging}
                className="flex-2 flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
                {logging ? '...' : 'Ajouter au journal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LISTE DES RECETTES */}
      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : recipes.length === 0 && !creating ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500 mb-1">Aucune recette enregistrée.</p>
          <p className="text-xs text-gray-600">Créez une recette pour calculer ses valeurs nutritionnelles.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(r => {
            const isOpen = openRecipe === r.id
            return (
              <div key={r.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-input)] transition-colors"
                  onClick={() => {
                    setOpenRecipe(isOpen ? null : r.id)
                    if (!isOpen && !r.ingredients) loadIngredients(r.id)
                  }}>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{r.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.total_weight_g}g fini</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-serif text-yellow-500">{r.foods?.calories_per_100g} kcal/100g</span>
                    <span className="text-gray-500 text-sm">{isOpen ? '↑' : '↓'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                    {/* Macros */}
                    {r.foods && (
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {[
                          { label: 'Calories', val: `${r.foods.calories_per_100g}`, color: 'text-yellow-500' },
                          { label: 'Protéines', val: `${r.foods.protein_per_100g}g`, color: 'text-blue-300' },
                          { label: 'Glucides', val: `${r.foods.carbs_per_100g}g`, color: 'text-yellow-400' },
                          { label: 'Lipides', val: `${r.foods.fat_per_100g}g`, color: 'text-orange-400' },
                        ].map(m => (
                          <div key={m.label} className="text-center">
                            <p className={`text-sm font-medium ${m.color}`}>{m.val}</p>
                            <p className="text-xs text-gray-600">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Ingrédients */}
                    {r.ingredients && r.ingredients.length > 0 && (
                      <div className="mb-4 space-y-1">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Ingrédients</p>
                        {r.ingredients.map((ing, i) => (
                          <div key={i} className="flex justify-between text-sm py-1.5 border-b border-[var(--border)] last:border-none">
                            <span className="text-[var(--text-primary)]">{ing.name}</span>
                            <span className="text-gray-500">{ing.quantity_g}g · {Math.round(ing.calories_per_100g * ing.quantity_g / 100)} kcal</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { setLogRecipe(r); setLogQty('200') }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium">
                        Utiliser cette recette
                      </button>
                      <button onClick={() => deleteRecipe(r.id, r.food_id)}
                        className="px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-2.5 rounded-xl text-sm">
                        Suppr.
                      </button>
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
