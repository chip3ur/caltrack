'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  full_name: string
  age: number
  sex: string
  height_cm: number
  weight_kg: number
  activity_level: string
  goal: string
  daily_calories: number
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setEmail(session.user.email ?? '')
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (data) { setProfile(data); setForm(data) }
  }

  function update(key: keyof Profile, value: string | number) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function calculateCalories(f: Profile) {
    const bmr = f.sex === 'homme'
      ? 10 * f.weight_kg + 6.25 * f.height_cm - 5 * f.age + 5
      : 10 * f.weight_kg + 6.25 * f.height_cm - 5 * f.age - 161
    const factors: Record<string, number> = {
      sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725
    }
    const tdee = Math.round(bmr * (factors[f.activity_level] ?? 1.375))
    const goals: Record<string, number> = { perte: -500, maintien: 0, masse: 300 }
    return tdee + (goals[f.goal] ?? 0)
  }

  async function save() {
    if (!form) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const daily_calories = calculateCalories(form)
    const { error } = await supabase.from('profiles').update({
      ...form,
      daily_calories,
    }).eq('id', session.user.id)

    if (!error) {
      setSuccess('Profil mis à jour !')
      setProfile({ ...form, daily_calories })
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inputClass = "w-full bg-[#1E1E28] border border-[#2E2E3E] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/50"

  if (!form) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Chargement...</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest">Compte</p>
        <h1 className="text-2xl font-serif text-white mt-1">Mon profil</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* INFOS PERSONNELLES */}
        <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Informations personnelles</p>

          <div className="mb-3">
            <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Email</label>
            <input value={email} disabled className={`${inputClass} opacity-50 cursor-not-allowed`}/>
          </div>

          <div className="mb-3">
            <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Prénom</label>
            <input value={form.full_name} onChange={e => update('full_name', e.target.value)} className={inputClass}/>
          </div>

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Âge</label>
              <input type="number" value={form.age} onChange={e => update('age', parseInt(e.target.value))} className={inputClass}/>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Sexe</label>
              <select value={form.sex} onChange={e => update('sex', e.target.value)} className={inputClass}>
                <option value="homme">Homme</option>
                <option value="femme">Femme</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Taille (cm)</label>
              <input type="number" value={form.height_cm} onChange={e => update('height_cm', parseInt(e.target.value))} className={inputClass}/>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Poids (kg)</label>
              <input type="number" step="0.1" value={form.weight_kg || ''} onChange={e => update('weight_kg', parseFloat(e.target.value) || 0)} className={inputClass}/>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          {success && <p className="text-sm text-green-400 mt-3 text-center">✓ {success}</p>}
        </div>

        <div>
          {/* OBJECTIF & ACTIVITÉ */}
          <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5 mb-4">
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Objectif & activité</p>

            <div className="mb-3">
              <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Niveau d'activité</label>
              <select value={form.activity_level} onChange={e => update('activity_level', e.target.value)} className={inputClass}>
                <option value="sedentaire">Sédentaire</option>
                <option value="leger">Légèrement actif (1–3x/sem)</option>
                <option value="modere">Modérément actif (3–5x/sem)</option>
                <option value="actif">Très actif (6–7x/sem)</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-600 uppercase tracking-widest block mb-1">Objectif</label>
              <select value={form.goal} onChange={e => update('goal', e.target.value)} className={inputClass}>
                <option value="perte">Perdre du poids (−500 kcal)</option>
                <option value="maintien">Maintenir mon poids</option>
                <option value="masse">Prendre de la masse (+300 kcal)</option>
              </select>
            </div>

            <div className="bg-[#1E1E28] border border-yellow-600/20 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Besoin journalier recalculé</p>
              <p className="text-3xl font-serif text-yellow-500">{calculateCalories(form).toLocaleString()} kcal</p>
              {profile && calculateCalories(form) !== profile.daily_calories && (
                <p className="text-xs text-gray-500 mt-1">Sauvegardez pour appliquer</p>
              )}
            </div>
          </div>

          {/* DÉCONNEXION */}
          <div className="bg-[#18181F] border border-[#22222E] rounded-xl p-5">
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Session</p>
            <button onClick={handleLogout}
              className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-3 rounded-xl text-sm font-medium transition-colors">
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}