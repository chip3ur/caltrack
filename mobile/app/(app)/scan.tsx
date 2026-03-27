import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, Camera } from 'expo-camera'
import { supabase } from '../../lib/supabase'
import { useColors, type Colors } from '../../lib/theme'

type Food = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

const MEAL_TYPES = [
  { key: 'petit-dejeuner', label: 'Petit-déjeuner' },
  { key: 'dejeuner', label: 'Déjeuner' },
  { key: 'gouter', label: 'Goûter' },
  { key: 'diner', label: 'Dîner' },
]

export default function ScanScreen() {
  const c = useColors()
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [mealType, setMealType] = useState('dejeuner')
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted')
    })
  }, [])

  async function fetchProduct(code: string) {
    setLoading(true)
    const { data: existing } = await supabase.from('foods').select('*').eq('barcode', code).single()
    if (existing) { setProduct(existing); setLoading(false); return }

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      const json = await res.json()
      if (json.status !== 1 || !json.product) {
        Alert.alert('Produit non trouvé', `Code : ${code}\nSaisissez les infos manuellement dans l'onglet Ajouter.`, [{ text: 'OK', onPress: () => setScanned(false) }])
        setLoading(false)
        return
      }
      const p = json.product
      const n = p.nutriments ?? {}
      const name = p.product_name_fr || p.product_name || p.generic_name_fr || p.generic_name || 'Produit inconnu'
      const food = {
        name: name.trim().slice(0, 100),
        calories_per_100g: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
        protein_per_100g: Math.round((n.proteins_100g ?? 0) * 10) / 10,
        carbs_per_100g: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
        fat_per_100g: Math.round((n.fat_100g ?? 0) * 10) / 10,
        barcode: code,
      }
      const { data: saved } = await supabase.from('foods').insert(food).select().single()
      setProduct(saved ?? { ...food, id: '' })
    } catch {
      Alert.alert('Erreur réseau', 'Vérifiez votre connexion.', [{ text: 'Réessayer', onPress: () => setScanned(false) }])
    }
    setLoading(false)
  }

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || loading) return
    setScanned(true)
    await fetchProduct(data)
  }

  async function addToJournal() {
    if (!product) return
    const qty = Number(quantity) || 100
    const cal = Math.round(product.calories_per_100g * qty / 100)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setLoading(true)
    const { error } = await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: product.name,
      food_id: product.id || null,
      quantity_g: qty,
      calories: cal,
      meal_type: mealType,
      eaten_at: new Date().toISOString(),
    })
    if (error) Alert.alert('Erreur', error.message)
    else {
      Alert.alert('Ajouté !', `${product.name} — ${cal} kcal`)
      setProduct(null); setScanned(false); setQuantity('100'); setManualCode('')
    }
    setLoading(false)
  }

  const s = makeStyles(c)

  if (hasPermission === null) {
    return <SafeAreaView style={s.center}><ActivityIndicator color={c.accent} /></SafeAreaView>
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.heading}>Scanner un produit</Text>

          {!product && (
            <>
              <View style={s.cameraWrap}>
                <CameraView
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  facing="back"
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
                />
                <View style={s.overlay}>
                  <View style={s.frameCornerTL} /><View style={s.frameCornerTR} />
                  <View style={s.frameCornerBL} /><View style={s.frameCornerBR} />
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
              <Text style={s.orLabel}>— ou saisir le code manuellement —</Text>
              <View style={s.manualRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Code-barres (ex: 3017624010701)"
                  placeholderTextColor={c.placeholder}
                  keyboardType="numeric"
                  value={manualCode}
                  onChangeText={setManualCode}
                />
                <TouchableOpacity
                  style={[s.manualBtn, manualCode.length < 6 && s.manualBtnDisabled]}
                  onPress={() => { setScanned(true); fetchProduct(manualCode) }}
                  disabled={manualCode.length < 6 || loading}
                >
                  <Text style={s.manualBtnText}>→</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {product && (
            <View style={s.resultCard}>
              <Text style={s.productName}>{product.name}</Text>
              <View style={s.macroGrid}>
                {[
                  { label: 'Calories', val: `${product.calories_per_100g}`, color: '#fbbf24' },
                  { label: 'Protéines', val: `${product.protein_per_100g}g`, color: '#93c5fd' },
                  { label: 'Glucides', val: `${product.carbs_per_100g}g`, color: '#fbbf24' },
                  { label: 'Lipides', val: `${product.fat_per_100g}g`, color: '#fb923c' },
                ].map(m => (
                  <View key={m.label} style={s.macroCard}>
                    <Text style={[s.macroVal, { color: m.color }]}>{m.val}</Text>
                    <Text style={s.macroLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={s.fieldLabel}>Quantité (g)</Text>
              <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholderTextColor={c.placeholder} />

              <Text style={s.fieldLabel}>Type de repas</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mealTypeScroll}>
                {MEAL_TYPES.map(mt => (
                  <TouchableOpacity key={mt.key}
                    style={[s.mealTypeChip, mealType === mt.key && s.mealTypeActive]}
                    onPress={() => setMealType(mt.key)}>
                    <Text style={[s.mealTypeText, mealType === mt.key && s.mealTypeTextActive]}>{mt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.preview}>
                {Math.round(product.calories_per_100g * (Number(quantity) || 100) / 100)} kcal
              </Text>

              <TouchableOpacity style={s.addBtn} onPress={addToJournal} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.addBtnText}>Ajouter au journal</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.resetBtn} onPress={() => { setProduct(null); setScanned(false) }}>
                <Text style={s.resetText}>Scanner un autre produit</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const CORNER = 20
function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 48 },
    heading: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
    cameraWrap: { height: 240, borderRadius: 16, overflow: 'hidden', marginBottom: 8, position: 'relative' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    frameCornerTL: { position: 'absolute', top: 40, left: 40, width: CORNER, height: CORNER, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#fbbf24', borderTopLeftRadius: 4 },
    frameCornerTR: { position: 'absolute', top: 40, right: 40, width: CORNER, height: CORNER, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#fbbf24', borderTopRightRadius: 4 },
    frameCornerBL: { position: 'absolute', bottom: 40, left: 40, width: CORNER, height: CORNER, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#fbbf24', borderBottomLeftRadius: 4 },
    frameCornerBR: { position: 'absolute', bottom: 40, right: 40, width: CORNER, height: CORNER, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#fbbf24', borderBottomRightRadius: 4 },
    loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: '#fff', fontSize: 14 },
    hint: { color: c.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
    orLabel: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginVertical: 12 },
    manualRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    input: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.borderAlt,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
      color: c.text, fontSize: 14, marginBottom: 12,
    },
    manualBtn: { backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
    manualBtnDisabled: { opacity: 0.4 },
    manualBtnText: { color: '#fff', fontSize: 18 },
    resetBtn: { backgroundColor: c.cardAlt, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: c.borderAlt, marginTop: 8 },
    resetText: { color: c.accentText, fontSize: 14 },
    resultCard: { backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border },
    productName: { color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
    macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    macroCard: { flex: 1, minWidth: '45%', backgroundColor: c.cardAlt, borderRadius: 10, padding: 12, alignItems: 'center' },
    macroVal: { fontSize: 16, fontWeight: '700' },
    macroLabel: { color: c.textDim, fontSize: 11, marginTop: 2 },
    fieldLabel: { color: c.textSub, fontSize: 12, marginBottom: 6 },
    mealTypeScroll: { marginBottom: 12 },
    mealTypeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.borderAlt },
    mealTypeActive: { backgroundColor: c.accentLight, borderColor: c.accentBorder },
    mealTypeText: { color: c.textDim, fontSize: 13 },
    mealTypeTextActive: { color: c.accentText },
    preview: { color: '#fbbf24', fontSize: 28, fontWeight: '700', textAlign: 'center', marginVertical: 12 },
    addBtn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 8 },
    addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    permText: { color: c.text, fontSize: 16, fontWeight: '600' },
    permSub: { color: c.textDim, fontSize: 13, marginTop: 8 },
  })
}
