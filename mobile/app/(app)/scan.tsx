import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, Camera } from 'expo-camera'
import { supabase } from '../../lib/supabase'

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted')
    })
  }, [])

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || loading) return
    setScanned(true)
    setLoading(true)

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`)
      const json = await res.json()

      if (json.status !== 1 || !json.product) {
        Alert.alert('Produit non trouvé', 'Ce code-barres n\'est pas dans la base de données.', [
          { text: 'Réessayer', onPress: () => setScanned(false) }
        ])
        setLoading(false)
        return
      }

      const p = json.product
      const nutriments = p.nutriments ?? {}
      const name = p.product_name || p.product_name_fr || 'Produit inconnu'
      const calories = Math.round(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0)
      const protein = Math.round(nutriments.proteins_100g ?? 0)
      const carbs = Math.round(nutriments.carbohydrates_100g ?? 0)
      const fat = Math.round(nutriments.fat_100g ?? 0)

      Alert.alert(
        name,
        `${calories} kcal · P: ${protein}g · G: ${carbs}g · L: ${fat}g\n\nAjouter ce produit ?`,
        [
          { text: 'Annuler', onPress: () => setScanned(false), style: 'cancel' },
          {
            text: 'Ajouter',
            onPress: async () => {
              const user = (await supabase.auth.getSession()).data.session?.user
              if (!user) return
              await supabase.from('meals').insert({
                user_id: user.id, name, calories, protein, carbs, fat,
              })
              Alert.alert('Ajouté !', `${name} ajouté à votre journal.`)
              setScanned(false)
            }
          }
        ]
      )
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer les informations.', [
        { text: 'Réessayer', onPress: () => setScanned(false) }
      ])
    }
    setLoading(false)
  }

  if (hasPermission === null) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    )
  }

  if (!hasPermission) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.permText}>Accès à la caméra refusé.</Text>
        <Text style={s.permSub}>Activez la caméra dans les réglages.</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.heading}>Scanner un produit</Text>
      <View style={s.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        />
        <View style={s.overlay}>
          <View style={s.frame} />
        </View>
        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={s.loadingText}>Recherche en cours...</Text>
          </View>
        )}
      </View>
      <Text style={s.hint}>Placez le code-barres dans le cadre</Text>
      {scanned && !loading && (
        <TouchableOpacity style={s.resetBtn} onPress={() => setScanned(false)}>
          <Text style={s.resetText}>Scanner à nouveau</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', padding: 16 },
  cameraWrap: { flex: 1, overflow: 'hidden', borderRadius: 16, margin: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 160,
    borderWidth: 2,
    borderColor: '#2563eb',
    borderRadius: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#fff', fontSize: 14 },
  hint: { color: '#555', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  permText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  permSub: { color: '#555', fontSize: 13, marginTop: 8 },
  resetBtn: {
    margin: 16,
    backgroundColor: '#1E1E28',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E2E3E',
  },
  resetText: { color: '#93c5fd', fontSize: 14 },
})
