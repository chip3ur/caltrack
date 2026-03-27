import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

type Meal = {
  id: string
  food_name: string
  calories: number
  quantity_g: number
  meal_type: string
  eaten_at: string
}

type Section = { title: string; total: number; data: Meal[] }

export default function HistoryScreen() {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

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

  async function deleteMeal(id: string) {
    Alert.alert('Supprimer', 'Supprimer ce repas ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await supabase.from('meals').delete().eq('id', id)
          setSections(prev => prev
            .map(sec => {
              const meals = sec.data.filter(m => m.id !== id)
              return { ...sec, data: meals, total: Math.round(meals.reduce((s, m) => s + m.calories, 0)) }
            })
            .filter(sec => sec.data.length > 0)
          )
        }
      }
    ])
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

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#2563eb" /></SafeAreaView>
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
          <TouchableOpacity style={s.row} onLongPress={() => deleteMeal(item.id)}>
            <View style={s.rowInfo}>
              <Text style={s.rowName}>{item.food_name}</Text>
              <Text style={s.rowMeta}>{item.meal_type} · {item.quantity_g}g</Text>
            </View>
            <Text style={s.rowCals}>{item.calories} kcal</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  empty: { color: '#4B4B5A', fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, marginTop: 12, marginBottom: 4,
  },
  dateText: { color: '#6B7280', fontSize: 12, textTransform: 'capitalize' },
  dateCals: { color: '#fbbf24', fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111118', borderRadius: 12, padding: 14,
    marginBottom: 6, borderWidth: 1, borderColor: '#22222E',
  },
  rowInfo: { flex: 1 },
  rowName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  rowMeta: { color: '#555', fontSize: 12, marginTop: 2 },
  rowCals: { color: '#93c5fd', fontSize: 14, fontWeight: '600' },
})
