'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [form, setForm] = useState({
    full_name: '',
    age: '',
    sex: 'homme',
    height_cm: '',
    weight_kg: '',
    activity_level: 'leger',
    goal: 'perte',
  })

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors([])
  }

  function validateStep1() {
    const e: string[] = []
    if (!form.full_name.trim()) e.push('Prénom requis')
    if (!form.age || parseInt(form.age) < 10 || parseInt(form.age) > 120) e.push('Âge invalide (10–120)')
    if (!form.height_cm || parseInt(form.height_cm) < 100 || parseInt(form.height_cm) > 250) e.push('Taille invalide (100–250 cm)')
    if (!form.weight_kg || parseFloat(form.weight_kg) < 30 || parseFloat(form.weight_kg) > 300) e.push('Poids invalide (30–300 kg)')
    setErrors(e)
    return e.length === 0
  }

  function calculateCalories() {
    const age = parseInt(form.age)
    const h = parseInt(form.height_cm)
    const w = parseFloat(form.weight_kg)
    const bmr = form.sex === 'homme'
      ? 10 * w + 6.25 * h - 5 * age + 5
      : 10 * w + 6.25 * h - 5 * age - 161
    const factors: Record<string, number> = {
      sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725
    }
    const tdee = Math.round(bmr * factors[form.activity_level])
    const goals: Record<string, number> = {
      perte: -500, maintien: 0, masse: 300
    }
    return tdee + goals[form.goal]
  }

  async function handleSubmit() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')

    const daily_calories = calculateCalories()

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      full_name: form.full_name,
      age: parseInt(form.age),
      sex: form.sex,
      height_cm: parseInt(form.height_cm),
      weight_kg: parseFloat(form.weight_kg),
      activity_level: form.activity_level,
      goal: form.goal,
      daily_calories,
    })

    if (error) { console.error(error); setLoading(false); return }
    router.push('/dashboard')
  }

  const inputClass = "w-full bg-[#1E1E28] border border-[#2E2E3E] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50"
  const selectClass = "w-full bg-[#1E1E28] border border-[#2E2E3E] rounded-xl px-4 py-3 text-white text-sm outline-none"

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111118] border border-[#2E2E3E] rounded-2xl p-8">

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 rounded-full transition-all ${s === step ? 'flex-1 bg-blue-500' : s < step ? 'w-8 bg-blue-500/40' : 'w-8 bg-[#2E2E3E]'}`}/>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-xl font-serif text-white mb-1">Votre profil</h2>
            <p className="text-sm text-gray-500 mb-6">Quelques infos pour personnaliser votre expérience.</p>
            <div className="space-y-3">
              <input
                placeholder="Votre prénom"
                value={form.full_name}
                onChange={e => update('full_name', e.target.value)}
                className={inputClass}
              />
              <div className="flex gap-3">
                <input
                  placeholder="Âge"
                  type="number"
                  value={form.age}
                  onChange={e => update('age', e.target.value)}
                  className={inputClass}
                />
                <select value={form.sex} onChange={e => update('sex', e.target.value)} className={selectClass}>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                </select>
              </div>
              <div className="flex gap-3">
                <input
                  placeholder="Taille (cm)"
                  type="number"
                  value={form.height_cm}
                  onChange={e => update('height_cm', e.target.value)}
                  className={inputClass}
                />
                <input
                  placeholder="Poids (kg)"
                  type="number"
                  value={form.weight_kg}
                  onChange={e => update('weight_kg', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {errors.length > 0 && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                {errors.map(e => (
                  <p key={e} className="text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}

            <button
              onClick={() => { if (validateStep1()) setStep(2) }}
              className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium">
              Continuer →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-serif text-white mb-1">Activité physique</h2>
            <p className="text-sm text-gray-500 mb-6">Votre niveau habituel.</p>
            <div className="space-y-2">
              {[
                { value: 'sedentaire', label: 'Sédentaire', sub: 'Peu ou pas d\'exercice' },
                { value: 'leger', label: 'Légèrement actif', sub: 'Sport 1–3 fois / semaine' },
                { value: 'modere', label: 'Modérément actif', sub: 'Sport 3–5 fois / semaine' },
                { value: 'actif', label: 'Très actif', sub: 'Sport intense 6–7 fois / semaine' },
              ].map(opt => (
                <div key={opt.value} onClick={() => update('activity_level', opt.value)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${form.activity_level === opt.value ? 'border-blue-500/50 bg-blue-600/10' : 'border-[#2E2E3E] bg-[#1E1E28] hover:border-[#3E3E4E]'}`}>
                  <p className="text-sm font-medium text-white">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.sub}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 border border-[#2E2E3E] text-gray-400 py-3 rounded-xl text-sm">← Retour</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-medium">Continuer →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-serif text-white mb-1">Votre objectif</h2>
            <p className="text-sm text-gray-500 mb-4">On ajuste vos calories en fonction.</p>
            <div className="bg-[#1E1E28] border border-yellow-600/20 rounded-xl p-4 text-center mb-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Besoin journalier estimé</p>
              <p className="text-3xl font-serif text-yellow-500">
                {form.age && form.height_cm && form.weight_kg ? calculateCalories().toLocaleString() : '—'} kcal
              </p>
            </div>
            <div className="space-y-2">
              {[
                { value: 'perte', label: 'Perdre du poids', sub: 'Déficit 500 kcal · ~0.5 kg/semaine' },
                { value: 'maintien', label: 'Maintenir mon poids', sub: 'Équilibre calorique' },
                { value: 'masse', label: 'Prendre de la masse', sub: 'Surplus 300 kcal' },
              ].map(opt => (
                <div key={opt.value} onClick={() => update('goal', opt.value)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${form.goal === opt.value ? 'border-blue-500/50 bg-blue-600/10' : 'border-[#2E2E3E] bg-[#1E1E28] hover:border-[#3E3E4E]'}`}>
                  <p className="text-sm font-medium text-white">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.sub}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="flex-1 border border-[#2E2E3E] text-gray-400 py-3 rounded-xl text-sm">← Retour</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium">
                {loading ? 'Sauvegarde...' : 'Commencer !'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}