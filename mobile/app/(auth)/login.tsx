import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError('')

    const { error } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (await supabase.auth.getSession()).data.session?.user.id)
      .single()

    router.replace(profile ? '/(app)' : '/(onboarding)')
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.card}>
        <Text style={s.title}>CalTrack</Text>
        <Text style={s.subtitle}>nutrition · performance · résultats</Text>

        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, !isSignup && s.tabActive]}
            onPress={() => setIsSignup(false)}
          >
            <Text style={[s.tabText, !isSignup && s.tabTextActive]}>Connexion</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, isSignup && s.tabActive]}
            onPress={() => setIsSignup(true)}
          >
            <Text style={[s.tabText, isSignup && s.tabTextActive]}>Inscription</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor="#555"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={s.input}
          placeholder="Mot de passe"
          placeholderTextColor="#555"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{isSignup ? 'Créer mon compte' : 'Se connecter'}</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111118',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#2E2E3E',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    color: '#555',
    fontSize: 13,
    marginBottom: 24,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(37,99,235,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  tabText: {
    color: '#555',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#93c5fd',
  },
  input: {
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: '#2E2E3E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
})
