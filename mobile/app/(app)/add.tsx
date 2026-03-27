import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useColors, type Colors } from '../../lib/theme'

type Food = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

const MEAL_TYPES = [
  { key: 'petit-dejeuner', label: 'Petit-déjeuner' },
  { key: 'dejeuner', label: 'Déjeuner' },
  { key: 'gouter', label: 'Goûter' },
  { key: 'diner', label: 'Dîner' },
]

type Tab = 'search' | 'manual'

export default function AddScreen() {
  const c = useColors()
  const [tab, setTab] = useState<Tab>('search')
  const [mealType, setMealType] = useState('dejeuner')
  const [quantity, setQuantity] = useState('100')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Food | null>(null)
  const [manName, setManName] = useState('')
  const [manCal, setManCal] = useState('')
  const [manProt, setManProt] = useState('')
  const [manCarbs, setManCarbs] = useState('')
  const [manFat, setManFat] = useState('')
  const [saving, setSaving] = useState(false)

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    setSelected(null)
    const { data } = await supabase
      .from('foods')
      .select('id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
      .ilike('name', `%${query}%`)
      .limit(20)
    setResults(data ?? [])
    setSearching(false)
  }

  async function addFromSearch() {
    if (!selected) return
    const qty = Number(quantity) || 100
    const cal = Math.round(selected.calories_per_100g * qty / 100)
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { error } = await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: selected.name,
      food_id: selected.id,
      quantity_g: qty,
      calories: cal,
      meal_type: mealType,
      eaten_at: new Date().toISOString(),
    })
    if (error) Alert.alert('Erreur', error.message)
    else {
      Alert.alert('Ajouté !', `${selected.name} — ${cal} kcal`)
      setSelected(null); setQuery(''); setResults([]); setQuantity('100')
    }
    setSaving(false)
  }

  async function addManual() {
    if (!manName || !manCal) { Alert.alert('Champs requis', 'Le nom et les calories sont obligatoires.'); return }
    const qty = Number(quantity) || 100
    const cal100 = Number(manCal)
    const cal = Math.round(cal100 * qty / 100)
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: food } = await supabase.from('foods').insert({
      name: manName.trim(),
      calories_per_100g: cal100,
      protein_per_100g: Number(manProt) || 0,
      carbs_per_100g: Number(manCarbs) || 0,
      fat_per_100g: Number(manFat) || 0,
    }).select('id').single()
    const { error } = await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: manName.trim(),
      food_id: food?.id ?? null,
      quantity_g: qty,
      calories: cal,
      meal_type: mealType,
      eaten_at: new Date().toISOString(),
    })
    if (error) Alert.alert('Erreur', error.message)
    else {
      Alert.alert('Ajouté !', `${manName} — ${cal} kcal`)
      setManName(''); setManCal(''); setManProt(''); setManCarbs(''); setManFat(''); setQuantity('100')
    }
    setSaving(false)
  }

  const previewCal = selected ? Math.round(selected.calories_per_100g * (Number(quantity) || 100) / 100) : 0
  const s = makeStyles(c)

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.heading}>Ajouter un repas</Text>

          <Text style={s.label}>Type de repas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mealTypeScroll}>
            {MEAL_TYPES.map(mt => (
              <TouchableOpacity key={mt.key}
                style={[s.mealTypeChip, mealType === mt.key && s.mealTypeActive]}
                onPress={() => setMealType(mt.key)}>
                <Text style={[s.mealTypeText, mealType === mt.key && s.mealTypeTextActive]}>{mt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.tabs}>
            <TouchableOpacity style={[s.tab, tab === 'search' && s.tabActive]} onPress={() => setTab('search')}>
              <Text style={[s.tabText, tab === 'search' && s.tabTextActive]}>Recherche</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tab, tab === 'manual' && s.tabActive]} onPress={() => setTab('manual')}>
              <Text style={[s.tabText, tab === 'manual' && s.tabTextActive]}>Manuel</Text>
            </TouchableOpacity>
          </View>

          {tab === 'search' && (
            <>
              <View style={s.searchRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Rechercher un aliment..."
                  placeholderTextColor={c.placeholder}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={search}
                  returnKeyType="search"
                />
                <TouchableOpacity style={s.searchBtn} onPress={search} disabled={searching}>
                  {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.searchBtnText}>→</Text>}
                </TouchableOpacity>
              </View>

              {results.length > 0 && !selected && (
                <View style={s.resultsList}>
                  {results.map(f => (
                    <TouchableOpacity key={f.id} style={s.resultRow} onPress={() => { setSelected(f); setResults([]) }}>
                      <Text style={s.resultName}>{f.name}</Text>
                      <Text style={s.resultCal}>{f.calories_per_100g} kcal/100g</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selected && (
                <View style={s.selectedCard}>
                  <Text style={s.selectedName}>{selected.name}</Text>
                  <View style={s.macroRow}>
                    <Text style={s.macroText}>{selected.calories_per_100g} kcal</Text>
                    <Text style={s.macroText}>P: {selected.protein_per_100g}g</Text>
                    <Text style={s.macroText}>G: {selected.carbs_per_100g}g</Text>
                    <Text style={s.macroText}>L: {selected.fat_per_100g}g</Text>
                  </View>
                  <Text style={s.label}>Quantité (g)</Text>
                  <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholderTextColor={c.placeholder} />
                  <Text style={s.preview}>{previewCal} kcal</Text>
                  <TouchableOpacity style={s.btn} onPress={addFromSearch} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Ajouter au journal</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setSelected(null)}>
                    <Text style={s.cancelText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              )}

              {results.length === 0 && !searching && query.length > 0 && !selected && (
                <Text style={s.empty}>Aucun résultat — essayez l'onglet Manuel</Text>
              )}
            </>
          )}

          {tab === 'manual' && (
            <>
              <Text style={s.label}>Nom de l'aliment *</Text>
              <TextInput style={s.input} placeholder="Ex : Poulet grillé" placeholderTextColor={c.placeholder} value={manName} onChangeText={setManName} />
              <Text style={s.label}>Calories / 100g *</Text>
              <TextInput style={s.input} placeholder="Ex : 165" placeholderTextColor={c.placeholder} keyboardType="numeric" value={manCal} onChangeText={setManCal} />
              <Text style={s.sectionLabel}>Macros / 100g (optionnel)</Text>
              <View style={s.macroInputRow}>
                <View style={s.macroField}>
                  <Text style={s.label}>Protéines (g)</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor={c.placeholder} keyboardType="numeric" value={manProt} onChangeText={setManProt} />
                </View>
                <View style={s.macroField}>
                  <Text style={s.label}>Glucides (g)</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor={c.placeholder} keyboardType="numeric" value={manCarbs} onChangeText={setManCarbs} />
                </View>
                <View style={s.macroField}>
                  <Text style={s.label}>Lipides (g)</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor={c.placeholder} keyboardType="numeric" value={manFat} onChangeText={setManFat} />
                </View>
              </View>
              <Text style={s.label}>Quantité (g)</Text>
              <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholderTextColor={c.placeholder} />
              {manCal ? <Text style={s.preview}>{Math.round(Number(manCal) * (Number(quantity) || 100) / 100)} kcal</Text> : null}
              <TouchableOpacity style={s.btn} onPress={addManual} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Ajouter au journal</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 48 },
    heading: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
    label: { color: c.textSub, fontSize: 12, marginBottom: 6 },
    sectionLabel: { color: c.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 4 },
    input: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.borderAlt,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
      color: c.text, fontSize: 14, marginBottom: 16,
    },
    mealTypeScroll: { marginBottom: 16 },
    mealTypeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: c.card, borderWidth: 1, borderColor: c.borderAlt },
    mealTypeActive: { backgroundColor: c.accentLight, borderColor: c.accentBorder },
    mealTypeText: { color: c.textDim, fontSize: 13 },
    mealTypeTextActive: { color: c.accentText },
    tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.borderAlt },
    tabActive: { backgroundColor: c.accentLight, borderColor: c.accentBorder },
    tabText: { color: c.textDim, fontSize: 14 },
    tabTextActive: { color: c.accentText },
    searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    searchBtn: { backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
    searchBtnText: { color: '#fff', fontSize: 18 },
    resultsList: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 12, overflow: 'hidden' },
    resultRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: c.cardAlt, flexDirection: 'row', justifyContent: 'space-between' },
    resultName: { color: c.text, fontSize: 14, flex: 1 },
    resultCal: { color: '#93c5fd', fontSize: 13 },
    selectedCard: { backgroundColor: c.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
    selectedName: { color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
    macroRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    macroText: { color: c.textDim, fontSize: 12 },
    macroInputRow: { flexDirection: 'row', gap: 8 },
    macroField: { flex: 1 },
    preview: { color: '#fbbf24', fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
    btn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 8 },
    btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    cancelBtn: { paddingVertical: 10, alignItems: 'center' },
    cancelText: { color: c.textDim, fontSize: 13 },
    empty: { color: c.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  })
}
