import { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Modal, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useColors, type Colors } from '../../lib/theme'

type Food = { id: string; name: string; calories_per_100g: number }
type Ingredient = {
  id: string
  food_name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  quantity_g: number
}
type Recipe = {
  id: string
  name: string
  food_id: string
  calories_per_100g: number
  foods: { calories_per_100g: number } | null
}

const MEAL_TYPES = [
  { key: 'petit-dejeuner', label: 'Petit-déj.' },
  { key: 'dejeuner', label: 'Déjeuner' },
  { key: 'gouter', label: 'Goûter' },
  { key: 'diner', label: 'Dîner' },
]

export default function RecipesScreen() {
  const c = useColors()
  const s = makeStyles(c)

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [recipeName, setRecipeName] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [totalWeight, setTotalWeight] = useState('')
  const [saving, setSaving] = useState(false)

  // Ingredient addition
  const [ingName, setIngName] = useState('')
  const [ingCal, setIngCal] = useState('')
  const [ingProtein, setIngProtein] = useState('')
  const [ingCarbs, setIngCarbs] = useState('')
  const [ingFat, setIngFat] = useState('')
  const [ingQty, setIngQty] = useState('')
  const [foodSearch, setFoodSearch] = useState('')
  const [foodResults, setFoodResults] = useState<Food[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Log modal
  const [logRecipe, setLogRecipe] = useState<Recipe | null>(null)
  const [logQty, setLogQty] = useState('100')
  const [logType, setLogType] = useState('dejeuner')
  const [logging, setLogging] = useState(false)

  useEffect(() => { loadRecipes() }, [])

  async function loadRecipes() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('recipes')
      .select('id, name, food_id, foods(calories_per_100g)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    if (data) setRecipes(data as Recipe[])
    setLoading(false)
  }

  function openCreate() {
    setRecipeName('')
    setIngredients([])
    setTotalWeight('')
    setIngName(''); setIngCal(''); setIngProtein(''); setIngCarbs(''); setIngFat(''); setIngQty('')
    setFoodSearch(''); setFoodResults([])
    setShowCreate(true)
  }

  async function searchFoods(query: string) {
    setFoodSearch(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (query.length < 2) { setFoodResults([]); return }
    setSearchLoading(true)
    searchTimeout.current = setTimeout(async () => {
      const { data } = await supabase
        .from('foods')
        .select('id, name, calories_per_100g')
        .ilike('name', `%${query}%`)
        .limit(8)
      setFoodResults(data ?? [])
      setSearchLoading(false)
    }, 300)
  }

  function selectFood(food: Food) {
    setIngName(food.name)
    setIngCal(String(food.calories_per_100g))
    setFoodSearch('')
    setFoodResults([])
  }

  function addIngredient() {
    const qty = Number(ingQty)
    const cal = Number(ingCal)
    if (!ingName.trim() || !qty || !cal) {
      Alert.alert('Erreur', 'Nom, calories/100g et quantité sont requis.')
      return
    }
    setIngredients(prev => [...prev, {
      id: Date.now().toString(),
      food_name: ingName.trim(),
      calories_per_100g: cal,
      protein_per_100g: Number(ingProtein) || 0,
      carbs_per_100g: Number(ingCarbs) || 0,
      fat_per_100g: Number(ingFat) || 0,
      quantity_g: qty,
    }])
    setIngName(''); setIngCal(''); setIngProtein(''); setIngCarbs(''); setIngFat(''); setIngQty('')
  }

  function removeIngredient(id: string) {
    setIngredients(prev => prev.filter(i => i.id !== id))
  }

  function calcPer100() {
    if (!ingredients.length) return null
    const totalCal = ingredients.reduce((s, i) => s + i.calories_per_100g * i.quantity_g / 100, 0)
    const rawWeight = ingredients.reduce((s, i) => s + i.quantity_g, 0)
    const finished = Number(totalWeight) || rawWeight
    if (!finished) return null
    return {
      cal: Math.round(totalCal / finished * 100),
      prot: Math.round(ingredients.reduce((s, i) => s + i.protein_per_100g * i.quantity_g / 100, 0) / finished * 100),
      carbs: Math.round(ingredients.reduce((s, i) => s + i.carbs_per_100g * i.quantity_g / 100, 0) / finished * 100),
      fat: Math.round(ingredients.reduce((s, i) => s + i.fat_per_100g * i.quantity_g / 100, 0) / finished * 100),
    }
  }

  async function saveRecipe() {
    if (!recipeName.trim()) { Alert.alert('Erreur', 'Nom de la recette requis.'); return }
    if (!ingredients.length) { Alert.alert('Erreur', 'Ajoutez au moins un ingrédient.'); return }
    const per100 = calcPer100()
    if (!per100) { Alert.alert('Erreur', 'Impossible de calculer les valeurs nutritionnelles.'); return }

    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSaving(false); return }

    const rawWeight = ingredients.reduce((s, i) => s + i.quantity_g, 0)
    const finished = Number(totalWeight) || rawWeight

    // Insert into foods
    const { data: foodData, error: foodError } = await supabase
      .from('foods')
      .insert({
        name: recipeName.trim(),
        calories_per_100g: per100.cal,
        protein_per_100g: per100.prot,
        carbs_per_100g: per100.carbs,
        fat_per_100g: per100.fat,
        user_id: session.user.id,
      })
      .select('id')
      .single()

    if (foodError || !foodData) {
      Alert.alert('Erreur', foodError?.message ?? 'Erreur lors de la sauvegarde.')
      setSaving(false); return
    }

    // Insert into recipes
    const { data: recipeData, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        name: recipeName.trim(),
        food_id: foodData.id,
        user_id: session.user.id,
        total_weight_g: finished,
      })
      .select('id')
      .single()

    if (recipeError || !recipeData) {
      Alert.alert('Erreur', recipeError?.message ?? 'Erreur lors de la sauvegarde.')
      setSaving(false); return
    }

    // Insert ingredients
    await supabase.from('recipe_ingredients').insert(
      ingredients.map(i => ({
        recipe_id: recipeData.id,
        food_name: i.food_name,
        calories_per_100g: i.calories_per_100g,
        protein_per_100g: i.protein_per_100g,
        carbs_per_100g: i.carbs_per_100g,
        fat_per_100g: i.fat_per_100g,
        quantity_g: i.quantity_g,
      }))
    )

    setSaving(false)
    setShowCreate(false)
    loadRecipes()
  }

  async function deleteRecipe(recipe: Recipe) {
    Alert.alert('Supprimer', `Supprimer "${recipe.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          await supabase.from('recipes').delete().eq('id', recipe.id)
          await supabase.from('foods').delete().eq('id', recipe.food_id)
          setRecipes(prev => prev.filter(r => r.id !== recipe.id))
        }
      }
    ])
  }

  async function logPortion() {
    if (!logRecipe) return
    const qty = Number(logQty)
    if (!qty) { Alert.alert('Erreur', 'Quantité invalide.'); return }
    const cal100 = logRecipe.foods?.calories_per_100g ?? 0
    const calories = Math.round(cal100 * qty / 100)

    setLogging(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLogging(false); return }

    const { error } = await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: logRecipe.name,
      calories,
      quantity_g: qty,
      meal_type: logType,
      eaten_at: new Date().toISOString(),
    })

    if (error) Alert.alert('Erreur', error.message)
    else Alert.alert('Ajouté !', `${logRecipe.name} — ${calories} kcal enregistré.`)
    setLogging(false)
    setLogRecipe(null)
  }

  const per100Preview = calcPer100()

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.headerRow}>
          <Text style={s.heading}>Recettes</Text>
          <TouchableOpacity style={s.addBtn} onPress={openCreate}>
            <Text style={s.addBtnText}>+ Nouvelle</Text>
          </TouchableOpacity>
        </View>

        {loading
          ? <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
          : recipes.length === 0
            ? <Text style={s.empty}>Aucune recette. Créez-en une !</Text>
            : recipes.map(r => (
              <TouchableOpacity key={r.id} style={s.card}
                onPress={() => { setLogRecipe(r); setLogQty('100'); setLogType('dejeuner') }}
                onLongPress={() => deleteRecipe(r)}
              >
                <View style={s.cardLeft}>
                  <Text style={s.cardName}>{r.name}</Text>
                  <Text style={s.cardMeta}>{r.foods?.calories_per_100g ?? '—'} kcal / 100g</Text>
                </View>
                <Text style={s.cardArrow}>›</Text>
              </TouchableOpacity>
            ))
        }
        {recipes.length > 0 && (
          <Text style={s.hint}>Appui long pour supprimer · Appui pour logger</Text>
        )}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>Nouvelle recette</Text>

              <Text style={s.label}>Nom du plat</Text>
              <TextInput style={s.input} value={recipeName} onChangeText={setRecipeName}
                placeholder="Ex : Pâtes carbonara" placeholderTextColor={c.placeholder} />

              <Text style={s.sectionLabel}>INGRÉDIENTS</Text>

              {/* Search existing food */}
              <TextInput style={s.input} value={foodSearch} onChangeText={searchFoods}
                placeholder="Rechercher un aliment…" placeholderTextColor={c.placeholder} />
              {searchLoading && <ActivityIndicator color={c.accent} style={{ marginBottom: 8 }} />}
              {foodResults.map(f => (
                <TouchableOpacity key={f.id} style={s.searchRow} onPress={() => selectFood(f)}>
                  <Text style={s.searchName}>{f.name}</Text>
                  <Text style={s.searchCal}>{f.calories_per_100g} kcal/100g</Text>
                </TouchableOpacity>
              ))}

              {/* Manual entry */}
              <View style={s.ingRow}>
                <TextInput style={[s.input, { flex: 2, marginRight: 6 }]} value={ingName}
                  onChangeText={setIngName} placeholder="Aliment" placeholderTextColor={c.placeholder} />
                <TextInput style={[s.input, { flex: 1 }]} value={ingCal}
                  onChangeText={setIngCal} placeholder="kcal/100g" keyboardType="numeric" placeholderTextColor={c.placeholder} />
              </View>
              <View style={s.ingRow}>
                <TextInput style={[s.input, { flex: 1, marginRight: 6 }]} value={ingProtein}
                  onChangeText={setIngProtein} placeholder="Prot" keyboardType="numeric" placeholderTextColor={c.placeholder} />
                <TextInput style={[s.input, { flex: 1, marginRight: 6 }]} value={ingCarbs}
                  onChangeText={setIngCarbs} placeholder="Gluc" keyboardType="numeric" placeholderTextColor={c.placeholder} />
                <TextInput style={[s.input, { flex: 1 }]} value={ingFat}
                  onChangeText={setIngFat} placeholder="Lip" keyboardType="numeric" placeholderTextColor={c.placeholder} />
              </View>
              <View style={s.ingRow}>
                <TextInput style={[s.input, { flex: 1, marginRight: 6 }]} value={ingQty}
                  onChangeText={setIngQty} placeholder="Quantité (g)" keyboardType="numeric" placeholderTextColor={c.placeholder} />
                <TouchableOpacity style={s.ingAddBtn} onPress={addIngredient}>
                  <Text style={s.ingAddText}>Ajouter</Text>
                </TouchableOpacity>
              </View>

              {ingredients.length > 0 && (
                <View style={s.ingList}>
                  {ingredients.map(i => (
                    <View key={i.id} style={s.ingItem}>
                      <Text style={s.ingItemName}>{i.food_name}</Text>
                      <Text style={s.ingItemMeta}>{i.quantity_g}g · {Math.round(i.calories_per_100g * i.quantity_g / 100)} kcal</Text>
                      <TouchableOpacity onPress={() => removeIngredient(i.id)}>
                        <Text style={s.ingRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={s.label}>Poids final (g, optionnel)</Text>
              <TextInput style={s.input} value={totalWeight} onChangeText={setTotalWeight}
                placeholder={`Défaut : ${ingredients.reduce((s, i) => s + i.quantity_g, 0)}g (brut)`}
                keyboardType="numeric" placeholderTextColor={c.placeholder} />

              {per100Preview && (
                <View style={s.previewCard}>
                  <Text style={s.previewTitle}>Pour 100g</Text>
                  <Text style={s.previewCal}>{per100Preview.cal} kcal</Text>
                  <Text style={s.previewMacros}>
                    P {per100Preview.prot}g · G {per100Preview.carbs}g · L {per100Preview.fat}g
                  </Text>
                </View>
              )}

              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={s.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={saveRecipe} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Log portion modal */}
      <Modal visible={!!logRecipe} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <Text style={s.modalTitle}>{logRecipe?.name}</Text>
            <Text style={s.cardMeta}>{logRecipe?.foods?.calories_per_100g ?? '—'} kcal / 100g</Text>

            <Text style={s.label}>Quantité (g)</Text>
            <TextInput style={s.input} value={logQty} onChangeText={setLogQty}
              keyboardType="numeric" placeholderTextColor={c.placeholder} />

            {logRecipe && Number(logQty) > 0 && (
              <Text style={s.calPreview}>
                {Math.round((logRecipe.foods?.calories_per_100g ?? 0) * Number(logQty) / 100)} kcal
              </Text>
            )}

            <Text style={s.label}>Type de repas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {MEAL_TYPES.map(mt => (
                <TouchableOpacity key={mt.key}
                  style={[s.chip, logType === mt.key && s.chipActive]}
                  onPress={() => setLogType(mt.key)}>
                  <Text style={[s.chipText, logType === mt.key && s.chipTextActive]}>{mt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setLogRecipe(null)}>
                <Text style={s.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={logPortion} disabled={logging}>
                {logging ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>Logger</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    heading: { color: c.text, fontSize: 22, fontWeight: '700' },
    addBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
    addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
    card: {
      backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 8,
      borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center',
    },
    cardLeft: { flex: 1 },
    cardName: { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
    cardMeta: { color: c.textDim, fontSize: 12, marginBottom: 4 },
    cardArrow: { color: c.textDim, fontSize: 20 },
    hint: { color: c.textDim, fontSize: 11, textAlign: 'center', marginTop: 8 },
    // Sheet
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40, maxHeight: '90%',
      borderWidth: 1, borderColor: c.border,
    },
    modalTitle: { color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
    label: { color: c.textSub, fontSize: 12, marginBottom: 6 },
    sectionLabel: { color: c.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
    input: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.borderAlt,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.text, fontSize: 14, marginBottom: 10,
    },
    ingRow: { flexDirection: 'row', alignItems: 'center' },
    ingAddBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
    ingAddText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    ingList: { marginBottom: 12 },
    ingItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.cardAlt, borderRadius: 10, padding: 10, marginBottom: 6 },
    ingItemName: { flex: 1, color: c.text, fontSize: 13 },
    ingItemMeta: { color: c.textDim, fontSize: 12, marginRight: 8 },
    ingRemove: { color: '#f87171', fontSize: 14 },
    searchRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: c.cardAlt, borderRadius: 8, marginBottom: 4 },
    searchName: { color: c.text, fontSize: 13 },
    searchCal: { color: c.textDim, fontSize: 12 },
    previewCard: { backgroundColor: c.cardAlt, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: c.border },
    previewTitle: { color: c.textDim, fontSize: 12, marginBottom: 4 },
    previewCal: { color: '#fbbf24', fontSize: 28, fontWeight: '700' },
    previewMacros: { color: c.textSub, fontSize: 13, marginTop: 4 },
    calPreview: { color: '#fbbf24', fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.borderAlt },
    chipActive: { backgroundColor: c.accentLight, borderColor: c.accentBorder },
    chipText: { color: c.textDim, fontSize: 13 },
    chipTextActive: { color: c.accentText },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.borderAlt },
    cancelText: { color: c.textSub, fontSize: 14 },
    saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: c.accent },
    saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  })
}
