'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type PlanItem = {
  id: string
  food_name: string
  quantity_g: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal_type: string
}

type Plan = {
  id: string
  name: string
  created_at: string
  items: PlanItem[]
}

const mealTypeLabel: Record<string, string> = {
  'petit-dejeuner': 'Petit-déjeuner',
  'dejeuner': 'Déjeuner',
  'gouter': 'Goûter',
  'diner': 'Dîner',
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [openPlan, setOpenPlan] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [applySuccess, setApplySuccess] = useState('')

  // Create plan
  const [creating, setCreating] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [newItems, setNewItems] = useState<Omit<PlanItem, 'id'>[]>([])
  const [saving, setSaving] = useState(false)

  // New item form
  const [itemName, setItemName] = useState('')
  const [itemCal, setItemCal] = useState('')
  const [itemQty, setItemQty] = useState(100)
  const [itemProtein, setItemProtein] = useState('')
  const [itemCarbs, setItemCarbs] = useState('')
  const [itemFat, setItemFat] = useState('')
  const [itemMealType, setItemMealType] = useState('dejeuner')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: plansData } = await supabase
      .from('meal_plans')
      .select('id, name, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (!plansData) { setLoading(false); return }

    const withItems = await Promise.all(plansData.map(async plan => {
      const { data: items } = await supabase
        .from('meal_plan_items')
        .select('*')
        .eq('plan_id', plan.id)
      return { ...plan, items: items ?? [] }
    }))

    setPlans(withItems)
    setLoading(false)
  }

  function addItem() {
    if (!itemName || !itemCal) return
    const cal = Math.round(parseFloat(itemCal) * itemQty / 100)
    setNewItems(prev => [...prev, {
      food_name: itemName,
      quantity_g: itemQty,
      calories: cal,
      protein_g: parseFloat(itemProtein) || 0,
      carbs_g: parseFloat(itemCarbs) || 0,
      fat_g: parseFloat(itemFat) || 0,
      meal_type: itemMealType,
    }])
    setItemName('')
    setItemCal('')
    setItemQty(100)
    setItemProtein('')
    setItemCarbs('')
    setItemFat('')
  }

  async function savePlan() {
    if (!newPlanName || newItems.length === 0) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: plan } = await supabase
      .from('meal_plans')
      .insert({ user_id: session.user.id, name: newPlanName })
      .select()
      .single()

    if (plan) {
      await supabase.from('meal_plan_items').insert(
        newItems.map(item => ({ ...item, plan_id: plan.id }))
      )
    }

    setCreating(false)
    setNewPlanName('')
    setNewItems([])
    setSaving(false)
    await load()
  }

  async function applyPlan(plan: Plan) {
    setApplying(plan.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const inserts = plan.items.map(item => ({
      user_id: session.user.id,
      food_name: item.food_name,
      quantity_g: item.quantity_g,
      calories: item.calories,
      meal_type: item.meal_type,
      eaten_at: new Date().toISOString(),
    }))

    await supabase.from('meals').insert(inserts)
    setApplying(null)
    const totalCal = plan.items.reduce((s, i) => s + i.calories, 0)
    setApplySuccess(`Plan "${plan.name}" appliqué — ${totalCal} kcal ajoutées`)
    setTimeout(() => setApplySuccess(''), 4000)
  }

  async function deletePlan(id: string) {
    setDeleting(id)
    await supabase.from('meal_plans').delete().eq('id', id)
    setPlans(p => p.filter(x => x.id !== id))
    setDeleting(null)
  }

  const inputClass = "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-blue-500/50"
  const inputSm = "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm outline-none"

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Repas</p>
          <h1 className="text-2xl font-serif text-[var(--text-primary)] mt-1">Plans de repas</h1>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
            + Nouveau plan
          </button>
        )}
      </div>

      {applySuccess && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-400">
          ✓ {applySuccess}
        </div>
      )}

      {/* CRÉER UN PLAN */}
      {creating && (
        <div className="bg-[var(--bg-card)] border border-blue-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Nouveau plan</p>
            <button onClick={() => { setCreating(false); setNewPlanName(''); setNewItems([]) }}
              className="text-xs text-gray-500 hover:text-gray-300">Annuler</button>
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Nom du plan</label>
            <input placeholder="Ex : Journée type prise de masse" value={newPlanName}
              onChange={e => setNewPlanName(e.target.value)} className={inputClass}/>
          </div>

          {/* Liste des items */}
          {newItems.length > 0 && (
            <div className="mb-4 space-y-2">
              {newItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl">
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{item.food_name}</p>
                    <p className="text-xs text-gray-500">{mealTypeLabel[item.meal_type] ?? item.meal_type} · {item.quantity_g}g</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-yellow-500">{item.calories} kcal</span>
                    <button onClick={() => setNewItems(prev => prev.filter((_, j) => j !== i))}
                      className="text-xs text-red-400 hover:text-red-300">✕</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-xs text-gray-500 px-1">
                <span>{newItems.length} aliment{newItems.length > 1 ? 's' : ''}</span>
                <span className="text-yellow-500">{newItems.reduce((s, i) => s + i.calories, 0)} kcal total</span>
              </div>
            </div>
          )}

          {/* Formulaire ajout item */}
          <div className="border border-[var(--border-input)] rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Ajouter un aliment</p>
            <div className="space-y-2">
              <input placeholder="Nom de l'aliment" value={itemName} onChange={e => setItemName(e.target.value)} className={inputSm}/>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Calories / 100g" value={itemCal} onChange={e => setItemCal(e.target.value)} className={inputSm}/>
                <input type="number" placeholder="Quantité (g)" value={itemQty} onChange={e => setItemQty(Number(e.target.value))} className={inputSm}/>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" placeholder="Prot. (g)" value={itemProtein} onChange={e => setItemProtein(e.target.value)} className={inputSm}/>
                <input type="number" placeholder="Gluc. (g)" value={itemCarbs} onChange={e => setItemCarbs(e.target.value)} className={inputSm}/>
                <input type="number" placeholder="Lip. (g)" value={itemFat} onChange={e => setItemFat(e.target.value)} className={inputSm}/>
              </div>
              <select value={itemMealType} onChange={e => setItemMealType(e.target.value)} className={inputSm}>
                <option value="petit-dejeuner">Petit-déjeuner</option>
                <option value="dejeuner">Déjeuner</option>
                <option value="gouter">Goûter</option>
                <option value="diner">Dîner</option>
              </select>
              {itemName && itemCal && (
                <p className="text-xs text-yellow-500 text-right">= {Math.round(parseFloat(itemCal) * itemQty / 100)} kcal</p>
              )}
              <button onClick={addItem} disabled={!itemName || !itemCal}
                className="w-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-input)] border border-[var(--border-input)] text-[var(--text-primary)] py-2 rounded-lg text-sm disabled:opacity-50">
                + Ajouter à la liste
              </button>
            </div>
          </div>

          <button onClick={savePlan} disabled={!newPlanName || newItems.length === 0 || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium">
            {saving ? 'Sauvegarde...' : 'Sauvegarder le plan'}
          </button>
        </div>
      )}

      {/* LISTE DES PLANS */}
      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : plans.length === 0 && !creating ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500 mb-2">Aucun plan enregistré.</p>
          <p className="text-xs text-gray-600">Créez un plan pour reproduire une journée type en un clic.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const totalCal = plan.items.reduce((s, i) => s + i.calories, 0)
            const isOpen = openPlan === plan.id
            return (
              <div key={plan.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-input)] transition-colors"
                  onClick={() => setOpenPlan(isOpen ? null : plan.id)}>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{plan.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{plan.items.length} aliment{plan.items.length > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-serif text-yellow-500">{totalCal.toLocaleString()} kcal</span>
                    <span className="text-gray-500 text-sm">{isOpen ? '↑' : '↓'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
                    <div className="space-y-2 mb-4">
                      {plan.items.map(item => (
                        <div key={item.id} className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-none">
                          <div>
                            <p className="text-sm text-[var(--text-primary)]">{item.food_name}</p>
                            <p className="text-xs text-gray-500">{mealTypeLabel[item.meal_type] ?? item.meal_type} · {item.quantity_g}g</p>
                          </div>
                          <span className="text-sm text-yellow-500">{item.calories} kcal</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => applyPlan(plan)} disabled={applying === plan.id}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium">
                        {applying === plan.id ? 'Application...' : 'Appliquer à aujourd\'hui'}
                      </button>
                      <button onClick={() => deletePlan(plan.id)} disabled={deleting === plan.id}
                        className="px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-2.5 rounded-xl text-sm disabled:opacity-50">
                        {deleting === plan.id ? '...' : 'Suppr.'}
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
