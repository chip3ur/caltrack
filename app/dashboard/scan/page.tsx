'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Food = {
  id: string
  name: string
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

export default function ScanPage() {
  const [mode, setMode] = useState<'idle' | 'camera' | 'fetching' | 'result'>('idle')
  const [barcode, setBarcode] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [product, setProduct] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState(100)
  const [mealType, setMealType] = useState('dejeuner')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const html5QrRef = useRef<unknown>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopCamera() }
  }, [])

  // Start scanner after DOM renders #qr-reader div (useEffect runs post-render)
  useEffect(() => {
    if (mode !== 'camera') return
    let cancelled = false

    async function init() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode('qr-reader', {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        })
        html5QrRef.current = scanner

        const onDetect = async (code: string) => {
          if (cancelled) return
          cancelled = true
          await stopCamera()
          setBarcode(code)
          setMode('fetching')
          await fetchProduct(code)
        }

        const scanConfig = { fps: 15, qrbox: { width: 280, height: 100 } }

        // Try with continuous autofocus first, fallback to plain environment camera
        try {
          await scanner.start(
            { facingMode: 'environment', advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet] },
            scanConfig,
            onDetect,
            () => {}
          )
        } catch {
          await scanner.start(
            { facingMode: 'environment' },
            scanConfig,
            onDetect,
            () => {}
          )
        }
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message.toLowerCase() : ''
        if (msg.includes('permission') || msg.includes('notallowed')) {
          setError('Permission caméra refusée. Autorisez l\'accès dans les paramètres du navigateur.')
        } else if (msg.includes('notfound') || msg.includes('no camera') || msg.includes('devices')) {
          setError('Aucune caméra détectée sur cet appareil.')
        } else if (msg.includes('https') || msg.includes('secure')) {
          setError('Le scan nécessite une connexion HTTPS.')
        } else {
          setError('Caméra non disponible. Saisissez le code manuellement.')
        }
        setMode('idle')
      }
    }

    init()
    return () => { cancelled = true }
  }, [mode])

  async function stopCamera() {
    if (html5QrRef.current) {
      try {
        const scanner = html5QrRef.current as { stop: () => Promise<void>; clear: () => void }
        await scanner.stop()
        scanner.clear()
      } catch {}
      html5QrRef.current = null
    }
  }

  function startCamera() {
    setError('')
    setProduct(null)
    setBarcode('')
    setMode('camera')
  }

  async function fetchProduct(code: string) {
    setError('')
    setProduct(null)

    // Check local DB first
    const { data: existing } = await supabase
      .from('foods')
      .select('*')
      .eq('barcode', code)
      .single()

    if (existing) {
      setProduct(existing)
      setMode('result')
      return
    }

    // Fetch from Open Food Facts
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      if (!res.ok) throw new Error('network')
      const data = await res.json()

      if (data.status !== 1) {
        setError(`Produit non trouvé (code : ${code}). Saisissez les infos manuellement.`)
        setMode('idle')
        return
      }

      const p = data.product
      const n = p.nutriments ?? {}
      const name =
        p.product_name_fr ||
        p.product_name ||
        p.generic_name_fr ||
        p.generic_name ||
        'Produit inconnu'

      const food: Omit<Food, 'id'> & { barcode: string } = {
        name: name.trim().slice(0, 100),
        calories_per_100g: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? n['energy_100g'] ? (n['energy_100g'] / 4.184) : 0),
        protein_per_100g: Math.round((n.proteins_100g ?? 0) * 10) / 10,
        carbs_per_100g: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
        fat_per_100g: Math.round((n.fat_100g ?? 0) * 10) / 10,
        barcode: code,
      }

      // Save to local DB for next time
      const { data: saved } = await supabase.from('foods').insert(food).select().single()
      setProduct(saved ?? { ...food, id: '' })
      setMode('result')
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.')
      setMode('idle')
    }
  }

  async function addToJournal() {
    if (!product) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const cal = Math.round(product.calories_per_100g * quantity / 100)
    await supabase.from('meals').insert({
      user_id: session.user.id,
      food_name: product.name,
      food_id: product.id || null,
      quantity_g: quantity,
      calories: cal,
      meal_type: mealType,
      eaten_at: new Date().toISOString(),
    })
    setSuccess(`${product.name} ajouté — ${cal} kcal`)
    setProduct(null)
    setMode('idle')
    setBarcode('')
    setManualCode('')
    setTimeout(() => setSuccess(''), 4000)
  }

  const inputClass = "w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl px-4 py-3 text-[var(--text-primary)] text-sm outline-none focus:border-blue-500/50"
  const cal = product ? Math.round(product.calories_per_100g * quantity / 100) : 0

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Ajouter</p>
        <h1 className="text-2xl font-serif text-[var(--text-primary)] mt-1">Scanner un produit</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Code-barres</p>

            {/* IDLE — placeholder + boutons */}
            {mode === 'idle' && (
              <>
                <div className="w-full h-32 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl flex flex-col items-center justify-center mb-3 relative overflow-hidden">
                  <div className="absolute w-3/4 h-0.5 bg-blue-500 opacity-60" style={{ animation: 'scan 2s ease-in-out infinite', top: '40%' }}/>
                  <style>{`@keyframes scan{0%{top:30%}50%{top:70%}100%{top:30%}}`}</style>
                  <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-yellow-500 rounded-tl"/>
                  <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-yellow-500 rounded-tr"/>
                  <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-yellow-500 rounded-bl"/>
                  <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-yellow-500 rounded-br"/>
                  <p className="text-xs text-gray-500 z-10">Caméra ou saisie manuelle</p>
                </div>
                <button onClick={startCamera}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium mb-3">
                  Utiliser la caméra
                </button>
                <div className="flex gap-2">
                  <input
                    placeholder="Code-barres (ex: 3017624010701)"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && manualCode.length > 5 && fetchProduct(manualCode)}
                    className={inputClass}
                  />
                  <button
                    onClick={() => fetchProduct(manualCode)}
                    disabled={manualCode.length < 6}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 rounded-xl text-sm"
                  >
                    →
                  </button>
                </div>
              </>
            )}

            {/* CAMERA ACTIVE */}
            {mode === 'camera' && (
              <div>
                <p className="text-xs text-gray-500 mb-2 text-center">Pointez la caméra vers le code-barres</p>
                <div id="qr-reader" className="rounded-xl overflow-hidden w-full"/>
                <button onClick={() => { stopCamera(); setMode('idle') }}
                  className="w-full mt-3 border border-[var(--border-input)] text-gray-400 py-2 rounded-xl text-sm hover:text-[var(--text-primary)]">
                  Annuler
                </button>
              </div>
            )}

            {/* FETCHING */}
            {mode === 'fetching' && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                <p className="text-sm text-gray-500">Recherche du produit...</p>
                <p className="text-xs text-gray-600 font-mono">{barcode}</p>
              </div>
            )}

            {error && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-red-400">{error}</p>
                <button onClick={startCamera} className="text-xs text-blue-400 hover:underline mt-1">
                  Réessayer la caméra
                </button>
              </div>
            )}
          </div>

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-400">
              ✓ {success}
            </div>
          )}
        </div>

        {/* RÉSULTAT */}
        <div>
          {product && mode === 'result' ? (
            <div className="bg-[var(--bg-card)] border border-yellow-600/20 rounded-xl p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 mr-3">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Produit trouvé</p>
                  <p className="text-base font-medium text-[var(--text-primary)] leading-snug">{product.name}</p>
                  {barcode && <p className="text-xs text-gray-500 mt-1 font-mono">{barcode}</p>}
                </div>
                <span className="text-xs text-green-300 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                  Open Food Facts
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Calories', value: `${product.calories_per_100g}`, unit: 'kcal/100g', color: 'text-yellow-500' },
                  { label: 'Protéines', value: `${product.protein_per_100g}g`, unit: '/100g', color: 'text-blue-300' },
                  { label: 'Glucides', value: `${product.carbs_per_100g}g`, unit: '/100g', color: 'text-yellow-400' },
                  { label: 'Lipides', value: `${product.fat_per_100g}g`, unit: '/100g', color: 'text-orange-400' },
                ].map(s => (
                  <div key={s.label} className="bg-[var(--bg-input)] rounded-xl p-3 text-center">
                    <p className={`text-sm font-medium ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Quantité (g)</label>
                <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className={inputClass}/>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-500 uppercase tracking-widest block mb-1">Type de repas</label>
                <select value={mealType} onChange={e => setMealType(e.target.value)} className={inputClass}>
                  <option value="petit-dejeuner">Petit-déjeuner</option>
                  <option value="dejeuner">Déjeuner</option>
                  <option value="gouter">Goûter</option>
                  <option value="diner">Dîner</option>
                </select>
              </div>
              <p className="text-3xl font-serif text-yellow-500 text-center my-3">{cal} kcal</p>
              <button onClick={addToJournal}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium mb-2">
                Ajouter au journal
              </button>
              <button onClick={() => { setProduct(null); setMode('idle') }}
                className="w-full border border-[var(--border-input)] text-gray-400 hover:text-[var(--text-primary)] py-2 rounded-xl text-sm">
                Scanner un autre produit
              </button>
            </div>
          ) : mode !== 'fetching' ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 flex flex-col items-center justify-center h-full min-h-48 gap-2">
              <p className="text-3xl opacity-20">▦</p>
              <p className="text-sm text-gray-500 text-center">Scannez ou saisissez un code-barres pour voir les infos nutritionnelles.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
