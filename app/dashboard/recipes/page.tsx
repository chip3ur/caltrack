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
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
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
      .select('ingredient_name, quantity_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
      .eq('recipe_id', recipeId)
    const normalized = (data ?? []).map((i: any) => ({ ...i, name: i.ingredient_name }))
    setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, ingredients: normalized } : r))
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

  const [seeding, setSeeding] = useState(false)

  async function seedRecipes() {
    setSeeding(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSeeding(false); return }

    const defaults = [
      {
        name: 'Pâtes carbonara',
        total_weight_g: 700,
        ingredients: [
          { name: 'Pâtes (sèches)', quantity_g: 350, calories_per_100g: 358, protein_per_100g: 12, carbs_per_100g: 71, fat_per_100g: 1.5 },
          { name: 'Lardons', quantity_g: 150, calories_per_100g: 337, protein_per_100g: 17, carbs_per_100g: 1, fat_per_100g: 30 },
          { name: 'Œufs', quantity_g: 120, calories_per_100g: 143, protein_per_100g: 13, carbs_per_100g: 1, fat_per_100g: 10 },
          { name: 'Parmesan', quantity_g: 50, calories_per_100g: 420, protein_per_100g: 36, carbs_per_100g: 0, fat_per_100g: 30 },
          { name: 'Crème fraîche', quantity_g: 100, calories_per_100g: 292, protein_per_100g: 2, carbs_per_100g: 3, fat_per_100g: 30 },
        ],
      },
      {
        name: 'Poulet rôti',
        total_weight_g: 1100,
        ingredients: [
          { name: 'Poulet entier', quantity_g: 1500, calories_per_100g: 167, protein_per_100g: 20, carbs_per_100g: 0, fat_per_100g: 9 },
          { name: 'Huile d\'olive', quantity_g: 30, calories_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100 },
        ],
      },
      {
        name: 'Omelette au fromage',
        total_weight_g: 300,
        ingredients: [
          { name: 'Œufs', quantity_g: 300, calories_per_100g: 143, protein_per_100g: 13, carbs_per_100g: 1, fat_per_100g: 10 },
          { name: 'Emmental râpé', quantity_g: 60, calories_per_100g: 385, protein_per_100g: 29, carbs_per_100g: 1, fat_per_100g: 30 },
          { name: 'Beurre', quantity_g: 15, calories_per_100g: 717, protein_per_100g: 1, carbs_per_100g: 0, fat_per_100g: 80 },
        ],
      },
      {
        name: 'Quiche lorraine',
        total_weight_g: 700,
        ingredients: [
          { name: 'Pâte brisée', quantity_g: 200, calories_per_100g: 400, protein_per_100g: 6, carbs_per_100g: 50, fat_per_100g: 20 },
          { name: 'Lardons', quantity_g: 150, calories_per_100g: 337, protein_per_100g: 17, carbs_per_100g: 1, fat_per_100g: 30 },
          { name: 'Crème fraîche', quantity_g: 200, calories_per_100g: 292, protein_per_100g: 2, carbs_per_100g: 3, fat_per_100g: 30 },
          { name: 'Œufs', quantity_g: 150, calories_per_100g: 143, protein_per_100g: 13, carbs_per_100g: 1, fat_per_100g: 10 },
          { name: 'Emmental râpé', quantity_g: 80, calories_per_100g: 385, protein_per_100g: 29, carbs_per_100g: 1, fat_per_100g: 30 },
        ],
      },
      {
        name: 'Riz au lait',
        total_weight_g: 1000,
        ingredients: [
          { name: 'Riz rond', quantity_g: 200, calories_per_100g: 358, protein_per_100g: 7, carbs_per_100g: 78, fat_per_100g: 0.5 },
          { name: 'Lait entier', quantity_g: 800, calories_per_100g: 61, protein_per_100g: 3.2, carbs_per_100g: 4.7, fat_per_100g: 3.2 },
          { name: 'Sucre', quantity_g: 80, calories_per_100g: 400, protein_per_100g: 0, carbs_per_100g: 100, fat_per_100g: 0 },
        ],
      },
      {
        name: 'Salade niçoise',
        total_weight_g: 500,
        ingredients: [
          { name: 'Thon en boîte', quantity_g: 160, calories_per_100g: 116, protein_per_100g: 25, carbs_per_100g: 0, fat_per_100g: 2 },
          { name: 'Œufs durs', quantity_g: 120, calories_per_100g: 143, protein_per_100g: 13, carbs_per_100g: 1, fat_per_100g: 10 },
          { name: 'Haricots verts cuits', quantity_g: 100, calories_per_100g: 28, protein_per_100g: 2, carbs_per_100g: 4, fat_per_100g: 0.2 },
          { name: 'Tomates', quantity_g: 120, calories_per_100g: 18, protein_per_100g: 0.9, carbs_per_100g: 3.5, fat_per_100g: 0.2 },
          { name: 'Huile d\'olive', quantity_g: 20, calories_per_100g: 884, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 100 },
        ],
      },
    ]

    for (const r of defaults) {
      const totalCal = r.ingredients.reduce((s, i) => s + i.calories_per_100g * i.quantity_g / 100, 0)
      const totalProt = r.ingredients.reduce((s, i) => s + i.protein_per_100g * i.quantity_g / 100, 0)
      const totalCarbs = r.ingredients.reduce((s, i) => s + i.carbs_per_100g * i.quantity_g / 100, 0)
      const totalFat = r.ingredients.reduce((s, i) => s + i.fat_per_100g * i.quantity_g / 100, 0)
      const w = r.total_weight_g
      const cal100 = Math.round(totalCal / w * 100)
      const prot100 = Math.round(totalProt / w * 100 * 10) / 10
      const carbs100 = Math.round(totalCarbs / w * 100 * 10) / 10
      const fat100 = Math.round(totalFat / w * 100 * 10) / 10

      const { data: food } = await supabase.from('foods').insert({
        name: r.name, calories_per_100g: cal100,
        protein_per_100g: prot100, carbs_per_100g: carbs100, fat_per_100g: fat100,
      }).select('id').single()
      if (!food) continue

      const { data: recipe } = await supabase.from('recipes').insert({
        user_id: session.user.id, name: r.name,
        total_weight_g: r.total_weight_g, food_id: food.id,
      }).select('id').single()
      if (!recipe) continue

      await supabase.from('recipe_ingredients').insert(
        r.ingredients.map(i => ({
          recipe_id: recipe.id, ingredient_name: i.name, quantity_g: i.quantity_g,
          calories_per_100g: i.calories_per_100g, protein_per_100g: i.protein_per_100g,
          carbs_per_100g: i.carbs_per_100g, fat_per_100g: i.fat_per_100g,
        }))
      )
    }

    setSeeding(false)
    await load()
  }

  async function deleteRecipe(id: string, foodId: string) {
    await supabase.from('recipes').delete().eq('id', id)
    await supabase.from('foods').delete().eq('id', foodId)
    setRecipes(prev => prev.filter(r => r.id !== id))
  }

  async function openEdit(r: Recipe) {
    // ensure ingredients are loaded
    let ings = r.ingredients
    if (!ings) {
      const { data } = await supabase
        .from('recipe_ingredients')
        .select('ingredient_name, quantity_g, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
        .eq('recipe_id', r.id)
      ings = (data ?? []).map((i: any) => ({ ...i, name: i.ingredient_name }))
      setRecipes(prev => prev.map(x => x.id === r.id ? { ...x, ingredients: ings } : x))
    }
    setNewName(r.name)
    setTotalWeight(String(r.total_weight_g))
    setIngredients(ings ?? [])
    setEditingRecipe(r)
    setCreating(false)
  }

  async function saveEdit() {
    if (!editingRecipe || !newName || ingredients.length === 0) return
    setSaving(true)
    const w = Number(totalWeight) || rawWeight
    const { error } = await supabase.from('foods').update({
      name: newName.trim(),
      calories_per_100g: cal100,
      protein_per_100g: prot100,
      carbs_per_100g: carbs100,
      fat_per_100g: fat100,
    }).eq('id', editingRecipe.food_id)
    if (error) { setSaving(false); return }

    await supabase.from('recipes').update({
      name: newName.trim(),
      total_weight_g: w,
    }).eq('id', editingRecipe.id)

    await supabase.from('recipe_ingredients').delete().eq('recipe_id', editingRecipe.id)
    await supabase.from('recipe_ingredients').insert(
      ingredients.map(i => ({
        recipe_id: editingRecipe.id,
        ingredient_name: i.name,
        quantity_g: i.quantity_g,
        calories_per_100g: i.calories_per_100g,
        protein_per_100g: i.protein_per_100g,
        carbs_per_100g: i.carbs_per_100g,
        fat_per_100g: i.fat_per_100g,
      }))
    )

    setEditingRecipe(null)
    setNewName(''); setTotalWeight(''); setIngredients([])
    setSaving(false)
    await load()
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
        {!creating && !editingRecipe && (
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

      {/* CRÉER / MODIFIER UNE RECETTE */}
      {(creating || editingRecipe) && (
        <div className="bg-[var(--bg-card)] border border-blue-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              {editingRecipe ? `Modifier — ${editingRecipe.name}` : 'Nouvelle recette'}
            </p>
            <button onClick={() => { setCreating(false); setEditingRecipe(null); setIngredients([]); setNewName(''); setTotalWeight('') }}
              className="text-xs text-gray-500 hover:text-gray-300">Annuler</button>
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Nom du plat</label>
            <input placeholder="Ex : Pâtes carbonara" value={newName} onChange={e => setNewName(e.target.value)} className={inp} />
          </div>

          {/* Ingrédients ajoutés */}
          {ingredients.length > 0 && (
            <div className="mb-4 space-y-1.5">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg">
                  <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{ing.name}</span>
                  <input
                    type="number"
                    value={ing.quantity_g}
                    onChange={e => setIngredients(prev => prev.map((x, j) => j === i ? { ...x, quantity_g: Number(e.target.value) || 0 } : x))}
                    className="w-20 border border-[var(--border-input)] focus:border-blue-500/60 bg-[var(--bg-card)] rounded-lg px-2 py-1 text-sm font-medium text-[var(--text-primary)] text-right outline-none"
                  />
                  <span className="text-xs text-gray-500">g</span>
                  <span className="text-xs text-yellow-500 w-14 text-right">{Math.round(ing.calories_per_100g * ing.quantity_g / 100)} kcal</span>
                  <button onClick={() => setIngredients(prev => prev.filter((_, j) => j !== i))} className="text-xs text-red-400 ml-1">✕</button>
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

          <div className="flex gap-2">
            {editingRecipe && (
              <button
                onClick={() => { setEditingRecipe(null); setNewName(''); setTotalWeight(''); setIngredients([]) }}
                className="flex-1 border border-[var(--border-input)] text-[var(--text-primary)] py-3 rounded-xl text-sm hover:bg-[var(--bg-input)]">
                Annuler
              </button>
            )}
            <button onClick={editingRecipe ? saveEdit : saveRecipe}
              disabled={!newName || ingredients.length === 0 || saving}
              className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-medium">
              {saving ? 'Sauvegarde...' : editingRecipe ? 'Enregistrer les modifications' : 'Enregistrer la recette'}
            </button>
          </div>
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
          <p className="text-xs text-gray-600 mb-4">Créez une recette ou importez des recettes de base.</p>
          <button onClick={seedRecipes} disabled={seeding}
            className="bg-[var(--bg-input)] hover:bg-[var(--bg-secondary)] border border-[var(--border-input)] text-[var(--text-primary)] px-4 py-2 rounded-xl text-sm disabled:opacity-50">
            {seeding ? 'Import en cours...' : '↓ Importer des recettes de base'}
          </button>
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
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Ingrédients</p>
                        <div className="rounded-xl overflow-hidden border border-[var(--border)]">
                          <div className="grid grid-cols-5 gap-2 px-3 py-1.5 bg-[var(--bg-input)] text-xs text-gray-500">
                            <span className="col-span-2">Aliment</span>
                            <span className="text-right">Qté</span>
                            <span className="text-right">kcal</span>
                            <span className="text-right">P/G/L</span>
                          </div>
                          {r.ingredients.map((ing, i) => (
                            <div key={i} className="grid grid-cols-5 gap-2 px-3 py-2 text-sm border-t border-[var(--border)]">
                              <span className="col-span-2 text-[var(--text-primary)] truncate">{ing.name}</span>
                              <span className="text-right text-gray-500">{ing.quantity_g}g</span>
                              <span className="text-right text-yellow-500">{Math.round(ing.calories_per_100g * ing.quantity_g / 100)}</span>
                              <span className="text-right text-gray-500 text-xs">
                                {Math.round(ing.protein_per_100g * ing.quantity_g / 100)}·{Math.round(ing.carbs_per_100g * ing.quantity_g / 100)}·{Math.round(ing.fat_per_100g * ing.quantity_g / 100)}
                              </span>
                            </div>
                          ))}
                          <div className="grid grid-cols-5 gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-input)] text-xs font-medium">
                            <span className="col-span-2 text-gray-400">Total</span>
                            <span className="text-right text-gray-400">{r.ingredients.reduce((s, i) => s + i.quantity_g, 0)}g</span>
                            <span className="text-right text-yellow-500">{Math.round(r.ingredients.reduce((s, i) => s + i.calories_per_100g * i.quantity_g / 100, 0))}</span>
                            <span className="text-right text-gray-400">
                              {Math.round(r.ingredients.reduce((s, i) => s + i.protein_per_100g * i.quantity_g / 100, 0))}·{Math.round(r.ingredients.reduce((s, i) => s + i.carbs_per_100g * i.quantity_g / 100, 0))}·{Math.round(r.ingredients.reduce((s, i) => s + i.fat_per_100g * i.quantity_g / 100, 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { setLogRecipe(r); setLogQty('200') }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium">
                        Utiliser
                      </button>
                      <button onClick={() => openEdit(r)}
                        className="px-4 bg-[var(--bg-input)] hover:bg-[var(--bg-secondary)] border border-[var(--border-input)] text-[var(--text-primary)] py-2.5 rounded-xl text-sm">
                        Modifier
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
