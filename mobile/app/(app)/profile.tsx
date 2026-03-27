import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

const ACTIVITY = [
  { key: 'sedentary', label: 'Sédentaire', mult: 1.2 },
  { key: 'light', label: 'Légèrement actif', mult: 1.375 },
  { key: 'moderate', label: 'Modérément actif', mult: 1.55 },
  { key: 'very_active', label: 'Très actif', mult: 1.725 },
]

const GOALS = [
  { key: 'loss', label: 'Perte de poids', delta: -500 },
  { key: 'maintain', label: 'Maintien', delta: 0 },
  { key: 'gain', label: 'Prise de masse', delta: 300 },
]

export default function ProfileScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState('moderate')
  const [goal, setGoal] = useState('maintain')
  const [waterGoal, setWaterGoal] = useState('2000')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setEmail(session.user.email ?? '')

    const { data } = await supabase
      .from('profiles')
      .select('full_name, age, sex, height_cm, weight_kg, activity_level, goal, water_goal_ml')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setFullName(data.full_name ?? '')
      setAge(data.age ? String(data.age) : '')
      setSex(data.sex ?? 'male')
      setHeight(data.height_cm ? String(data.height_cm) : '')
      setWeight(data.weight_kg ? String(data.weight_kg) : '')
      setActivity(data.activity_level ?? 'moderate')
      setGoal(data.goal ?? 'maintain')
      setWaterGoal(data.water_goal_ml ? String(data.water_goal_ml) : '2000')
    }
    setLoading(false)
  }

  function calcCalories() {
    const a = Number(age), h = Number(height), w = Number(weight)
    if (!a || !h || !w) return null
    const bmr = sex === 'male'
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161
    const mult = ACTIVITY.find(x => x.key === activity)?.mult ?? 1.55
    const delta = GOALS.find(x => x.key === goal)?.delta ?? 0
    return Math.max(Math.round(bmr * mult) + delta, 1200)
  }

  async function saveProfile() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const dailyCalories = calcCalories()
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: fullName.trim(),
      age: Number(age) || null,
      sex,
      height_cm: Number(height) || null,
      weight_kg: Number(weight) || null,
      activity_level: activity,
      goal,
      daily_calories: dailyCalories,
      water_goal_ml: Number(waterGoal) || 2000,
    })

    if (error) Alert.alert('Erreur', error.message)
    else Alert.alert('Sauvegardé', 'Profil mis à jour.')
    setSaving(false)
  }

  async function handleLogout() {
    Alert.alert('Déconnexion', 'Se déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        }
      }
    ])
  }

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#2563eb" /></SafeAreaView>
  }

  const estimatedCal = calcCalories()

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.heading}>Profil</Text>

          <View style={s.emailCard}>
            <Text style={s.emailLabel}>Compte</Text>
            <Text style={s.email}>{email}</Text>
          </View>

          <Text style={s.sectionTitle}>Informations personnelles</Text>

          <Text style={s.label}>Prénom</Text>
          <TextInput style={s.input} value={fullName} onChangeText={setFullName}
            placeholder="Ex : Alex" placeholderTextColor="#555" />

          <Text style={s.label}>Âge</Text>
          <TextInput style={s.input} value={age} onChangeText={setAge}
            keyboardType="numeric" placeholder="Ex : 28" placeholderTextColor="#555" />

          <Text style={s.label}>Sexe</Text>
          <View style={s.row}>
            {(['male', 'female'] as const).map(g => (
              <TouchableOpacity key={g} style={[s.chip, sex === g && s.chipActive]} onPress={() => setSex(g)}>
                <Text style={[s.chipText, sex === g && s.chipTextActive]}>
                  {g === 'male' ? 'Homme' : 'Femme'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Taille (cm)</Text>
          <TextInput style={s.input} value={height} onChangeText={setHeight}
            keyboardType="numeric" placeholder="Ex : 175" placeholderTextColor="#555" />

          <Text style={s.label}>Poids (kg)</Text>
          <TextInput style={s.input} value={weight} onChangeText={setWeight}
            keyboardType="numeric" placeholder="Ex : 70" placeholderTextColor="#555" />

          <Text style={s.sectionTitle}>Activité & Objectif</Text>

          <Text style={s.label}>Niveau d'activité</Text>
          {ACTIVITY.map(a => (
            <TouchableOpacity key={a.key} style={[s.optionCard, activity === a.key && s.optionActive]}
              onPress={() => setActivity(a.key)}>
              <Text style={[s.optionText, activity === a.key && s.optionTextActive]}>{a.label}</Text>
            </TouchableOpacity>
          ))}

          <Text style={s.label}>Objectif</Text>
          <View style={s.row}>
            {GOALS.map(g => (
              <TouchableOpacity key={g.key} style={[s.chip, goal === g.key && s.chipActive]} onPress={() => setGoal(g.key)}>
                <Text style={[s.chipText, goal === g.key && s.chipTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {estimatedCal && (
            <View style={s.calCard}>
              <Text style={s.calLabel}>Objectif calorique estimé</Text>
              <Text style={s.calVal}>{estimatedCal} kcal/jour</Text>
            </View>
          )}

          <Text style={s.sectionTitle}>Hydratation</Text>
          <Text style={s.label}>Objectif eau (mL/jour)</Text>
          <TextInput style={s.input} value={waterGoal} onChangeText={setWaterGoal}
            keyboardType="numeric" placeholderTextColor="#555" />

          <TouchableOpacity style={s.saveBtn} onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Sauvegarder</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 20 },
  emailCard: { backgroundColor: '#111118', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#22222E', marginBottom: 24 },
  emailLabel: { color: '#555', fontSize: 11, marginBottom: 4 },
  email: { color: '#fff', fontSize: 14 },
  sectionTitle: { color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  label: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#111118', borderWidth: 1, borderColor: '#2E2E3E',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#fff', fontSize: 14, marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#111118', borderWidth: 1, borderColor: '#2E2E3E',
  },
  chipActive: { backgroundColor: 'rgba(37,99,235,0.15)', borderColor: 'rgba(59,130,246,0.3)' },
  chipText: { color: '#555', fontSize: 13 },
  chipTextActive: { color: '#93c5fd' },
  optionCard: {
    backgroundColor: '#111118', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2E2E3E', marginBottom: 8,
  },
  optionActive: { borderColor: 'rgba(59,130,246,0.4)', backgroundColor: 'rgba(37,99,235,0.08)' },
  optionText: { color: '#9CA3AF', fontSize: 14 },
  optionTextActive: { color: '#93c5fd' },
  calCard: {
    backgroundColor: '#111118', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#22222E', alignItems: 'center', marginVertical: 12,
  },
  calLabel: { color: '#555', fontSize: 12, marginBottom: 4 },
  calVal: { color: '#93c5fd', fontSize: 24, fontWeight: '700' },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  logoutText: { color: '#f87171', fontSize: 15 },
})
