import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
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

export default function DashboardScreen() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [goal, setGoal] = useState(2000)

  useEffect(() => {
    loadToday()
  }, [])

  async function loadToday() {
    const today = new Date().toISOString().split('T')[0]
    const user = (await supabase.auth.getSession()).data.session?.user
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('calories_goal')
      .eq('id', user.id)
      .single()
    if (profile?.calories_goal) setGoal(profile.calories_goal)

    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', today)
      .order('created_at', { ascending: false })
    if (data) setMeals(data)
  }

  const totalCals = meals.reduce((s, m) => s + m.calories, 0)
  const totalProtein = meals.reduce((s, m) => s + (m.protein ?? 0), 0)
  const totalCarbs = meals.reduce((s, m) => s + (m.carbs ?? 0), 0)
  const totalFat = meals.reduce((s, m) => s + (m.fat ?? 0), 0)
  const progress = Math.min(totalCals / goal, 1)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.heading}>Aujourd'hui</Text>

        {/* Calories ring */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Calories</Text>
          <Text style={s.calsMain}>{totalCals}</Text>
          <Text style={s.calsGoal}>/ {goal} kcal</Text>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={s.remaining}>{Math.max(goal - totalCals, 0)} kcal restantes</Text>
        </View>

        {/* Macros */}
        <View style={s.macroRow}>
          <View style={s.macroCard}>
            <Text style={s.macroVal}>{totalProtein}g</Text>
            <Text style={s.macroLabel}>Protéines</Text>
          </View>
          <View style={s.macroCard}>
            <Text style={s.macroVal}>{totalCarbs}g</Text>
            <Text style={s.macroLabel}>Glucides</Text>
          </View>
          <View style={s.macroCard}>
            <Text style={s.macroVal}>{totalFat}g</Text>
            <Text style={s.macroLabel}>Lipides</Text>
          </View>
        </View>

        {/* Meals list */}
        <Text style={s.sectionTitle}>Repas du jour</Text>
        {meals.length === 0
          ? <Text style={s.empty}>Aucun repas enregistré aujourd'hui</Text>
          : meals.map(m => (
            <View key={m.id} style={s.mealRow}>
              <View style={s.mealInfo}>
                <Text style={s.mealName}>{m.name}</Text>
                <Text style={s.mealMacros}>{m.protein}g P · {m.carbs}g G · {m.fat}g L</Text>
              </View>
              <Text style={s.mealCals}>{m.calories} kcal</Text>
            </View>
          ))
        }
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: '#111118',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22222E',
    marginBottom: 12,
    alignItems: 'center',
  },
  cardLabel: { color: '#555', fontSize: 12, marginBottom: 4 },
  calsMain: { color: '#fff', fontSize: 48, fontWeight: '700' },
  calsGoal: { color: '#555', fontSize: 14, marginBottom: 12 },
  progressBg: {
    width: '100%', height: 6, backgroundColor: '#1E1E28',
    borderRadius: 3, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: 6, backgroundColor: '#2563eb', borderRadius: 3 },
  remaining: { color: '#4B5563', fontSize: 12 },
  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  macroCard: {
    flex: 1, backgroundColor: '#111118', borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#22222E',
  },
  macroVal: { color: '#fff', fontSize: 18, fontWeight: '600' },
  macroLabel: { color: '#555', fontSize: 11, marginTop: 2 },
  sectionTitle: { color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  empty: { color: '#4B4B5A', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  mealRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111118', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#22222E',
  },
  mealInfo: { flex: 1 },
  mealName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  mealMacros: { color: '#555', fontSize: 12, marginTop: 2 },
  mealCals: { color: '#93c5fd', fontSize: 14, fontWeight: '600' },
})
