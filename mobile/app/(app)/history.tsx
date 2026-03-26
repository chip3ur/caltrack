import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

type Meal = {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  created_at: string
}

type Section = { title: string; data: Meal[] }

export default function HistoryScreen() {
  const [sections, setSections] = useState<Section[]>([])

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    const user = (await supabase.auth.getSession()).data.session?.user
    if (!user) return

    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!data) return

    const grouped: Record<string, Meal[]> = {}
    data.forEach(m => {
      const day = m.created_at.split('T')[0]
      if (!grouped[day]) grouped[day] = []
      grouped[day].push(m)
    })

    setSections(Object.entries(grouped).map(([title, data]) => ({ title, data })))
  }

  async function deleteMeal(id: string) {
    Alert.alert('Supprimer', 'Supprimer ce repas ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await supabase.from('meals').delete().eq('id', id)
          loadHistory()
        }
      }
    ])
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
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
            <Text style={s.dateCals}>
              {section.data.reduce((s, m) => s + m.calories, 0)} kcal
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onLongPress={() => deleteMeal(item.id)}>
            <View style={s.rowInfo}>
              <Text style={s.rowName}>{item.name}</Text>
              <Text style={s.rowMacros}>
                {item.protein}g P · {item.carbs}g G · {item.fat}g L
              </Text>
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
  content: { padding: 16, paddingBottom: 32 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  empty: { color: '#4B4B5A', fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, marginTop: 12, marginBottom: 4,
  },
  dateText: { color: '#6B7280', fontSize: 12, textTransform: 'capitalize' },
  dateCals: { color: '#4B5563', fontSize: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111118', borderRadius: 12, padding: 14,
    marginBottom: 6, borderWidth: 1, borderColor: '#22222E',
  },
  rowInfo: { flex: 1 },
  rowName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  rowMacros: { color: '#555', fontSize: 12, marginTop: 2 },
  rowCals: { color: '#93c5fd', fontSize: 14, fontWeight: '600' },
})
