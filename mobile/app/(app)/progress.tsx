import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, ActivityIndicator, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'


type DayStats = { day: string; label: string; calories: number }
type WeightLog = { id: string; weight_kg: number; logged_at: string }

export default function ProgressScreen() {
  const [stats, setStats] = useState<DayStats[]>([])
  const [goal, setGoal] = useState(2000)
  const [avgCals, setAvgCals] = useState(0)
  const [streak, setStreak] = useState(0)
  const [weights, setWeights] = useState<WeightLog[]>([])
  const [newWeight, setNewWeight] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingWeight, setSavingWeight] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const days: DayStats[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const day = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
      days.push({ day, label, calories: 0 })
    }

    const [{ data: profileData }, { data: mealsData }, { data: weightData }] = await Promise.all([
      supabase.from('profiles').select('daily_calories').eq('id', session.user.id).single(),
      supabase.from('meals')
        .select('calories, eaten_at')
        .eq('user_id', session.user.id)
        .gte('eaten_at', days[0].day),
      supabase.from('weight_logs')
        .select('id, weight_kg, logged_at')
        .eq('user_id', session.user.id)
        .order('logged_at', { ascending: false })
        .limit(30),
    ])

    if (profileData?.daily_calories) setGoal(profileData.daily_calories)

    mealsData?.forEach(m => {
      const day = m.eaten_at.split('T')[0]
      const entry = days.find(d => d.day === day)
      if (entry) entry.calories += m.calories
    })

    setStats(days)
    setWeights(weightData ?? [])

    const daysWithFood = days.filter(d => d.calories > 0)
    setAvgCals(daysWithFood.length
      ? Math.round(daysWithFood.reduce((s, d) => s + d.calories, 0) / daysWithFood.length)
      : 0
    )

    let s = 0
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].calories > 0) s++
      else break
    }
    setStreak(s)
    setLoading(false)
  }

  async function addWeight() {
    const w = parseFloat(newWeight)
    if (!w || w < 20 || w > 300) { Alert.alert('Valeur invalide', 'Entrez un poids entre 20 et 300 kg.'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setSavingWeight(true)
    const { data, error } = await supabase.from('weight_logs')
      .insert({ user_id: session.user.id, weight_kg: w })
      .select('id, weight_kg, logged_at').single()
    if (error) Alert.alert('Erreur', error.message)
    else if (data) {
      setWeights(prev => [data, ...prev])
      setNewWeight('')
    }
    setSavingWeight(false)
  }

  async function deleteWeight(id: string) {
    await supabase.from('weight_logs').delete().eq('id', id)
    setWeights(prev => prev.filter(w => w.id !== id))
  }

  const maxCals = Math.max(...stats.map(d => d.calories), goal)
  const currentWeight = weights[0]?.weight_kg
  const startWeight = weights.length > 1 ? weights[weights.length - 1].weight_kg : null
  const weightDelta = currentWeight && startWeight ? currentWeight - startWeight : null

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#2563eb" /></SafeAreaView>
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.heading}>Progression</Text>

        {/* Stats cards */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{avgCals}</Text>
            <Text style={s.statLabel}>Moy. kcal/j</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>{streak}</Text>
            <Text style={s.statLabel}>Jours actifs</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>{goal}</Text>
            <Text style={s.statLabel}>Objectif</Text>
          </View>
        </View>

        {/* Bar chart */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>7 derniers jours</Text>
          <View style={s.chart}>
            {stats.map(d => {
              const h = maxCals > 0 ? (d.calories / maxCals) * 140 : 0
              const onTarget = d.calories >= goal * 0.9 && d.calories <= goal * 1.1
              const color = d.calories === 0 ? '#1E1E28'
                : onTarget ? '#22c55e'
                : d.calories > goal ? '#f97316' : '#2563eb'
              return (
                <View key={d.day} style={s.barWrap}>
                  <Text style={s.barVal}>{d.calories > 0 ? d.calories : ''}</Text>
                  <View style={[s.bar, { height: Math.max(h, 4), backgroundColor: color }]} />
                  <Text style={s.barLabel}>{d.label}</Text>
                </View>
              )
            })}
          </View>
          <View style={s.legend}>
            <View style={[s.dot, { backgroundColor: '#22c55e' }]} />
            <Text style={s.legendText}>Objectif</Text>
            <View style={[s.dot, { backgroundColor: '#2563eb', marginLeft: 12 }]} />
            <Text style={s.legendText}>En dessous</Text>
            <View style={[s.dot, { backgroundColor: '#f97316', marginLeft: 12 }]} />
            <Text style={s.legendText}>Au-dessus</Text>
          </View>
        </View>

        {/* Weight tracking */}
        <View style={s.weightCard}>
          <Text style={s.chartTitle}>Suivi du poids</Text>

          {currentWeight && (
            <View style={s.weightSummary}>
              <View style={s.weightStat}>
                <Text style={s.weightStatVal}>{currentWeight} kg</Text>
                <Text style={s.weightStatLabel}>Actuel</Text>
              </View>
              {weightDelta !== null && (
                <View style={s.weightStat}>
                  <Text style={[s.weightStatVal, { color: weightDelta <= 0 ? '#4ade80' : '#f87171' }]}>
                    {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
                  </Text>
                  <Text style={s.weightStatLabel}>Évolution</Text>
                </View>
              )}
            </View>
          )}

          <View style={s.weightInputRow}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Poids (kg)"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              value={newWeight}
              onChangeText={setNewWeight}
            />
            <TouchableOpacity style={s.addWeightBtn} onPress={addWeight} disabled={savingWeight}>
              {savingWeight ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.addWeightText}>+</Text>}
            </TouchableOpacity>
          </View>

          {weights.slice(0, 10).map(w => (
            <TouchableOpacity key={w.id} style={s.weightRow} onLongPress={() => {
              Alert.alert('Supprimer', 'Supprimer cette mesure ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: () => deleteWeight(w.id) }
              ])
            }}>
              <Text style={s.weightVal}>{w.weight_kg} kg</Text>
              <Text style={s.weightDate}>
                {new Date(w.logged_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#111118', borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#22222E',
  },
  statVal: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#555', fontSize: 11, marginTop: 4, textAlign: 'center' },
  chartCard: {
    backgroundColor: '#111118', borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: '#22222E', marginBottom: 16,
  },
  chartTitle: { color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 4 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4 },
  barVal: { color: '#555', fontSize: 8 },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { color: '#6B7280', fontSize: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#6B7280', fontSize: 11, marginLeft: 4 },
  weightCard: {
    backgroundColor: '#111118', borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: '#22222E',
  },
  weightSummary: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  weightStat: { alignItems: 'center' },
  weightStatVal: { color: '#fff', fontSize: 20, fontWeight: '700' },
  weightStatLabel: { color: '#555', fontSize: 11, marginTop: 2 },
  weightInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    backgroundColor: '#1E1E28', borderWidth: 1, borderColor: '#2E2E3E',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#fff', fontSize: 14, marginBottom: 0,
  },
  addWeightBtn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  addWeightText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  weightRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E1E28',
  },
  weightVal: { color: '#fff', fontSize: 14, fontWeight: '500' },
  weightDate: { color: '#555', fontSize: 13 },
})
