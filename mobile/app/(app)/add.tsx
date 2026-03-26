import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

export default function AddScreen() {
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!name || !calories) {
      Alert.alert('Champs requis', 'Le nom et les calories sont obligatoires.')
      return
    }
    setLoading(true)
    const user = (await supabase.auth.getSession()).data.session?.user
    if (!user) return

    const { error } = await supabase.from('meals').insert({
      user_id: user.id,
      name,
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    })

    if (error) {
      Alert.alert('Erreur', error.message)
    } else {
      Alert.alert('Ajouté !', `${name} ajouté avec succès.`)
      setName('')
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <Text style={s.heading}>Ajouter un repas</Text>

          <Text style={s.label}>Nom de l'aliment *</Text>
          <TextInput
            style={s.input}
            placeholder="Ex : Poulet grillé"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
          />

          <Text style={s.label}>Calories *</Text>
          <TextInput
            style={s.input}
            placeholder="Ex : 250"
            placeholderTextColor="#555"
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
          />

          <Text style={s.sectionTitle}>Macronutriments (optionnel)</Text>

          <View style={s.macroRow}>
            <View style={s.macroField}>
              <Text style={s.label}>Protéines (g)</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={protein}
                onChangeText={setProtein}
              />
            </View>
            <View style={s.macroField}>
              <Text style={s.label}>Glucides (g)</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={carbs}
                onChangeText={setCarbs}
              />
            </View>
            <View style={s.macroField}>
              <Text style={s.label}>Lipides (g)</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={fat}
                onChangeText={setFat}
              />
            </View>
          </View>

          <TouchableOpacity style={s.btn} onPress={handleAdd} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Ajouter</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 20 },
  label: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#111118', borderWidth: 1, borderColor: '#2E2E3E',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#fff', fontSize: 14, marginBottom: 16,
  },
  sectionTitle: {
    color: '#6B7280', fontSize: 12, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 12, marginTop: 4,
  },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroField: { flex: 1 },
  btn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
