'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      router.push(session ? '/dashboard' : '/login')
    })
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-[#18181F] border border-yellow-600/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-yellow-500 text-lg">+</span>
        </div>
        <p className="text-gray-600 text-sm">Chargement...</p>
      </div>
    </div>
  )
}