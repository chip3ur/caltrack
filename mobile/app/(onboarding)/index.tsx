import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

const ACTIVITY = [
  { key: 'sedentary', label: 'Sédentaire', desc: 'Peu ou pas d\'exercice', mult: 1.2 },
  { key: 'light', label: 'Légèrement actif', desc: '1–3 jours/semaine', mult: 1.375 },
  { key: 'moderate', label: 'Modérément actif', desc: '3–5 jours/semaine', mult: 1.55 },
  { key: 'very_active', label: 'Très actif', desc: '6–7 jours/semaine', mult: 1.725 },
]

const GOALS = [
  { key: 'loss', label: 'Perte de poids', delta: -500 },
  { key: 'maintain', label: 'Maintien', delta: 0 },
  { key: 'gain', label: 'Prise de masse', delta: 300 },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')

  // Step 2
  const [activity, setActivity] = useState('moderate')

  // Step 3
  const [goal, setGoal] = useState('maintain')

  function calcCalories() {
    const a = Number(age), h = Number(height), w = Number(weight)
    if (!a || !h || !w) return 2000
    const bmr = sex === 'male'
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161
    const mult = ACTIVITY.find(x => x.key === activity)?.mult ?? 1.55
    const tdee = Math.round(bmr * mult)
    const delta = GOALS.find(x => x.key === goal)?.delta ?? 0
    return Math.max(tdee + delta, 1200)
  }

  async function finish() {
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expirée.'); setLoading(false); return }

    const dailyCalories = calcCalories()
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: fullName.trim(),
      age: Number(age),
      sex,
      height_cm: Number(height),
      weight_kg: Number(weight),
      activity_level: activity,
      goal,
      daily_calories: dailyCalories,
      water_goal_ml: 2000,
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.replace('/(app)')
    setLoading(false)
  }

  const inputClass = s.input

  return (
    <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.heading}>Configuration du profil</Text>
        <Text style={s.stepLabel}>Étape {step} / 3</Text>
        <View style={s.stepBar}>
          {[1, 2, 3].map(n => (
            <View key={n} style={[s.stepDot, n <= step && s.stepDotActive]} />
          ))}
        </View>

        {step === 1 && (
          <>
            <Text style={s.sectionTitle}>Informations personnelles</Text>

            <Text style={s.label}>Prénom</Text>
            <TextInput style={inputClass} placeholder="Ex : Alex" placeholderTextColor="#555"
              value={fullName} onChangeText={setFullName} />

            <Text style={s.label}>Âge</Text>
            <TextInput style={inputClass} placeholder="Ex : 28" placeholderTextColor="#555"
              keyboardType="numeric" value={age} onChangeText={setAge} />

            <Text style={s.label}>Sexe</Text>
            <View style={s.row}>
              {(['male', 'female'] as const).map(g => (
                <TouchableOpacity key={g} style={[s.chip, sex === g && s.chipActive]}
                  onPress={() => setSex(g)}>
                  <Text style={[s.chipText, sex === g && s.chipTextActive]}>
                    {g === 'male' ? 'Homme' : 'Femme'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Taille (cm)</Text>
            <TextInput style={inputClass} placeholder="Ex : 175" placeholderTextColor="#555"
              keyboardType="numeric" value={height} onChangeText={setHeight} />

            <Text style={s.label}>Poids (kg)</Text>
            <TextInput style={inputClass} placeholder="Ex : 70" placeholderTextColor="#555"
              keyboardType="numeric" value={weight} onChangeText={setWeight} />

            <TouchableOpacity style={s.btn} onPress={() => {
              if (!age || !height || !weight) { setError('Remplissez tous les champs.'); return }
              setError(''); setStep(2)
            }}>
              <Text style={s.btnText}>Suivant →</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={s.sectionTitle}>Niveau d'activité</Text>
            {ACTIVITY.map(a => (
              <TouchableOpacity key={a.key} style={[s.optionCard, activity === a.key && s.optionActive]}
                onPress={() => setActivity(a.key)}>
                <Text style={[s.optionLabel, activity === a.key && s.optionLabelActive]}>{a.label}</Text>
                <Text style={s.optionDesc}>{a.desc}</Text>
              </TouchableOpacity>
            ))}
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, s.btnSecondary, { flex: 1 }]} onPress={() => setStep(1)}>
                <Text style={s.btnSecondaryText}>← Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={() => setStep(3)}>
                <Text style={s.btnText}>Suivant →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={s.sectionTitle}>Objectif</Text>
            {GOALS.map(g => (
              <TouchableOpacity key={g.key} style={[s.optionCard, goal === g.key && s.optionActive]}
                onPress={() => setGoal(g.key)}>
                <Text style={[s.optionLabel, goal === g.key && s.optionLabelActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}

            <View style={s.calPreview}>
              <Text style={s.calPreviewLabel}>Objectif calorique estimé</Text>
              <Text style={s.calPreviewVal}>{calcCalories()} kcal/jour</Text>
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <View style={s.row}>
              <TouchableOpacity style={[s.btn, s.btnSecondary, { flex: 1 }]} onPress={() => setStep(2)}>
                <Text style={s.btnSecondaryText}>← Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={finish} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Terminer</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {error && step !== 3 ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 20, paddingBottom: 48 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  stepLabel: { color: '#555', fontSize: 12, marginBottom: 12 },
  stepBar: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  stepDot: { flex: 1, height: 3, backgroundColor: '#1E1E28', borderRadius: 2 },
  stepDotActive: { backgroundColor: '#2563eb' },
  sectionTitle: { color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  label: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#111118', borderWidth: 1, borderColor: '#2E2E3E',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#fff', fontSize: 14, marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#111118', borderWidth: 1, borderColor: '#2E2E3E',
  },
  chipActive: { backgroundColor: 'rgba(37,99,235,0.15)', borderColor: 'rgba(59,130,246,0.3)' },
  chipText: { color: '#555', fontSize: 14 },
  chipTextActive: { color: '#93c5fd' },
  optionCard: {
    backgroundColor: '#111118', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#2E2E3E', marginBottom: 10,
  },
  optionActive: { borderColor: 'rgba(59,130,246,0.4)', backgroundColor: 'rgba(37,99,235,0.08)' },
  optionLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
  optionLabelActive: { color: '#93c5fd' },
  optionDesc: { color: '#555', fontSize: 12, marginTop: 2 },
  calPreview: {
    backgroundColor: '#111118', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#22222E', alignItems: 'center', marginVertical: 16,
  },
  calPreviewLabel: { color: '#555', fontSize: 12, marginBottom: 4 },
  calPreviewVal: { color: '#93c5fd', fontSize: 28, fontWeight: '700' },
  error: { color: '#f87171', fontSize: 13, marginBottom: 12 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnSecondary: { backgroundColor: '#1E1E28', borderWidth: 1, borderColor: '#2E2E3E' },
  btnSecondaryText: { color: '#9CA3AF', fontSize: 14 },
})
