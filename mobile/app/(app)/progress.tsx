import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')
const BAR_WIDTH = (width - 32 - 40) / 7

type DayStats = { day: string; label: string; calories: number }

export default function ProgressScreen() {
  const [stats, setStats] = useState<DayStats[]>([])
  const [goal, setGoal] = useState(2000)
  const [avgCals, setAvgCals] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const user = (await supabase.auth.getSession()).data.session?.user
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('calories_goal')
      .eq('id', user.id)
      .single()
    if (profile?.calories_goal) setGoal(profile.calories_goal)

    const days: DayStats[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const day = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
      days.push({ day, label, calories: 0 })
    }

    const { data } = await supabase
      .from('meals')
      .select('calories, created_at')
      .eq('user_id', user.id)
      .gte('created_at', days[0].day)

    data?.forEach(m => {
      const day = m.created_at.split('T')[0]
      const entry = days.find(d => d.day === day)
      if (entry) entry.calories += m.calories
    })

    setStats(days)
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
  }

  const maxCals = Math.max(...stats.map(d => d.calories), goal)

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
              const color = d.calories >= goal ? '#22c55e'
                : d.calories > 0 ? '#2563eb' : '#1E1E28'
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
            <Text style={s.legendText}>Objectif atteint</Text>
            <View style={[s.dot, { backgroundColor: '#2563eb', marginLeft: 12 }]} />
            <Text style={s.legendText}>En dessous</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
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
    padding: 20, borderWidth: 1, borderColor: '#22222E',
  },
  chartTitle: { color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 4 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4 },
  barVal: { color: '#555', fontSize: 8 },
  bar: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { color: '#6B7280', fontSize: 10 },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#6B7280', fontSize: 11, marginLeft: 4 },
})
