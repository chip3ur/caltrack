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
  const [mode, setMode] = useState<'idle' | 'camera' | 'result'>('idle')
  const [barcode, setBarcode] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [product, setProduct] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState(100)
  const [mealType, setMealType] = useState('dejeuner')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrRef = useRef<unknown>(null)

  useEffect(() => {
  return () => {
    stopCamera()
  }
}, [])

  async function stopCamera() {
    if (html5QrRef.current) {
      try {
        const scanner = html5QrRef.current as { stop: () => Promise<void> }
        await scanner.stop()
      } catch {}
      html5QrRef.current = null
    }
  }

  async function startCamera() {
    setMode('camera')
    setError('')
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('qr-reader')
        html5QrRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 100 } },
          async (code: string) => {
            await stopCamera()
            setBarcode(code)
            await fetchProduct(code)
          },
          () => {}
        )
      } catch {
        setError('Caméra non disponible. Saisissez le code manuellement.')
        setMode('idle')
      }
    }, 100)
  }

  async function fetchProduct(code: string) {
    setLoading(true)
    setError('')
    setProduct(null)

    const { data: existing } = await supabase
      .from('foods')
      .select('*')
      .eq('barcode', code)
      .single()

    if (existing) {
      setProduct(existing)
      setMode('result')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      const data = await res.json()
      if (data.status === 1) {
        const p = data.product
        const nutriments = p.nutriments ?? {}
        const food: Omit<Food, 'id'> & { barcode: string } = {
          name: p.product_name || p.product_name_fr || 'Produit inconnu',
          calories_per_100g: Math.round(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0),
          protein_per_100g: Math.round((nutriments.proteins_100g ?? 0) * 10) / 10,
          carbs_per_100g: Math.round((nutriments.carbohydrates_100g ?? 0) * 10) / 10,
          fat_per_100g: Math.round((nutriments.fat_100g ?? 0) * 10) / 10,
          barcode: code,
        }
        const { data: saved } = await supabase.from('foods').insert(food).select().single()
        setProduct(saved ?? { ...food, id: '' })
        setMode('result')
      } else {
        setError('Produit non trouvé. Ajoutez-le manuellement.')
        setMode('idle')
      }
    } catch {
      setError('Erreur réseau. Réessayez.')
      setMode('idle')
    }
    setLoading(false)
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
    })
    setSuccess(`${product.name} ajouté — ${cal} kcal`)
    setProduct(null)
    setMode('idle')
    setBarcode('')
    setManualCode('')
    setTimeout(() => setSuccess(''), 3000)
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
          {/* SCANNER */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Code-barres</p>

            {mode !== 'camera' && (
              <>
                <div className="w-full h-32 bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl flex flex-col items-center justify-center mb-3 relative overflow-hidden">
                  <div className="absolute w-3/4 h-0.5 bg-blue-500 opacity-60" style={{animation:'scan 2s ease-in-out infinite', top:'40%'}}/>
                  <style>{`@keyframes scan{0%{top:30%}50%{top:70%}100%{top:30%}}`}</style>
                  <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-yellow-500 rounded-tl"/>
                  <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-yellow-500 rounded-tr"/>
                  <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-yellow-500 rounded-bl"/>
                  <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-yellow-500 rounded-br"/>
                  <p className="text-xs text-gray-500 z-10">Caméra ou saisie manuelle</p>
                </div>
                <div className="flex gap-2 mb-3">
                  <button onClick={startCamera}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-medium">
                    Utiliser la caméra
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    placeholder="Code-barres (ex: 3017624010701)"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchProduct(manualCode)}
                    className={inputClass}
                  />
                  <button onClick={() => fetchProduct(manualCode)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl text-sm">
                    →
                  </button>
                </div>
              </>
            )}

            {mode === 'camera' && (
              <div>
                <div id="qr-reader" className="rounded-xl overflow-hidden w-full"/>
                <button onClick={() => { stopCamera(); setMode('idle') }}
                  className="w-full mt-3 border border-[var(--border-input)] text-gray-400 py-2 rounded-xl text-sm">
                  Annuler
                </button>
              </div>
            )}

            {loading && <p className="text-sm text-gray-500 mt-3 text-center">Recherche du produit...</p>}
            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
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
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Produit trouvé</p>
                  <p className="text-base font-medium text-[var(--text-primary)]">{product.name}</p>
                  {barcode && <p className="text-xs text-gray-500 mt-1">Code : {barcode || manualCode}</p>}
                </div>
                <span className="text-xs text-green-300 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full">
                  Open Food Facts
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Calories', value: `${product.calories_per_100g}`, unit: 'kcal' },
                  { label: 'Protéines', value: `${product.protein_per_100g}g`, unit: '/100g' },
                  { label: 'Glucides', value: `${product.carbs_per_100g}g`, unit: '/100g' },
                  { label: 'Lipides', value: `${product.fat_per_100g}g`, unit: '/100g' },
                ].map(s => (
                  <div key={s.label} className="bg-[var(--bg-input)] rounded-xl p-3 text-center">
                    <p className="text-sm font-medium text-yellow-500">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium">
                Ajouter au journal
              </button>
              <button onClick={() => { setProduct(null); setMode('idle') }}
                className="w-full mt-2 border border-[var(--border-input)] text-gray-400 py-2 rounded-xl text-sm">
                Scanner un autre produit
              </button>
            </div>
          ) : (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 flex flex-col items-center justify-center h-full min-h-48">
              <p className="text-sm text-gray-500 text-center">Scannez ou saisissez un code-barres pour voir les infos nutritionnelles.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
