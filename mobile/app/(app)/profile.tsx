import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function ProfileScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [caloriesGoal, setCaloriesGoal] = useState('2000')
  const [proteinGoal, setProteinGoal] = useState('150')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    const session = (await supabase.auth.getSession()).data.session
    if (!session) return
    setEmail(session.user.email ?? '')

    const { data } = await supabase
      .from('profiles')
      .select('calories_goal, protein_goal')
      .eq('id', session.user.id)
      .single()

    if (data) {
      if (data.calories_goal) setCaloriesGoal(String(data.calories_goal))
      if (data.protein_goal) setProteinGoal(String(data.protein_goal))
    }
    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    const user = (await supabase.auth.getSession()).data.session?.user
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        calories_goal: Number(caloriesGoal),
        protein_goal: Number(proteinGoal),
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
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.heading}>Profil</Text>

        <View style={s.emailCard}>
          <Text style={s.emailLabel}>Compte</Text>
          <Text style={s.email}>{email}</Text>
        </View>

        <Text style={s.sectionTitle}>Objectifs nutritionnels</Text>

        <Text style={s.label}>Calories / jour</Text>
        <TextInput
          style={s.input}
          value={caloriesGoal}
          onChangeText={setCaloriesGoal}
          keyboardType="numeric"
          placeholderTextColor="#555"
        />

        <Text style={s.label}>Protéines / jour (g)</Text>
        <TextInput
          style={s.input}
          value={proteinGoal}
          onChangeText={setProteinGoal}
          keyboardType="numeric"
          placeholderTextColor="#555"
        />

        <TouchableOpacity style={s.saveBtn} onPress={saveProfile} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>Sauvegarder</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 20 },
  emailCard: {
    backgroundColor: '#111118', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#22222E', marginBottom: 24,
  },
  emailLabel: { color: '#555', fontSize: 11, marginBottom: 4 },
  email: { color: '#fff', fontSize: 14 },
  sectionTitle: {
    color: '#6B7280', fontSize: 12, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 16,
  },
  label: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#111118', borderWidth: 1, borderColor: '#2E2E3E',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#fff', fontSize: 14, marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 4, marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  logoutText: { color: '#f87171', fontSize: 15 },
})
