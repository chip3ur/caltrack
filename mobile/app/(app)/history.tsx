import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, Alert,
  ActivityIndicator, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { useColors, type Colors } from '../../lib/theme'

type Meal = {
  id: string
  food_name: string
  calories: number
  quantity_g: number
  meal_type: string
  eaten_at: string
  calories_per_100g?: number
}

type Section = { title: string; total: number; data: Meal[] }

const MEAL_TYPES = [
  { key: 'petit-dejeuner', label: 'Petit-déj.' },
  { key: 'dejeuner', label: 'Déjeuner' },
  { key: 'gouter', label: 'Goûter' },
  { key: 'diner', label: 'Dîner' },
]

export default function HistoryScreen() {
  const c = useColors()
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [editMeal, setEditMeal] = useState<Meal | null>(null)
  const [editName, setEditName] = useState('')
  const [editQty, setEditQty] = useState('')
  const [editType, setEditType] = useState('')
  const [editCalPer100, setEditCalPer100] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
      .from('meals')
      .select('id, food_name, calories, quantity_g, meal_type, eaten_at')
      .eq('user_id', session.user.id)
      .order('eaten_at', { ascending: false })
      .limit(200)

    if (!data) { setLoading(false); return }

    const grouped: Record<string, Meal[]> = {}
    data.forEach(m => {
      const day = m.eaten_at.split('T')[0]
      if (!grouped[day]) grouped[day] = []
      grouped[day].push(m)
    })

    setSections(Object.entries(grouped).map(([title, meals]) => ({
      title,
      data: meals,
      total: Math.round(meals.reduce((s, m) => s + m.calories, 0)),
    })))
    setLoading(false)
  }

  function openMealOptions(item: Meal) {
    Alert.alert(item.food_name, `${item.calories} kcal · ${item.quantity_g}g`, [
      {
        text: 'Modifier', onPress: () => {
          const calPer100 = item.quantity_g > 0 ? Math.round(item.calories / item.quantity_g * 100) : null
          setEditMeal(item)
          setEditName(item.food_name)
          setEditQty(String(item.quantity_g))
          setEditType(item.meal_type)
          setEditCalPer100(calPer100)
        }
      },
      {
        text: 'Supprimer', style: 'destructive', onPress: () => {
          Alert.alert('Supprimer', 'Supprimer ce repas ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => deleteMeal(item.id) }
          ])
        }
      },
      { text: 'Annuler', style: 'cancel' },
    ])
  }

  async function deleteMeal(id: string) {
    await supabase.from('meals').delete().eq('id', id)
    setSections(prev => prev
      .map(sec => {
        const meals = sec.data.filter(m => m.id !== id)
        return { ...sec, data: meals, total: Math.round(meals.reduce((s, m) => s + m.calories, 0)) }
      })
      .filter(sec => sec.data.length > 0)
    )
  }

  async function saveEdit() {
    if (!editMeal) return
    const qty = Number(editQty) || editMeal.quantity_g
    const cal = editCalPer100 ? Math.round(editCalPer100 * qty / 100) : editMeal.calories
    setSaving(true)
    const { error } = await supabase.from('meals').update({
      food_name: editName.trim(),
      quantity_g: qty,
      calories: cal,
      meal_type: editType,
    }).eq('id', editMeal.id)

    if (error) { Alert.alert('Erreur', error.message); setSaving(false); return }

    setSections(prev => prev.map(sec => {
      const meals = sec.data.map(m => m.id === editMeal.id
        ? { ...m, food_name: editName.trim(), quantity_g: qty, calories: cal, meal_type: editType }
        : m
      )
      return { ...sec, data: meals, total: Math.round(meals.reduce((s, m) => s + m.calories, 0)) }
    }))
    setSaving(false)
    setEditMeal(null)
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (dateStr === today.toISOString().split('T')[0]) return 'Aujourd\'hui'
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Hier'
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const s = makeStyles(c)
  const previewCal = editCalPer100 && editQty ? Math.round(editCalPer100 * (Number(editQty) || 0) / 100) : null

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color={c.accent} /></SafeAreaView>
  }

  return (
    <SafeAreaView style={s.safe}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={s.content}
        ListHeaderComponent={<Text style={s.heading}>Historique</Text>}
        ListEmptyComponent={<Text style={s.empty}>Aucun repas enregistré</Text>}
        renderSectionHeader={({ section }) => (
          <View style={s.dateHeader}>
            <Text style={s.dateText}>{formatDate(section.title)}</Text>
            <Text style={s.dateCals}>{section.total} kcal</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => openMealOptions(item)}>
            <View style={s.rowInfo}>
              <Text style={s.rowName}>{item.food_name}</Text>
              <Text style={s.rowMeta}>{item.meal_type} · {item.quantity_g}g</Text>
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowCals}>{item.calories} kcal</Text>
              <Text style={s.rowEdit}>···</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Edit modal */}
      <Modal visible={!!editMeal} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Modifier le repas</Text>

            <Text style={s.modalLabel}>Aliment</Text>
            <TextInput style={s.modalInput} value={editName} onChangeText={setEditName} placeholderTextColor={c.placeholder} />

            <Text style={s.modalLabel}>Quantité (g)</Text>
            <TextInput style={s.modalInput} value={editQty} onChangeText={setEditQty}
              keyboardType="numeric" placeholderTextColor={c.placeholder} />

            {previewCal !== null && (
              <Text style={s.modalPreview}>{previewCal} kcal</Text>
            )}

            <Text style={s.modalLabel}>Type de repas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {MEAL_TYPES.map(mt => (
                <TouchableOpacity key={mt.key}
                  style={[s.chip, editType === mt.key && s.chipActive]}
                  onPress={() => setEditType(mt.key)}>
                  <Text style={[s.chipText, editType === mt.key && s.chipTextActive]}>{mt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setEditMeal(null)}>
                <Text style={s.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSave} onPress={saveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSaveText}>Enregistrer</Text>}
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
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 32 },
    heading: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
    empty: { color: c.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 32 },
    dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, marginTop: 12, marginBottom: 4 },
    dateText: { color: c.textMuted, fontSize: 12, textTransform: 'capitalize' },
    dateCals: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
    row: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: c.card, borderRadius: 12, padding: 14,
      marginBottom: 6, borderWidth: 1, borderColor: c.border,
    },
    rowInfo: { flex: 1 },
    rowName: { color: c.text, fontSize: 14, fontWeight: '500' },
    rowMeta: { color: c.textDim, fontSize: 12, marginTop: 2 },
    rowRight: { alignItems: 'flex-end', gap: 2 },
    rowCals: { color: '#93c5fd', fontSize: 14, fontWeight: '600' },
    rowEdit: { color: c.textDim, fontSize: 16, letterSpacing: 1 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: c.border,
    },
    modalTitle: { color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 20 },
    modalLabel: { color: c.textSub, fontSize: 12, marginBottom: 6 },
    modalInput: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.borderAlt,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      color: c.text, fontSize: 14, marginBottom: 14,
    },
    modalPreview: { color: '#fbbf24', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.borderAlt },
    chipActive: { backgroundColor: c.accentLight, borderColor: c.accentBorder },
    chipText: { color: c.textDim, fontSize: 13 },
    chipTextActive: { color: c.accentText },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.borderAlt },
    modalCancelText: { color: c.textSub, fontSize: 14 },
    modalSave: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: c.accent },
    modalSaveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  })
}
