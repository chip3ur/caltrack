import { useEffect, useState, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

type Meal = {
  id: string
  food_name: string
  calories: number
  quantity_g: number
  meal_type: string
  food_id: string | null
  foods: { protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number } | null
}

type Profile = {
  daily_calories: number
  full_name: string
  water_goal_ml: number
}

export default function DashboardScreen() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [streak, setStreak] = useState(0)
  const [waterToday, setWaterToday] = useState(0)
  const [waterLoading, setWaterLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    const [{ data: profileData }, { data: mealsData }, { data: streakData }, { data: waterData }] = await Promise.all([
      supabase.from('profiles').select('daily_calories, full_name, water_goal_ml').eq('id', session.user.id).single(),
      supabase.from('meals')
        .select('id, calories, food_id, quantity_g, food_name, meal_type, foods(protein_per_100g, carbs_per_100g, fat_per_100g)')
        .eq('user_id', session.user.id)
        .gte('eaten_at', `${today}T00:00:00`),
      supabase.from('meals')
        .select('calories, eaten_at')
        .eq('user_id', session.user.id)
        .gte('eaten_at', thirtyDaysAgo),
      supabase.from('water_logs')
        .select('amount_ml')
        .eq('user_id', session.user.id)
        .gte('logged_at', `${today}T00:00:00`),
    ])

    if (profileData) setProfile(profileData)
    if (mealsData) setMeals(mealsData as unknown as Meal[])

    if (streakData) {
      const byDay: Record<string, number> = {}
      streakData.forEach(m => {
        const d = m.eaten_at.split('T')[0]
        byDay[d] = (byDay[d] ?? 0) + m.calories
      })
      let s = 0, offset = 0
      while (s < 30 && offset < 31) {
        const d = new Date()
        d.setDate(d.getDate() - offset)
        const dateStr = d.toISOString().split('T')[0]
        if ((byDay[dateStr] ?? 0) > 0) { s++; offset++ }
        else if (offset === 0) { offset++ }
        else break
      }
      setStreak(s)
    }

    setWaterToday((waterData ?? []).reduce((s, w) => s + w.amount_ml, 0))
    setLoading(false)
  }

  async function addWater(ml: number) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setWaterLoading(true)
    await supabase.from('water_logs').insert({ user_id: session.user.id, amount_ml: ml })
    setWaterToday(w => w + ml)
    setWaterLoading(false)
  }

  const { totalCal, totalProtein, totalCarbs, totalFat } = useMemo(() => ({
    totalCal: Math.round(meals.reduce((s, m) => s + m.calories, 0)),
    totalProtein: Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.protein_per_100g * m.quantity_g / 100 : 0), 0)),
    totalCarbs: Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.carbs_per_100g * m.quantity_g / 100 : 0), 0)),
    totalFat: Math.round(meals.reduce((s, m) => s + (m.foods ? m.foods.fat_per_100g * m.quantity_g / 100 : 0), 0)),
  }), [meals])

  const goal = profile?.daily_calories ?? 2000
  const remaining = Math.max(goal - totalCal, 0)
  const progress = Math.min(totalCal / goal, 1)
  const waterGoal = profile?.water_goal_ml ?? 2000
  const waterPct = Math.min(waterToday / waterGoal, 1)

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#2563eb" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.greeting}>{profile?.full_name ? `Bonjour, ${profile.full_name}` : 'Aujourd\'hui'}</Text>

        {/* Calories card */}
        <View style={s.card}>
          <Text style={s.cardLabel}>CALORIES</Text>
          <Text style={s.calsMain}>{totalCal}</Text>
          <Text style={s.calsGoal}>/ {goal} kcal</Text>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={s.remaining}>{remaining} kcal restantes</Text>
        </View>

        {/* Stat cards */}
        <View style={s.statRow}>
          {[
            { label: 'Protéines', val: `${totalProtein}g`, color: '#93c5fd' },
            { label: 'Glucides', val: `${totalCarbs}g`, color: '#fbbf24' },
            { label: 'Lipides', val: `${totalFat}g`, color: '#fb923c' },
            { label: 'Série', val: `${streak}j`, color: streak >= 7 ? '#fbbf24' : streak >= 3 ? '#4ade80' : '#6B7280' },
          ].map(c => (
            <View key={c.label} style={s.statCard}>
              <Text style={[s.statVal, { color: c.color }]}>{c.val}</Text>
              <Text style={s.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Water */}
        <View style={s.card}>
          <View style={s.waterHeader}>
            <Text style={s.cardLabel}>HYDRATATION</Text>
            <Text style={s.waterVal}>{waterToday} / {waterGoal} mL</Text>
          </View>
          <View style={s.progressBg}>
            <View style={[s.progressFill, s.progressWater, { width: `${waterPct * 100}%` as any }]} />
          </View>
          <View style={s.waterBtns}>
            {[150, 250, 350, 500].map(ml => (
              <TouchableOpacity key={ml} style={s.waterBtn} onPress={() => addWater(ml)} disabled={waterLoading}>
                <Text style={s.waterBtnText}>+{ml}mL</Text>
              </TouchableOpacity>
            ))}
          </View>
          {waterToday >= waterGoal && (
            <Text style={s.waterDone}>Objectif atteint !</Text>
          )}
        </View>

        {/* Meals list */}
        <View style={s.card}>
          <Text style={s.cardLabel}>REPAS DU JOUR</Text>
          {meals.length === 0 ? (
            <Text style={s.empty}>Aucun repas enregistré aujourd'hui</Text>
          ) : (
            <>
              {meals.map(m => (
                <View key={m.id} style={s.mealRow}>
                  <View style={s.mealInfo}>
                    <Text style={s.mealName}>{m.food_name}</Text>
                    <Text style={s.mealType}>{m.meal_type}</Text>
                  </View>
                  <Text style={s.mealCals}>{m.calories} kcal</Text>
                </View>
              ))}
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalVal}>{totalCal} kcal</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: {
    backgroundColor: '#111118', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#22222E', marginBottom: 12,
  },
  cardLabel: { color: '#555', fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  calsMain: { color: '#fff', fontSize: 48, fontWeight: '700', textAlign: 'center' },
  calsGoal: { color: '#555', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  progressBg: { height: 6, backgroundColor: '#1E1E28', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 6, backgroundColor: '#2563eb', borderRadius: 3 },
  progressWater: { backgroundColor: '#3b82f6' },
  remaining: { color: '#4B5563', fontSize: 12, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#111118', borderRadius: 12,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#22222E',
  },
  statVal: { fontSize: 16, fontWeight: '700' },
  statLabel: { color: '#555', fontSize: 10, marginTop: 2 },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  waterVal: { color: '#93c5fd', fontSize: 13, fontWeight: '500' },
  waterBtns: { flexDirection: 'row', gap: 6, marginTop: 10 },
  waterBtn: {
    flex: 1, backgroundColor: '#1E1E28', borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#2E2E3E',
  },
  waterBtnText: { color: '#fff', fontSize: 11 },
  waterDone: { color: '#4ade80', fontSize: 12, textAlign: 'center', marginTop: 8 },
  mealRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E1E28',
  },
  mealInfo: { flex: 1 },
  mealName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  mealType: { color: '#555', fontSize: 11, marginTop: 2 },
  mealCals: { color: '#fbbf24', fontSize: 14, fontWeight: '600' },
  empty: { color: '#4B4B5A', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 },
  totalLabel: { color: '#555', fontSize: 12 },
  totalVal: { color: '#fbbf24', fontSize: 16, fontWeight: '700' },
})
