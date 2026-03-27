import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, ActivityIndicator, Alert, LayoutChangeEvent
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg'
import { supabase } from '../../lib/supabase'
import { useColors, type Colors } from '../../lib/theme'

type DayStats = { day: string; label: string; calories: number; protein: number; carbs: number; fat: number }
type WeightLog = { id: string; weight_kg: number; logged_at: string }
type WeekMacros = { protein: number; carbs: number; fat: number; totalCal: number }

const CHART_H = 120
const PAD = { top: 16, bottom: 24, left: 32, right: 12 }

function WeightChart({ data, c }: { data: WeightLog[]; c: Colors }) {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  if (data.length < 2) return null

  const pts = [...data].reverse()
  const values = pts.map(p => p.weight_kg)
  const minW = Math.min(...values)
  const maxW = Math.max(...values)
  const range = maxW - minW || 1
  const innerW = width - PAD.left - PAD.right
  const innerH = CHART_H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i / (pts.length - 1)) * innerW
  const y = (v: number) => PAD.top + innerH - ((v - minW) / range) * innerH
  const points = pts.map((p, i) => `${x(i)},${y(p.weight_kg)}`).join(' ')

  return (
    <View onLayout={onLayout} style={{ height: CHART_H }}>
      {width > 0 && (
        <Svg width={width} height={CHART_H}>
          {[0, 0.5, 1].map(t => {
            const yy = PAD.top + innerH * (1 - t)
            return (
              <View key={t}>
                <Line x1={PAD.left} y1={yy} x2={PAD.left + innerW} y2={yy} stroke={c.cardAlt} strokeWidth={1} />
                <SvgText x={PAD.left - 4} y={yy + 4} fontSize={9} fill={c.textDim} textAnchor="end">
                  {(minW + t * range).toFixed(1)}
                </SvgText>
              </View>
            )
          })}
          <Polyline points={points} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <Circle key={p.id} cx={x(i)} cy={y(p.weight_kg)} r={3}
              fill={i === pts.length - 1 ? '#93c5fd' : '#2563eb'} />
          ))}
          <SvgText x={PAD.left} y={CHART_H - 2} fontSize={9} fill={c.textDim} textAnchor="middle">
            {new Date(pts[0].logged_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </SvgText>
          <SvgText x={PAD.left + innerW} y={CHART_H - 2} fontSize={9} fill={c.textDim} textAnchor="middle">
            {new Date(pts[pts.length - 1].logged_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </SvgText>
        </Svg>
      )}
    </View>
  )
}

export default function ProgressScreen() {
  const c = useColors()
  const [stats, setStats] = useState<DayStats[]>([])
  const [goal, setGoal] = useState(2000)
  const [avgCals, setAvgCals] = useState(0)
  const [streak, setStreak] = useState(0)
  const [weights, setWeights] = useState<WeightLog[]>([])
  const [weekMacros, setWeekMacros] = useState<WeekMacros>({ protein: 0, carbs: 0, fat: 0, totalCal: 0 })
  const [newWeight, setNewWeight] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingWeight, setSavingWeight] = useState(false)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const days: DayStats[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const day = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
      days.push({ day, label, calories: 0, protein: 0, carbs: 0, fat: 0 })
    }

    const [{ data: profileData }, { data: mealsData }, { data: weightData }] = await Promise.all([
      supabase.from('profiles').select('daily_calories').eq('id', session.user.id).single(),
      supabase.from('meals')
        .select('calories, eaten_at, quantity_g, foods(protein_per_100g, carbs_per_100g, fat_per_100g)')
        .eq('user_id', session.user.id)
        .gte('eaten_at', days[0].day),
      supabase.from('weight_logs')
        .select('id, weight_kg, logged_at')
        .eq('user_id', session.user.id)
        .order('logged_at', { ascending: false })
        .limit(30),
    ])

    if (profileData?.daily_calories) setGoal(profileData.daily_calories)

    let totalProtein = 0, totalCarbs = 0, totalFat = 0, totalCal = 0
    mealsData?.forEach((m: any) => {
      const day = m.eaten_at.split('T')[0]
      const entry = days.find(d => d.day === day)
      if (entry) {
        entry.calories += m.calories
        if (m.foods) {
          const qty = m.quantity_g
          entry.protein += m.foods.protein_per_100g * qty / 100
          entry.carbs += m.foods.carbs_per_100g * qty / 100
          entry.fat += m.foods.fat_per_100g * qty / 100
        }
      }
      totalCal += m.calories
      if (m.foods) {
        const qty = m.quantity_g
        totalProtein += m.foods.protein_per_100g * qty / 100
        totalCarbs += m.foods.carbs_per_100g * qty / 100
        totalFat += m.foods.fat_per_100g * qty / 100
      }
    })
    days.forEach(d => { d.protein = Math.round(d.protein); d.carbs = Math.round(d.carbs); d.fat = Math.round(d.fat) })

    setStats(days)
    setWeights(weightData ?? [])
    setWeekMacros({
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat),
      totalCal: Math.round(totalCal),
    })

    const daysWithFood = days.filter(d => d.calories > 0)
    setAvgCals(daysWithFood.length ? Math.round(daysWithFood.reduce((s, d) => s + d.calories, 0) / daysWithFood.length) : 0)

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
    else if (data) { setWeights(prev => [data, ...prev]); setNewWeight('') }
    setSavingWeight(false)
  }

  async function deleteWeight(id: string) {
    await supabase.from('weight_logs').delete().eq('id', id)
    setWeights(prev => prev.filter(w => w.id !== id))
  }

  // Bilan calculs
  const daysWithFood = stats.filter(d => d.calories > 0)
  const daysOnTarget = stats.filter(d => d.calories >= goal * 0.9 && d.calories <= goal * 1.1).length
  const daysOver = stats.filter(d => d.calories > goal * 1.1).length
  const daysUnder = daysWithFood.length - daysOnTarget - daysOver
  const bestDay = stats.reduce((best, d) => d.calories > best.calories ? d : best, stats[0] ?? { calories: 0, label: '' })

  const maxCals = Math.max(...stats.map(d => d.calories), goal)
  const currentWeight = weights[0]?.weight_kg
  const startWeight = weights.length > 1 ? weights[weights.length - 1].weight_kg : null
  const weightDelta = currentWeight && startWeight ? currentWeight - startWeight : null
  const s = makeStyles(c)

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color={c.accent} /></SafeAreaView>
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.heading}>Progression</Text>

        {/* Stats rapides */}
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

        {/* Bilan de la semaine */}
        <View style={s.bilanCard}>
          <Text style={s.chartTitle}>Bilan de la semaine</Text>

          {/* Total & jours */}
          <View style={s.bilanRow}>
            <View style={s.bilanStat}>
              <Text style={s.bilanVal}>{weekMacros.totalCal}</Text>
              <Text style={s.bilanLabel}>kcal cette semaine</Text>
            </View>
            <View style={s.bilanSep} />
            <View style={s.bilanStat}>
              <Text style={s.bilanVal}>{avgCals}</Text>
              <Text style={s.bilanLabel}>kcal / jour en moy.</Text>
            </View>
            <View style={s.bilanSep} />
            <View style={s.bilanStat}>
              <Text style={s.bilanVal}>{daysWithFood.length}/7</Text>
              <Text style={s.bilanLabel}>jours tracés</Text>
            </View>
          </View>

          {/* Jours par statut */}
          <View style={s.statusRow}>
            <View style={[s.statusChip, { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' }]}>
              <Text style={[s.statusVal, { color: '#22c55e' }]}>{daysOnTarget}</Text>
              <Text style={s.statusLabel}>objectif ✓</Text>
            </View>
            <View style={[s.statusChip, { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: 'rgba(37,99,235,0.25)' }]}>
              <Text style={[s.statusVal, { color: '#60a5fa' }]}>{daysUnder < 0 ? 0 : daysUnder}</Text>
              <Text style={s.statusLabel}>en dessous</Text>
            </View>
            <View style={[s.statusChip, { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.3)' }]}>
              <Text style={[s.statusVal, { color: '#f97316' }]}>{daysOver}</Text>
              <Text style={s.statusLabel}>au-dessus</Text>
            </View>
          </View>

          {/* Macros semaine */}
          {(weekMacros.protein > 0 || weekMacros.carbs > 0 || weekMacros.fat > 0) && (
            <>
              <Text style={[s.chartTitle, { marginTop: 16, marginBottom: 10 }]}>Macros de la semaine</Text>
              <View style={s.macroRow}>
                {[
                  { label: 'Protéines', val: weekMacros.protein, unit: 'g', color: '#93c5fd' },
                  { label: 'Glucides', val: weekMacros.carbs, unit: 'g', color: '#fbbf24' },
                  { label: 'Lipides', val: weekMacros.fat, unit: 'g', color: '#fb923c' },
                ].map(m => (
                  <View key={m.label} style={s.macroCard}>
                    <Text style={[s.macroVal, { color: m.color }]}>{m.val}{m.unit}</Text>
                    <Text style={s.macroLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Meilleur jour */}
          {bestDay.calories > 0 && (
            <View style={s.bestDayRow}>
              <Text style={s.bestDayLabel}>Meilleur jour</Text>
              <Text style={s.bestDayVal}>{bestDay.label} · {bestDay.calories} kcal</Text>
            </View>
          )}
        </View>

        {/* Tableau détaillé */}
        <View style={s.tableCard}>
          <Text style={s.chartTitle}>Détail par jour</Text>
          {/* En-tête */}
          <View style={[s.tableRow, s.tableHeader]}>
            <Text style={[s.tableCell, s.tableCellJour, s.tableHeaderText]}>Jour</Text>
            <Text style={[s.tableCell, s.tableCellRight, s.tableHeaderText]}>Kcal</Text>
            <Text style={[s.tableCell, s.tableCellRight, s.tableHeaderText]}>Prot.</Text>
            <Text style={[s.tableCell, s.tableCellRight, s.tableHeaderText]}>Gluc.</Text>
            <Text style={[s.tableCell, s.tableCellRight, s.tableHeaderText]}>Lip.</Text>
          </View>
          {/* Lignes */}
          {stats.map(d => {
            const calColor = d.calories === 0 ? c.textDim
              : Math.abs(d.calories - goal) <= goal * 0.1 ? '#22c55e'
              : d.calories > goal * 1.1 ? '#f87171'
              : '#fbbf24'
            return (
              <View key={d.day} style={s.tableRow}>
                <Text style={[s.tableCell, s.tableCellJour, { color: c.text }]}>{d.label}</Text>
                <Text style={[s.tableCell, s.tableCellRight, { color: calColor, fontWeight: '600' }]}>
                  {d.calories > 0 ? d.calories : '—'}
                </Text>
                <Text style={[s.tableCell, s.tableCellRight, { color: '#93c5fd' }]}>{d.protein > 0 ? `${d.protein}g` : '—'}</Text>
                <Text style={[s.tableCell, s.tableCellRight, { color: '#fbbf24' }]}>{d.carbs > 0 ? `${d.carbs}g` : '—'}</Text>
                <Text style={[s.tableCell, s.tableCellRight, { color: '#fb923c' }]}>{d.fat > 0 ? `${d.fat}g` : '—'}</Text>
              </View>
            )
          })}
          {/* Ligne moyenne */}
          {daysWithFood.length > 0 && (
            <View style={[s.tableRow, s.tableAvgRow]}>
              <Text style={[s.tableCell, s.tableCellJour, s.tableHeaderText]}>Moy.</Text>
              <Text style={[s.tableCell, s.tableCellRight, { color: '#fbbf24', fontWeight: '600' }]}>{avgCals}</Text>
              <Text style={[s.tableCell, s.tableCellRight, { color: '#93c5fd', fontWeight: '600' }]}>
                {Math.round(daysWithFood.reduce((s, d) => s + d.protein, 0) / daysWithFood.length)}g
              </Text>
              <Text style={[s.tableCell, s.tableCellRight, { color: '#fbbf24', fontWeight: '600' }]}>
                {Math.round(daysWithFood.reduce((s, d) => s + d.carbs, 0) / daysWithFood.length)}g
              </Text>
              <Text style={[s.tableCell, s.tableCellRight, { color: '#fb923c', fontWeight: '600' }]}>
                {Math.round(daysWithFood.reduce((s, d) => s + d.fat, 0) / daysWithFood.length)}g
              </Text>
            </View>
          )}
        </View>

        {/* Graphique 7 jours */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>7 derniers jours</Text>
          <View style={s.chart}>
            {stats.map(d => {
              const h = maxCals > 0 ? (d.calories / maxCals) * 140 : 0
              const onTarget = d.calories >= goal * 0.9 && d.calories <= goal * 1.1
              const color = d.calories === 0 ? c.cardAlt : onTarget ? '#22c55e' : d.calories > goal ? '#f97316' : '#2563eb'
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

        {/* Suivi du poids */}
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

          {weights.length >= 2 && (
            <View style={s.curveWrap}>
              <WeightChart data={weights} c={c} />
            </View>
          )}

          <View style={s.weightInputRow}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Poids (kg)"
              placeholderTextColor={c.placeholder}
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

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 32 },
    heading: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    statVal: { color: c.text, fontSize: 20, fontWeight: '700' },
    statLabel: { color: c.textDim, fontSize: 11, marginTop: 4, textAlign: 'center' },
    // Bilan
    bilanCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.border, marginBottom: 16 },
    bilanRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    bilanStat: { flex: 1, alignItems: 'center' },
    bilanVal: { color: c.text, fontSize: 18, fontWeight: '700' },
    bilanLabel: { color: c.textDim, fontSize: 10, marginTop: 2, textAlign: 'center' },
    bilanSep: { width: 1, height: 32, backgroundColor: c.border },
    statusRow: { flexDirection: 'row', gap: 6 },
    statusChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    statusVal: { fontSize: 16, fontWeight: '700' },
    statusLabel: { fontSize: 9, marginTop: 2, color: '#6B7280' },
    macroRow: { flexDirection: 'row', gap: 8 },
    macroCard: { flex: 1, backgroundColor: c.cardAlt, borderRadius: 10, padding: 10, alignItems: 'center' },
    macroVal: { fontSize: 15, fontWeight: '700' },
    macroLabel: { color: c.textDim, fontSize: 10, marginTop: 2 },
    bestDayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border },
    bestDayLabel: { color: c.textMuted, fontSize: 12 },
    bestDayVal: { color: c.text, fontSize: 13, fontWeight: '600' },
    // Bar chart
    chartCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.border, marginBottom: 16 },
    chartTitle: { color: c.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 4 },
    barWrap: { flex: 1, alignItems: 'center', gap: 4 },
    barVal: { color: c.textDim, fontSize: 8 },
    bar: { width: '100%', borderRadius: 4, minHeight: 4 },
    barLabel: { color: c.textMuted, fontSize: 10 },
    legend: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: c.textMuted, fontSize: 11, marginLeft: 4 },
    // Poids
    weightCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.border },
    weightSummary: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    weightStat: { alignItems: 'center' },
    weightStatVal: { color: c.text, fontSize: 20, fontWeight: '700' },
    weightStatLabel: { color: c.textDim, fontSize: 11, marginTop: 2 },
    curveWrap: { marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
    weightInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    input: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.borderAlt,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
      color: c.text, fontSize: 14,
    },
    addWeightBtn: { backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
    addWeightText: { color: '#fff', fontSize: 22, fontWeight: '600' },
    weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.cardAlt },
    weightVal: { color: c.text, fontSize: 14, fontWeight: '500' },
    weightDate: { color: c.textDim, fontSize: 13 },
    // Tableau
    tableCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.border, marginBottom: 16 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.cardAlt },
    tableHeader: { borderBottomColor: c.border, marginBottom: 2 },
    tableAvgRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: c.border, marginTop: 2 },
    tableCell: { fontSize: 13 },
    tableCellJour: { flex: 1.2, color: c.textMuted, fontSize: 12 },
    tableCellRight: { flex: 1, textAlign: 'right' },
    tableHeaderText: { color: c.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  })
}
